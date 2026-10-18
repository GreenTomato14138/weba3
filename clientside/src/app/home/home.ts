import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EventService } from '../services/event.service';
import { Category, CharityEvent, SiteStats } from '../models/models';
import { EventCard } from '../shared/event-card/event-card';

/**
 * Home page.
 *
 * State is held in signals rather than plain fields, so the template reacts
 * automatically when the HTTP responses arrive - no manual change detection
 * and no ngZone juggling.
 */
@Component({
  imports: [RouterLink, EventCard],
  selector: 'app-home',
  styleUrl: './home.css',
  templateUrl: './home.html'
})
export class Home implements OnInit, OnDestroy {
  private readonly events = inject(EventService);
  private timer?: ReturnType<typeof setInterval>;

  readonly featured = signal<CharityEvent[]>([]);
  readonly upcoming = signal<CharityEvent[]>([]);
  readonly categories = signal<Category[]>([]);
  readonly stats = signal<SiteStats | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly slide = signal(0);

  ngOnInit(): void {
    this.events.featured(3).subscribe({
      next: (list) => this.featured.set(list),
      error: (err) => this.error.set(err.message)
    });

    this.events.list('upcoming', 9).subscribe({
      next: (response) => {
        this.upcoming.set(response.data);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.message);
        this.loading.set(false);
      }
    });

    this.events.categories().subscribe({
      next: (list) => this.categories.set(list),
      error: () => undefined
    });

    this.events.stats().subscribe({
      next: (s) => this.stats.set(s),
      error: () => undefined
    });

    // Rotate the hero carousel every six seconds.
    this.timer = setInterval(() => this.next(), 6000);
  }

  ngOnDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  current(): CharityEvent | null {
    return this.featured()[this.slide()] ?? null;
  }

  next(): void {
    const total = this.featured().length;
    if (total) this.slide.set((this.slide() + 1) % total);
  }

  previous(): void {
    const total = this.featured().length;
    if (total) this.slide.set((this.slide() - 1 + total) % total);
  }

  goTo(index: number): void {
    this.slide.set(index);
  }

  money(value: number): string {
    return '$' + Number(value).toLocaleString('en-AU');
  }
}
