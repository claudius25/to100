import { Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { readBlueprintChapter, toHeroStartingState } from '../blueprint-water/hero-blueprint';
import { Disposition, StatusBarComponent } from '../components/status-bar/status-bar.component';
import { GameEngine } from '../simulation/model/game-engine';

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
  private readonly origin = readBlueprintChapter(
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

  protected async continueToGame(): Promise<void> {
    if (this.navigating()) return;
    this.navigating.set(true);
    try {
      await this.router.navigateByUrl(
        '/game',
        this.origin ? { state: { blueprintChapter: structuredClone(this.origin) } } : {},
      );
    } finally {
      this.navigating.set(false);
    }
  }
}
