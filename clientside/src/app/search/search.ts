import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { EventService } from '../services/event.service';
import { Category, CharityEvent } from '../models/models';
import { EventCard } from '../shared/event-card/event-card';

/**
 * Search page - the part of the brief that asks for "data filtering and
 * validation".
 *
 * The filters are a reactive form: `form.getRawValue()` gives a typed snapshot
 * with no manual DOM reading. Category checkboxes live in a signal because they
 * are a set of values rather than a single control.
 *
 * The API ANDs every filter together and returns 200 + an empty array when
 * nothing matches, so "no results" is rendered as a friendly empty state
 * rather than an error.
 */
@Component({
  imports: [ReactiveFormsModule, EventCard],
  selector: 'app-search',
  styleUrl: './search.css',
  templateUrl: './search.html'
})
export class Search implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(EventService);

  readonly form = this.fb.nonNullable.group({
    q: '',
    location: '',
    from: '',
    to: '',
    free: false,
    sort: 'date'
  });

  readonly categories = signal<Category[]>([]);
  readonly chosen = signal<string[]>([]);
  readonly results = signal<CharityEvent[]>([]);
  readonly count = signal(0);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly dateError = signal('');
  readonly searched = signal(false);

  ngOnInit(): void {
    this.service.categories().subscribe({
      next: (list) => this.categories.set(list),
      error: () => undefined
    });
    this.run();
  }

  isChosen(slug: string): boolean {
    return this.chosen().includes(slug);
  }

  toggleCategory(slug: string): void {
    this.chosen.update((list) =>
      list.includes(slug) ? list.filter((item) => item !== slug) : [...list, slug]
    );
  }

  /** Runs the search; validates the date window before calling the API. */
  run(): void {
    const { q, location, from, to, free, sort } = this.form.getRawValue();

    this.dateError.set('');
    if (from && to && new Date(from) > new Date(to)) {
      this.dateError.set('The "from" date must be on or before the "to" date.');
      return;
    }

    this.loading.set(true);
    this.searched.set(true);
    this.error.set('');

    this.service
      .search({
        q: q || undefined,
        location: location || undefined,
        from: from || undefined,
        to: to || undefined,
        free: free || undefined,
        sort: sort as 'date' | 'date-desc' | 'progress' | 'raised' | 'name' | 'price',
        category: this.chosen().length ? this.chosen() : undefined
      })
      .subscribe({
        next: (response) => {
          this.results.set(response.data);
          this.count.set(response.count ?? response.data.length);
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(err.message);
          this.loading.set(false);
        }
      });
  }

  reset(): void {
    this.form.reset({ q: '', location: '', from: '', to: '', free: false, sort: 'date' });
    this.chosen.set([]);
    this.run();
  }
}
