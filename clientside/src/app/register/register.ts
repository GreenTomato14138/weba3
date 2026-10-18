import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { EventService } from '../services/event.service';
import { RegistrationService } from '../services/registration.service';
import { CharityEvent, Registration } from '../models/models';

/**
 * Registration page.
 *
 * The form is validated twice: once here in the browser (so the visitor gets
 * instant feedback) and again on the server, which is the copy that actually
 * protects the database. When the API answers 422 it returns a map of
 * field -> message, which we merge straight back onto the matching inputs.
 */
@Component({
  imports: [ReactiveFormsModule, RouterLink],
  selector: 'app-register',
  styleUrl: './register.css',
  templateUrl: './register.html'
})
export class Register implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(EventService);
  private readonly registrations = inject(RegistrationService);

  readonly form = this.fb.nonNullable.group({
    full_name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
    email: ['', [Validators.required, Validators.email]],
    phone: ['', [Validators.required, Validators.pattern(/^[+()\-\s\d]{6,40}$/)]],
    tickets: [1, [Validators.required, Validators.min(1), Validators.max(50)]],
    notes: ['', [Validators.maxLength(255)]]
  });

  readonly event = signal<CharityEvent | null>(null);
  readonly eventId = signal(0);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly fieldErrors = signal<Record<string, string>>({});
  readonly confirmation = signal<Registration | null>(null);
  readonly message = signal('');

  ngOnInit(): void {
    this.route.queryParamMap.subscribe((params) => {
      const id = Number(params.get('id'));
      this.eventId.set(id);
      if (!id) {
        this.loading.set(false);
        return;
      }
      this.service.byId(id).subscribe({
        next: (item) => {
          this.event.set(item);
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(err.message);
          this.loading.set(false);
        }
      });
    });
  }

  /** Shows either the server's message for a field or the local one. */
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

    const id = this.eventId();
    if (!id) {
      this.error.set('Open this page from an event so we know which one to book.');
      return;
    }

    const value = this.form.getRawValue();
    this.saving.set(true);

    this.registrations
      .create({
        event_id: id,
        full_name: value.full_name.trim(),
        email: value.email.trim().toLowerCase(),
        phone: value.phone.trim(),
        tickets: Number(value.tickets),
        notes: value.notes.trim() || null
      })
      .subscribe({
        next: (response) => {
          this.confirmation.set(response.data);
          this.message.set(response.message ?? 'Your booking has been recorded.');
          this.saving.set(false);
        },
        error: (err) => {
          this.error.set(err.message);
          if (err.fields) this.fieldErrors.set(err.fields);
          this.saving.set(false);
        }
      });
  }

  bookAnother(): void {
    this.confirmation.set(null);
    this.form.reset({ full_name: '', email: '', phone: '', tickets: 1, notes: '' });
  }

  money(value: number): string {
    return '$' + Number(value).toLocaleString('en-AU');
  }

  dateLabel(item: CharityEvent): string {
    return new Date(item.event_date).toLocaleDateString('en-AU', {
      weekday: 'short',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }
}
