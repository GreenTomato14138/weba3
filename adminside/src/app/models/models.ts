/**
 * Domain models for the Charity Events case study.
 * These interfaces mirror exactly what the Express API returns, so a change on
 * the server shows up as a compile error here instead of a blank page.
 */

/** Wrapper every successful endpoint returns. */
export interface ApiResponse<T> {
  success: true;
  count?: number;
  message?: string;
  scope?: string;
  filters?: Record<string, unknown> | null;
  data: T;
}

/** Wrapper every failed endpoint returns (4xx / 5xx). */
export interface ApiFailure {
  success: false;
  error: {
    message: string;
    /** Optional per-field messages, e.g. { email: 'Email address is required.' } */
    fields?: Record<string, string>;
  };
}

/** A charity event as returned by the list / search / detail endpoints. */
export interface CharityEvent {
  event_id: number;
  event_name: string;
  slug: string;
  summary: string;
  event_date: string;
  end_date: string | null;
  venue: string;
  address: string;
  suburb: string;
  city: string;
  ticket_price: number;
  is_free: number;
  goal_amount: number;
  capacity: number;
  image_url: string | null;
  status: 'active' | 'suspended';
  category_id: number;
  category_name: string;
  category_slug: string;
  category_icon: string | null;
  category_colour: string | null;
  organisation_id: number;
  organisation_name: string;
  organisation_colour: string | null;
  organisation_email: string | null;
  raised_amount: number;
  supporter_count: number;
  progress_pct: number;
  days_remaining: number | null;
  event_status: string;
  registration_count: number;
  tickets_taken: number;
  capacity_pct: number;
  latitude: number | null;
  longitude: number | null;

  /* ---- detail endpoint only ---- */
  full_description?: string;
  organisation_mission?: string;
  organisation_phone?: string;
  organisation_website?: string;
  suspension_reason?: string | null;
  created_at?: string;
  updated_at?: string;
  recent_donations?: Donation[];
  updates?: EventUpdate[];
  registrations?: Registration[];
}

/** One booking. Returned newest-first by every endpoint. */
export interface Registration {
  registration_id: number;
  event_id: number;
  full_name: string;
  email: string;
  phone: string;
  tickets: number;
  registration_date: string;
  notes?: string | null;
  /* joined columns (list endpoint / admin) */
  event_name?: string;
  event_slug?: string;
  venue?: string;
  city?: string;
  event_date?: string;
}

/** Payload the registration form POSTs. */
export interface RegistrationPayload {
  event_id: number;
  full_name: string;
  email: string;
  phone: string;
  tickets: number;
  notes?: string | null;
}

export interface Donation {
  donor_name: string;
  amount: number;
  message: string | null;
  donated_at: string;
}

export interface EventUpdate {
  update_id: number;
  title: string;
  body: string;
  posted_at: string;
}

export interface Category {
  category_id: number;
  category_name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  colour_hex: string | null;
  event_count: number;
}

export interface Organisation {
  organisation_id: number;
  organisation_name: string;
  mission: string | null;
  contact_email: string | null;
  phone: string | null;
  website: string | null;
  city: string | null;
  established_year: number | null;
  logo_colour: string | null;
  event_count: number;
}

export interface SiteStats {
  total_events: number;
  upcoming_events: number;
  past_events: number;
  total_raised: number;
  total_supporters: number;
  total_capacity: number;
  total_categories: number;
  total_organisations: number;
  generated_at: string;
}

/** One day of the Open-Meteo forecast (external API, Part 6 bonus). */
export interface WeatherDay {
  date: string;
  weather_code: number | null;
  description: string;
  icon: string;
  temp_max: number | null;
  temp_min: number | null;
  rain_chance: number | null;
}

export interface WeatherForecast {
  success: boolean;
  source: string;
  event: string;
  location: { latitude: number; longitude: number };
  timezone: string | null;
  units: Record<string, string> | null;
  count: number;
  data: WeatherDay[];
}

/** Admin-side summary numbers. */
export interface AdminSummary {
  total_events: number;
  active_events: number;
  suspended_events: number;
  upcoming_events: number;
  past_events: number;
  total_registrations: number;
  total_tickets: number;
}

/** Fields the admin create / edit form sends. */
export interface EventPayload {
  event_name: string;
  summary: string;
  full_description: string;
  event_date: string;
  end_date?: string | null;
  venue: string;
  address: string;
  suburb: string;
  city: string;
  ticket_price: number;
  is_free?: boolean;
  goal_amount: number;
  capacity: number;
  category_id: number;
  organisation_id: number;
  status: 'active' | 'suspended';
  suspension_reason?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  image_url?: string | null;
}

/** Filters the public search page can send. */
export interface EventSearchParams {
  q?: string;
  category?: string[] | string;
  location?: string;
  from?: string;
  to?: string;
  free?: boolean;
  sort?: 'date' | 'date-desc' | 'progress' | 'raised' | 'name' | 'price';
}
