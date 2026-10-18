import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CharityEvent } from '../../models/models';

/**
 * Reusable event card.
 *
 * `input.required<CharityEvent>()` is Angular's signal input: the parent binds
 * [event]="someEvent" and the template reads event(). Because it is required,
 * TypeScript refuses to compile a card that was not given an event.
 */
@Component({
  imports: [RouterLink],
  selector: 'app-event-card',
  styleUrl: './event-card.css',
  templateUrl: './event-card.html'
})
export class EventCard {
  readonly event = input.required<CharityEvent>();

  /** Stored paths look like "assets/img/x.jpg"; turn them into a site URL. */
  image(): string {
    const raw = this.event().image_url;
    if (!raw) return '/assets/img/cleanup.jpg';
    if (raw.startsWith('http')) return raw;
    return '/assets/img/' + raw.split('/').pop();
  }

  price(): string {
    return this.event().is_free ? 'Free' : '$' + Number(this.event().ticket_price).toFixed(2);
  }

  dateLabel(): string {
    return new Date(this.event().event_date).toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  }

  /** Keeps the progress bar inside its track even if the goal was exceeded. */
  progressWidth(): number {
    return Math.min(100, Math.max(0, Number(this.event().progress_pct) || 0));
  }
}
