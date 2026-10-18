import { Component, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ThemeService } from './services/theme.service';

/**
 * Application shell: the shared header, navigation and footer that wrap every
 * routed page. The brief requires the navigation to appear on every page, so
 * it lives here rather than in each page component.
 */
@Component({
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html'
})
export class App {
  protected readonly year = new Date().getFullYear();
  protected readonly menuOpen = signal(false);

  // Decorative particles for the day/night atmosphere background.
  readonly petals = this.makeParticles(12, 9, 18);
  readonly fireflies = this.makeParticles(16, 10, 22);

  constructor(protected readonly themeService: ThemeService) {}

  toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  closeMenu(): void {
    this.menuOpen.set(false);
  }

  toggleTheme(): void {
    this.themeService.toggle();
  }

  private makeParticles(count: number, minDur: number, maxDur: number) {
    return Array.from({ length: count }, (_, i) => {
      const left = Math.round((i / count) * 100 + (Math.random() * 14 - 7));
      const dur = +(minDur + Math.random() * (maxDur - minDur)).toFixed(2);
      const delay = +(-Math.random() * maxDur).toFixed(2);
      const drift = Math.round((Math.random() - 0.5) * 160);
      return {
        left: Math.max(2, Math.min(98, left)),
        duration: dur,
        delay,
        drift
      };
    });
  }
}
