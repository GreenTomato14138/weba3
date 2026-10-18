import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from './api.service';
import { WeatherDay, WeatherForecast } from '../models/models';

/**
 * External API integration (Part 6, bonus marks).
 *
 * The forecast comes from Open-Meteo, but the browser never talks to it
 * directly - our Express API proxies the call (GET /api/weather?event_id=1),
 * reads the venue coordinates from MySQL and translates the numeric WMO
 * weather_code into a plain English sentence plus an icon.
 */
@Injectable({ providedIn: 'root' })
export class WeatherService {
  private readonly api = inject(ApiService);

  /** 7 day forecast for the venue of one event. */
  forEvent(eventId: number, days = 7): Observable<WeatherForecast> {
    return this.api
      .getEnvelope<WeatherDay[]>('/weather', { event_id: eventId, days })
      .pipe(map((response) => response as unknown as WeatherForecast));
  }

  /** Forecast for a raw coordinate pair (handy while testing). */
  forCoordinates(latitude: number, longitude: number, days = 7): Observable<WeatherForecast> {
    return this.api
      .getEnvelope<WeatherDay[]>('/weather', { latitude, longitude, days })
      .pipe(map((response) => response as unknown as WeatherForecast));
  }
}
