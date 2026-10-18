import { Routes } from '@angular/router';
import { EventList } from './event-list/event-list';
import { EventForm } from './event-form/event-form';
import { Registrations } from './registrations/registrations';

/**
 * Staff console routes.
 * One EventForm component serves both "new" and "edit/:id" - it decides which
 * mode it is in by looking for the :id route parameter.
 */
export const routes: Routes = [
  { path: '', component: EventList, title: 'Events · Staff console' },
  { path: 'new', component: EventForm, title: 'New event · Staff console' },
  { path: 'edit/:id', component: EventForm, title: 'Edit event · Staff console' },
  { path: 'registrations', component: Registrations, title: 'Registrations · Staff console' },
  { path: '**', redirectTo: '' }
];
