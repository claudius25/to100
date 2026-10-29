import { DOCUMENT } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  output,
  signal,
} from '@angular/core';

type LandscapeOrientation = ScreenOrientation & {
  lock?: (orientation: 'landscape') => Promise<void>;
};

@Component({
  selector: 'app-landscape-viewport',
  templateUrl: './landscape-viewport.html',
  styleUrl: './landscape-viewport.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LandscapeViewport {
  readonly portraitChange = output<boolean>();
  private readonly document = inject(DOCUMENT);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);
  private orientationLocked = false;
  private disposed = false;

  protected readonly portraitBlocked = signal(false);
  protected readonly launched = signal(false);
  protected readonly fullscreenAvailable = signal(false);
  protected readonly fullscreen = signal(false);
  protected readonly requestingFullscreen = signal(false);
  protected readonly fullscreenNotice = signal('');

  constructor() {
    afterNextRender(() => {
      const window = this.document.defaultView;
      if (!window) return;
      const portrait = window.matchMedia?.('(orientation: portrait) and (any-pointer: coarse)');
      const updatePortrait = () => {
        const blocked = portrait?.matches ?? false;
        this.portraitBlocked.set(blocked);
        this.portraitChange.emit(blocked);
      };
      updatePortrait();
      portrait?.addEventListener('change', updatePortrait);
      this.fullscreenAvailable.set(typeof this.host.nativeElement.requestFullscreen === 'function');
      const updateFullscreen = () => {
        this.fullscreen.set(this.document.fullscreenElement === this.host.nativeElement);
        if (!this.fullscreen()) this.unlockOrientation();
      };
      this.document.addEventListener('fullscreenchange', updateFullscreen);
      this.destroyRef.onDestroy(() => {
        portrait?.removeEventListener('change', updatePortrait);
        this.document.removeEventListener('fullscreenchange', updateFullscreen);
      });
    });
    this.destroyRef.onDestroy(() => {
      this.disposed = true;
      this.unlockOrientation();
    });
  }

  protected async play(): Promise<void> {
    if (this.requestingFullscreen()) return;
    this.requestingFullscreen.set(true);
    this.fullscreenNotice.set('');
    try {
      if (!this.fullscreenAvailable() || this.fullscreen()) return;
      await this.host.nativeElement.requestFullscreen();
      if (this.disposed) return;
      const window = this.document.defaultView;
      if (!window?.matchMedia?.('(any-pointer: coarse)').matches) return;
      const orientation: LandscapeOrientation | undefined = window.screen.orientation;
      if (!orientation?.lock) {
        this.fullscreenNotice.set('Please rotate your device to landscape.');
        return;
      }
      try {
        await orientation.lock('landscape');
        this.orientationLocked = true;
        if (this.disposed || this.document.fullscreenElement !== this.host.nativeElement) {
          this.unlockOrientation();
        }
      } catch (error) {
        console.warn('Landscape orientation lock is unavailable.', error);
        this.fullscreenNotice.set('Automatic rotation is unavailable. Please rotate your device.');
      }
    } catch (error) {
      console.warn('Could not change fullscreen mode.', error);
      this.fullscreenNotice.set(
        'Fullscreen is unavailable. You can still play by rotating your device to landscape.',
      );
    } finally {
      if (!this.disposed) this.launched.set(true);
      this.requestingFullscreen.set(false);
    }
  }

  private unlockOrientation(): void {
    if (!this.orientationLocked) return;
    this.document.defaultView?.screen.orientation.unlock();
    this.orientationLocked = false;
  }
}
