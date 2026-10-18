import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { routes } from './app.routes';

/**
 * Application-wide providers.
 *
 * provideHttpClient(withFetch()) is what lets every service talk to the
 * Express API on :3000 using the modern fetch backend instead of XHR.
 * withInMemoryScrolling makes navigating between events jump back to the top
 * of the page, exactly like a normal multi-page website would.
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      withInMemoryScrolling({ scrollPositionRestoration: 'top', anchorScrolling: 'enabled' })
    ),
    provideHttpClient(withFetch())
  ]
};
