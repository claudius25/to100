import { Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { readBlueprintChapter, toHeroStartingState } from '../chapter-one/hero-blueprint';
import { Disposition, StatusBarComponent } from '../components/status-bar/status-bar.component';
import { GameEngine } from '../simulation/model/game-engine';
import { LifeSaveStore } from '../life-save';

export const CHAPTER_TWO_STATUS_BAR = { width: 154, height: 24 } as const;

/** Maps mood (0-100) onto the four status-bar expressions. */
export function moodToDisposition(mood: number): Disposition {
  return Math.min(4, Math.max(1, Math.floor(mood / 25) + 1)) as Disposition;
}

@Component({
  selector: 'app-chapter-two',
  imports: [StatusBarComponent],
  templateUrl: './chapter-two.html',
  styleUrl: './chapter-two.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChapterTwoPage {
  private readonly router = inject(Router);
  private readonly store = inject(LifeSaveStore);
  private readonly saved = this.store.savedLife();
  private readonly origin =
    this.saved?.route === '/chapter-2'
      ? this.saved.origin
      : readBlueprintChapter(
          this.router.currentNavigation()?.extras.state ?? inject(Location).getState(),
        );
  private readonly hero = new GameEngine().startNewGame(
    this.origin?.name ?? 'Hero',
    this.origin ? toHeroStartingState(this.origin) : undefined,
  ).hero;

  protected readonly statusBar = CHAPTER_TWO_STATUS_BAR;
  protected readonly name = this.hero.name;
  protected readonly health = this.hero.condition.health;
  protected readonly disposition = moodToDisposition(this.hero.condition.mood);
  protected readonly age = this.hero.ageYears;
  protected readonly money = this.hero.resources.money;
  protected readonly navigating = signal(false);
  protected readonly navigationError = signal('');

  constructor() {
    if (this.saved?.route !== '/game')
      this.store.write({ version: 1, route: '/chapter-2', origin: this.origin });
  }

  protected async continueToGame(): Promise<void> {
    if (this.navigating()) return;
    this.navigating.set(true);
    try {
      const navigated = await this.router.navigateByUrl('/game', {
        replaceUrl: true,
        ...(this.origin ? { state: { blueprintChapter: structuredClone(this.origin) } } : {}),
      });
      if (!navigated) this.navigationError.set('The game could not be opened. Please try again.');
    } catch (error) {
      console.error('Could not continue to the TO100 game.', error);
      this.navigationError.set('The game could not be opened. Please try again.');
    } finally {
      this.navigating.set(false);
    }
  }
}
