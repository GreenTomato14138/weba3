import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EventService } from '../services/event.service';
import { CharityEvent } from '../models/models';

/**
 * Admin event list.
 *
 * Uses GET /api/events/admin, which - unlike the public endpoint - also returns
 * suspended events, so staff can see everything. Deleting an event that still
 * has bookings is refused by the API with 409; we simply surface that message,
 * which is the same rule the database enforces with ON DELETE RESTRICT.
 */
@Component({
  imports: [RouterLink],
  selector: 'app-event-list',
  styleUrl: './event-list.css',
  templateUrl: './event-list.html'
})
export class EventList implements OnInit {
  private readonly service = inject(EventService);

  readonly events = signal<CharityEvent[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly notice = signal('');
  readonly keyword = signal('');
  readonly status = signal('all');

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');

    this.service
      .adminList({
        q: this.keyword() || undefined,
        status: this.status() === 'all' ? undefined : this.status()
      })
      .subscribe({
        next: (response) => {
          this.events.set(response.data);
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(err.message);
          this.loading.set(false);
        }
      });
  }

  onSearch(value: string): void {
    this.keyword.set(value);
    this.load();
  }

  onStatus(value: string): void {
    this.status.set(value);
    this.load();
  }

  remove(item: CharityEvent): void {
    const booked = Number(item.registration_count) || 0;
    const warning = booked
      ? `"${item.event_name}" has ${booked} booking(s). The server will refuse this delete.`
      : `Delete "${item.event_name}"? This cannot be undone.`;

    if (!confirm(warning)) return;

    this.notice.set('');
    this.error.set('');

    this.service.remove(item.event_id).subscribe({
      next: () => {
        this.notice.set(`"${item.event_name}" was deleted.`);
        this.load();
      },
      error: (err) => this.error.set(err.message)
    });
  }

  money(value: number): string {
    return '$' + Number(value).toLocaleString('en-AU');
  }

  dateLabel(value: string): string {
    return new Date(value).toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  }
}
