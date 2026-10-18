import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { EventService } from '../services/event.service';
import { Category, Organisation } from '../models/models';

/**
 * Create / edit form.
 *
 * The same component handles /new and /edit/:id. Every rule below mirrors the
 * server-side validators exactly (name 3-150, summary 10-255, description 20+,
 * capacity 1-200000, ...), so the browser catches mistakes early while the API
 * remains the authority. A 422 response is mapped back onto the inputs.
 */
@Component({
  imports: [ReactiveFormsModule, RouterLink],
  selector: 'app-event-form',
  styleUrl: './event-form.css',
  templateUrl: './event-form.html'
})
export class EventForm implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly service = inject(EventService);

  readonly form = this.fb.nonNullable.group({
    event_name: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(150)]],
    summary: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(255)]],
    full_description: ['', [Validators.required, Validators.minLength(20), Validators.maxLength(8000)]],
    event_date: ['', Validators.required],
    end_date: [''],
    venue: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(150)]],
    address: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(200)]],
    suburb: ['', [Validators.required, Validators.maxLength(80)]],
    city: ['', [Validators.required, Validators.maxLength(80)]],
    ticket_price: [0, [Validators.required, Validators.min(0)]],
    goal_amount: [0, [Validators.required, Validators.min(0)]],
    capacity: [100, [Validators.required, Validators.min(1), Validators.max(200000)]],
    category_id: [0, [Validators.required, Validators.min(1)]],
    organisation_id: [0, [Validators.required, Validators.min(1)]],
    status: ['active', Validators.required],
    suspension_reason: ['', Validators.maxLength(255)],
    latitude: [''],
    longitude: [''],
    image_url: ['', Validators.maxLength(255)],
    is_free: [false]
  });

  readonly categories = signal<Category[]>([]);
  readonly organisations = signal<Organisation[]>([]);
  readonly editingId = signal(0);
  readonly loadingEvent = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly fieldErrors = signal<Record<string, string>>({});

  ngOnInit(): void {
    this.service.categories().subscribe({
      next: (list) => this.categories.set(list),
      error: () => undefined
    });
    this.service.organisations().subscribe({
      next: (list) => this.organisations.set(list),
      error: () => undefined
    });

    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!id) return;

    this.editingId.set(id);
    this.loadingEvent.set(true);
    this.service.byId(id).subscribe({
      next: (item) => {
        this.form.patchValue({
          event_name: item.event_name,
          summary: item.summary,
          full_description: item.full_description ?? '',
          event_date: item.event_date ? item.event_date.replace(' ', 'T').slice(0, 16) : '',
          end_date: item.end_date ? item.end_date.replace(' ', 'T').slice(0, 16) : '',
          venue: item.venue,
          address: item.address,
          suburb: item.suburb,
          city: item.city,
          ticket_price: Number(item.ticket_price),
          goal_amount: Number(item.goal_amount),
          capacity: Number(item.capacity),
          category_id: Number(item.category_id),
          organisation_id: Number(item.organisation_id),
          status: item.status,
          suspension_reason: item.suspension_reason ?? '',
          latitude: item.latitude === null ? '' : String(item.latitude),
          longitude: item.longitude === null ? '' : String(item.longitude),
          image_url: item.image_url ?? '',
          is_free: !!item.is_free
        });
        this.loadingEvent.set(false);
      },
      error: (err) => {
        this.error.set(err.message);
        this.loadingEvent.set(false);
      }
    });
  }

  errorFor(field: string): string {
    return this.fieldErrors()[field] ?? '';
  }

  submit(): void {
    this.error.set('');
    this.fieldErrors.set({});

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const payload = {
      event_name: raw.event_name,
      summary: raw.summary,
      full_description: raw.full_description,
      event_date: raw.event_date.replace('T', ' '),
      end_date: raw.end_date ? raw.end_date.replace('T', ' ') : null,
      venue: raw.venue,
      address: raw.address,
      suburb: raw.suburb,
      city: raw.city,
      ticket_price: Number(raw.ticket_price),
      goal_amount: Number(raw.goal_amount),
      capacity: Number(raw.capacity),
      category_id: Number(raw.category_id),
      organisation_id: Number(raw.organisation_id),
      status: raw.status as 'active' | 'suspended',
      suspension_reason: raw.suspension_reason || null,
      latitude: raw.latitude === '' ? null : Number(raw.latitude),
      longitude: raw.longitude === '' ? null : Number(raw.longitude),
      image_url: raw.image_url || null,
      is_free: raw.is_free
    };

    this.saving.set(true);
    const id = this.editingId();
    const request = id
      ? this.service.update(id, payload)
      : this.service.create(payload);

    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.router.navigate(['/']);
      },
      error: (err) => {
        this.error.set(err.message);
        if (err.fields) this.fieldErrors.set(err.fields);
        this.saving.set(false);
      }
    });
  }
}
