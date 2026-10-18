import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { RegistrationService } from '../services/registration.service';
import { Registration } from '../models/models';

/**
 * All bookings across every event, newest first.
 *
 * Cancelling a booking is the only way to free up an event that the API
 * refused to delete - once the last booking is gone the delete succeeds.
 */
@Component({
  imports: [RouterLink],
  selector: 'app-registrations',
  styleUrl: './registrations.css',
  templateUrl: './registrations.html'
})
export class Registrations implements OnInit {
  private readonly service = inject(RegistrationService);

  readonly rows = signal<Registration[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly notice = signal('');

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.service.listAll(200).subscribe({
      next: (response) => {
        this.rows.set(response.data);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.message);
        this.loading.set(false);
      }
    });
  }

  cancel(row: Registration): void {
    if (!confirm(`Cancel the booking for ${row.full_name}?`)) return;

    this.notice.set('');
    this.error.set('');

    this.service.cancel(row.registration_id).subscribe({
      next: () => {
        this.notice.set(`Booking #${row.registration_id} was cancelled.`);
        this.load();
      },
      error: (err) => this.error.set(err.message)
    });
  }

  when(value: string): string {
    return new Date(value).toLocaleString('en-AU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  }
}
