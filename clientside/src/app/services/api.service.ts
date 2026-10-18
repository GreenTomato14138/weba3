import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { ApiResponse, ApiFailure } from '../models/models';

/**
 * Base URL of the Express API (Part 2).
 * Local development: the API listens on :3000 (see project/api/.env).
 * cPanel deployment: change this one constant to the public API origin.
 */
export const API_BASE_URL = 'http://localhost:3000/api';

/** A normalised error the UI can render straight to the visitor. */
export interface ApiError {
  message: string;
  status: number;
  /** Per-field messages coming back from a 422, keyed by input name. */
  fields?: Record<string, string>;
}

/**
 * Thin, typed wrapper around HttpClient.
 *
 * Every endpoint answers with the same envelope - { success, data, count } on
 * the happy path and { success:false, error:{ message, fields } } when it
 * fails. Unwrapping that envelope here means components never have to know
 * about it; they just receive the payload type they asked for, and a clean
 * ApiError when something goes wrong.
 */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

  /** Builds HttpParams; array values are appended repeatedly (multi-select). */
  private toParams(source?: Record<string, unknown>): HttpParams {
    let params = new HttpParams();
    if (!source) return params;

    for (const [key, raw] of Object.entries(source)) {
      if (raw === undefined || raw === null || raw === '') continue;
      if (Array.isArray(raw)) {
        for (const value of raw) {
          if (value === undefined || value === null || value === '') continue;
          params = params.append(key, String(value));
        }
      } else {
        params = params.set(key, String(raw));
      }
    }
    return params;
  }

  /** GET returning just `data`. */
  get<T>(path: string, query?: Record<string, unknown>): Observable<T> {
    return this.http
      .get<ApiResponse<T>>(`${API_BASE_URL}${path}`, { params: this.toParams(query) })
      .pipe(map((response) => response.data), catchError(this.normaliseError));
  }

  /** GET returning the whole envelope - use when `count` / `filters` matter. */
  getEnvelope<T>(path: string, query?: Record<string, unknown>): Observable<ApiResponse<T>> {
    return this.http
      .get<ApiResponse<T>>(`${API_BASE_URL}${path}`, { params: this.toParams(query) })
      .pipe(catchError(this.normaliseError));
  }

  post<T>(path: string, body: unknown): Observable<T> {
    return this.http
      .post<ApiResponse<T>>(`${API_BASE_URL}${path}`, body)
      .pipe(map((response) => response.data), catchError(this.normaliseError));
  }

  /** POST keeping the envelope (needed for the 201 message on registration). */
  postEnvelope<T>(path: string, body: unknown): Observable<ApiResponse<T>> {
    return this.http
      .post<ApiResponse<T>>(`${API_BASE_URL}${path}`, body)
      .pipe(catchError(this.normaliseError));
  }

  put<T>(path: string, body: unknown): Observable<T> {
    return this.http
      .put<ApiResponse<T>>(`${API_BASE_URL}${path}`, body)
      .pipe(map((response) => response.data), catchError(this.normaliseError));
  }

  delete<T>(path: string): Observable<T> {
    return this.http
      .delete<ApiResponse<T>>(`${API_BASE_URL}${path}`)
      .pipe(map((response) => response.data), catchError(this.normaliseError));
  }

  /**
   * Turns any HTTP failure into an ApiError carrying the server's own message
   * and, for validation failures (422), the per-field messages so each input
   * can show its own hint.
   */
  private normaliseError(error: HttpErrorResponse): Observable<never> {
    const body = error.error as ApiFailure | null;
    const normalised: ApiError = {
      message:
        body?.error?.message ??
        (error.status === 0
          ? 'Cannot reach the API. Is the server running on port 3000?'
          : error.message),
      status: error.status,
      fields: body?.error?.fields
    };
    return throwError(() => normalised);
  }
}
