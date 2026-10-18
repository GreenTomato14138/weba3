import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { ApiResponse, Registration, RegistrationPayload } from '../models/models';

/**
 * Bookings.
 *
 * POST /api/registrations is the endpoint the brief asks the public
 * "Register" page to call. The API answers:
 *   201 - created (envelope carries a friendly message + the new booking)
 *   409 - already booked / event closed / not enough tickets left
 *   422 - field validation failed, with per-field messages
 */
@Injectable({ providedIn: 'root' })
export class RegistrationService {
  private readonly api = inject(ApiService);

  /** Creates a booking; returns the envelope so the UI can show `message`. */
  create(payload: RegistrationPayload): Observable<ApiResponse<Registration>> {
    return this.api.postEnvelope<Registration>('/registrations', payload);
  }

  /** Bookings for one event (newest first) - used by the admin edit page. */
  listByEvent(eventId: number, limit = 50): Observable<ApiResponse<Registration[]>> {
    return this.api.getEnvelope<Registration[]>('/registrations', { event_id: eventId, limit });
  }

  /** All bookings across every event - the admin registrations page. */
  listAll(limit = 200): Observable<ApiResponse<Registration[]>> {
    return this.api.getEnvelope<Registration[]>('/registrations', { limit });
  }

  /**
   * Cancels a booking. This is how staff "unlock" an event that could not be
   * deleted while bookings existed.
   */
  cancel(id: number): Observable<unknown> {
    return this.api.delete<unknown>(`/registrations/${id}`);
  }
}
