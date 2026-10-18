import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import {
  ApiResponse,
  Category,
  CharityEvent,
  Donation,
  EventPayload,
  EventSearchParams,
  Organisation,
  SiteStats
} from '../models/models';

/**
 * Every call the two websites make about events.
 *
 * The client site only ever uses the public endpoints (list / featured /
 * search / byId); the admin console additionally uses adminList / create /
 * update / remove. Keeping them in one service means a change to the API is a
 * change in exactly one file.
 */
@Injectable({ providedIn: 'root' })
export class EventService {
  private readonly api = inject(ApiService);

  /** Home page feed. scope: upcoming | past | all */
  list(
    scope: 'upcoming' | 'past' | 'all' = 'upcoming',
    limit = 50,
    sort = 'date'
  ): Observable<ApiResponse<CharityEvent[]>> {
    return this.api.getEnvelope<CharityEvent[]>('/events', { scope, limit, sort });
  }

  /** Three most imminent events - the home page carousel. */
  featured(limit = 3): Observable<CharityEvent[]> {
    return this.api.get<CharityEvent[]>('/events/featured', { limit });
  }

  /**
   * Search page. Every filter is optional and the API ANDs them together,
   * so an empty query simply returns all upcoming events.
   */
  search(params: EventSearchParams): Observable<ApiResponse<CharityEvent[]>> {
    return this.api.getEnvelope<CharityEvent[]>('/events/search', { ...params });
  }

  /**
   * Event detail. The API also returns recent donations, organiser updates and
   * the registrations list (newest purchase first) in this single response.
   */
  byId(id: number): Observable<CharityEvent> {
    return this.api.get<CharityEvent>(`/events/${id}`);
  }

  /* ---- admin console ---- */

  /** Full list for staff, including suspended events. */
  adminList(query: { q?: string; status?: string; sort?: string } = {}): Observable<ApiResponse<CharityEvent[]>> {
    return this.api.getEnvelope<CharityEvent[]>('/events/admin', { ...query });
  }

  create(payload: EventPayload): Observable<CharityEvent> {
    return this.api.post<CharityEvent>('/events', payload);
  }

  update(id: number, payload: Partial<EventPayload>): Observable<CharityEvent> {
    return this.api.put<CharityEvent>(`/events/${id}`, payload);
  }

  /**
   * Deleting an event that still has bookings is refused by the API with 409.
   * The admin UI shows that message; the database enforces the same rule with
   * ON DELETE RESTRICT.
   */
  remove(id: number): Observable<unknown> {
    return this.api.delete<unknown>(`/events/${id}`);
  }

  /* ---- reference data ---- */

  categories(): Observable<Category[]> {
    return this.api.get<Category[]>('/categories');
  }

  organisations(): Observable<Organisation[]> {
    return this.api.get<Organisation[]>('/organisations');
  }

  stats(): Observable<SiteStats> {
    return this.api.get<SiteStats>('/stats');
  }

  recentDonations(limit = 12): Observable<Donation[]> {
    return this.api.get<Donation[]>('/donations/recent', { limit });
  }
}
