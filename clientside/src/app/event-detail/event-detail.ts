import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { EventService } from '../services/event.service';
import { WeatherService } from '../services/weather.service';
import { CharityEvent, WeatherDay } from '../models/models';

/**
 * Event detail page.
 *
 * The API returns the event, its recent donations, organiser updates and the
 * full registration list (ordered newest purchase first) in one response, so
 * this page needs a single round trip. The forecast is fetched separately from
 * our own /api/weather endpoint, which proxies Open-Meteo (Part 6 bonus).
 */
@Component({
  imports: [RouterLink],
  selector: 'app-event-detail',
  styleUrl: './event-detail.css',
  templateUrl: './event-detail.html'
})
export class EventDetail implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(EventService);
  private readonly weatherService = inject(WeatherService);

  readonly event = signal<CharityEvent | null>(null);
  readonly forecast = signal<WeatherDay[]>([]);
  readonly weatherError = signal('');
  readonly loading = signal(true);
  readonly error = signal('');
  readonly eventId = signal(0);

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const id = Number(params.get('id'));
      this.eventId.set(id);
      this.load(id);
    });
  }

  private load(id: number): void {
    this.loading.set(true);
    this.error.set('');

    this.service.byId(id).subscribe({
      next: (item) => {
        this.event.set(item);
        this.loading.set(false);
        this.loadWeather(id);
      },
      error: (err) => {
        this.error.set(err.message);
        this.loading.set(false);
      }
    });
  }

  private loadWeather(id: number): void {
    this.weatherService.forEvent(id, 7).subscribe({
      next: (res) => this.forecast.set(res.data ?? []),
      error: (err) => this.weatherError.set(err.message)
    });
  }

  image(): string {
    const raw = this.event()?.image_url;
    if (!raw) return '/assets/img/cleanup.jpg';
    if (raw.startsWith('http')) return raw;
    return '/assets/img/' + raw.split('/').pop();
  }

  price(): string {
    const item = this.event();
    if (!item) return '';
    return item.is_free ? 'Free' : '$' + Number(item.ticket_price).toFixed(2);
  }

  dateLabel(): string {
    const item = this.event();
    if (!item) return '';
    return new Date(item.event_date).toLocaleDateString('en-AU', {
      weekday: 'short',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }

  /** "2026-10-11 09:15" -> "11 Oct 2026, 9:15 am" */
  bookedAt(value: string): string {
    return new Date(value).toLocaleString('en-AU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  }

  /** Only show the forecast for the days around the event itself. */
  dayName(value: string): string {
    return new Date(value + 'T00:00:00').toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric' });
  }

  money(value: number): string {
    return '$' + Number(value).toLocaleString('en-AU');
  }
}
