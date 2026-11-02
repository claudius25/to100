import { isPlatformBrowser, Location } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  NgZone,
  PLATFORM_ID,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { readBlueprintChapter, toHeroStartingState } from '../chapter-one/hero-blueprint';
import { ActionButtonComponent } from '../components/action-button/action-button.component';
import { Disposition, StatusBarComponent } from '../components/status-bar/status-bar.component';
import { GameEngine } from '../simulation/model/game-engine';
import { LifeSaveStore } from '../life-save';
import {
  ChapterTwoScene,
  isWebGLAvailable,
  type NurserySnapshot,
  type TooltipView,
} from './nursery/chapter-2-scene';
import type { BatterySource, SelectedItem } from './nursery/interaction.types';
import { selectionLabel, toggleSelection, type InventoryView } from './nursery/inventory';
import { NURSERY_TEXT } from './nursery/nursery.config';

export const CHAPTER_TWO_STATUS_BAR = { width: 154, height: 24 } as const;

const EMPTY_INVENTORY: InventoryView = { screwdriver: false, batteries: [], empty: true };

/** Maps mood (0-100) onto the four status-bar expressions. */
export function moodToDisposition(mood: number): Disposition {
  return Math.min(4, Math.max(1, Math.floor(mood / 25) + 1)) as Disposition;
}

@Component({
  selector: 'app-chapter-two',
  imports: [StatusBarComponent, ActionButtonComponent],
  templateUrl: './chapter-two.html',
  styleUrl: './chapter-two.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'roomView()' },
})
export class ChapterTwoPage {
  private readonly zone = inject(NgZone);
  private readonly router = inject(Router);
  private readonly store = inject(LifeSaveStore);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
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
  private scene: ChapterTwoScene | null = null;

  protected readonly stage = viewChild.required<ElementRef<HTMLDivElement>>('stage');

  protected readonly statusBar = CHAPTER_TWO_STATUS_BAR;
  protected readonly name = this.hero.name;
  protected readonly health = this.hero.condition.health;
  protected readonly disposition = moodToDisposition(this.hero.condition.mood);
  protected readonly age = this.hero.ageYears;
  protected readonly money = this.hero.resources.money;
  protected readonly navigating = signal(false);
  protected readonly navigationError = signal('');

  protected readonly sceneUnavailable = signal(!this.browser || !isWebGLAvailable());
  protected readonly sceneNotice = signal('');
  protected readonly loading = signal(true);
  protected readonly hint = signal<string>(NURSERY_TEXT.loading);
  protected readonly inventory = signal<InventoryView>(EMPTY_INVENTORY);
  protected readonly selected = signal<SelectedItem>(null);
  protected readonly tooltip = signal<TooltipView | null>(null);
  /** Latched by the scene the moment the mobile actually starts spinning. */
  protected readonly puzzleCompleted = signal(false);
  protected readonly useLabel = computed(() => selectionLabel(this.selected()));
  /** Without a working room there is no puzzle to solve, so the chapter stays passable. */
  protected readonly canContinue = computed(
    () => this.puzzleCompleted() || this.sceneUnavailable(),
  );

  constructor() {
    if (this.saved?.route !== '/game')
      this.store.write({ version: 1, route: '/chapter-2', origin: this.origin });
    afterNextRender(() => void this.startScene());
    inject(DestroyRef).onDestroy(() => {
      this.scene?.dispose();
      this.scene = null;
    });
  }

  protected roomView(): void {
    this.scene?.roomView();
  }

  protected dismissTooltip(): void {
    this.scene?.dismissMessage();
  }

  protected runAction(owner: string, actionId: string): void {
    this.scene?.performAction(owner, actionId);
  }

  protected selectScrewdriver(): void {
    this.scene?.select(toggleSelection(this.selected(), { kind: 'screwdriver' }));
  }

  protected selectBatteries(source: BatterySource): void {
    this.scene?.select(toggleSelection(this.selected(), { kind: 'batteries', source }));
  }

  protected screwdriverSelected(): boolean {
    return this.selected()?.kind === 'screwdriver';
  }

  protected batteriesSelected(source: BatterySource): boolean {
    const selected = this.selected();
    return selected?.kind === 'batteries' && selected.source === source;
  }

  protected async continueToGame(): Promise<void> {
    if (this.navigating() || !this.canContinue()) return;
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

  private async startScene(): Promise<void> {
    if (this.sceneUnavailable()) {
      this.failScene();
      return;
    }
    const scene = new ChapterTwoScene(this.stage().nativeElement, {
      snapshot: (snapshot) => this.zone.run(() => this.applySnapshot(snapshot)),
      tooltip: (tooltip) => this.zone.run(() => this.tooltip.set(tooltip)),
    });
    this.scene = scene;
    try {
      await this.zone.runOutsideAngular(() => scene.init());
      this.loading.set(false);
    } catch (error) {
      console.error('The nursery room could not be prepared.', error);
      scene.dispose();
      this.scene = null;
      this.sceneUnavailable.set(true);
      this.failScene();
    }
  }

  private failScene(): void {
    this.loading.set(false);
    this.sceneNotice.set(NURSERY_TEXT.loadFailed);
    this.hint.set(NURSERY_TEXT.loadFailed);
  }

  private applySnapshot(snapshot: NurserySnapshot): void {
    this.hint.set(snapshot.status);
    this.inventory.set(snapshot.inventory);
    this.selected.set(snapshot.selected);
    // The scene latches completion, so a full puzzle reset also hides Continue.
    this.puzzleCompleted.set(snapshot.completed);
  }
}
