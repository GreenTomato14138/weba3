import { Routes } from '@angular/router';
import { Home } from './home/home';
import { Search } from './search/search';
import { EventDetail } from './event-detail/event-detail';
import { Register } from './register/register';

/**
 * The four pages of the public website.
 *
 * `/register?id=7` keeps the same query-string shape the Assessment 2 site
 * used (register.html?id=7), so any existing link keeps working.
 */
export const routes: Routes = [
  { path: '', component: Home, title: 'Charity Events · Browse' },
  { path: 'search', component: Search, title: 'Search · Charity Events' },
  { path: 'event/:id', component: EventDetail, title: 'Event · Charity Events' },
  { path: 'register', component: Register, title: 'Register · Charity Events' },
  { path: '**', redirectTo: '' }
];
