import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { LandscapeViewport } from './landscape-viewport';
import { LifeSaveStore } from '../life-save';

@Component({
  selector: 'app-life-launcher',
  template: '',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LifeLauncher {}

@Component({
  selector: 'app-game-viewport',
  imports: [LandscapeViewport, RouterOutlet],
  template: `
    <app-landscape-viewport
      [menu]="menu()"
      [hasSavedLife]="store.savedLife() !== null"
      [saveError]="store.error() || navigationError()"
      [busy]="navigating()"
      (newLife)="startNewLife()"
      (continueLife)="continueLife()"
    >
      <router-outlet />
    </app-landscape-viewport>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GameViewport {
  protected readonly store = inject(LifeSaveStore);
  private readonly router = inject(Router);
  protected readonly menu = signal(
    this.isHome(this.router.currentNavigation()?.finalUrl?.toString() ?? this.router.url),
  );
  protected readonly navigating = signal(false);
  protected readonly navigationError = signal('');

  constructor() {
    const subscription = this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) this.menu.set(this.isHome(event.urlAfterRedirects));
    });
    inject(DestroyRef).onDestroy(() => subscription.unsubscribe());
  }

  protected async startNewLife(): Promise<void> {
    if (this.navigating() || !this.store.startNewLife()) return;
    await this.open('/chapter-1');
  }

  protected async continueLife(): Promise<void> {
    const save = this.store.savedLife();
    if (!save || this.navigating()) return;
    await this.open(save.route);
  }

  private isHome(url: string): boolean {
    return url.split(/[?#]/)[0] === '/';
  }

  private async open(route: string): Promise<void> {
    this.navigating.set(true);
    this.navigationError.set('');
    try {
      if (!(await this.router.navigateByUrl(route)))
        this.navigationError.set('The life could not be opened. Please try again.');
    } catch (error) {
      console.error('Could not open the TO100 life.', error);
      this.navigationError.set('The life could not be opened. Please try again.');
    } finally {
      this.navigating.set(false);
    }
  }
}
