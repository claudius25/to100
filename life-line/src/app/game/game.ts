import { JsonPipe, Location } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  Injector,
  signal,
  viewChild,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { readBlueprintChapter, toHeroStartingState } from '../blueprint-water/hero-blueprint';
import { GameEngine } from '../simulation/model/game-engine';
import type { Step } from '../simulation/model/step';
import { TARGET_AGE_WEEKS } from '../simulation/model/types';

@Component({
  selector: 'app-game',
  imports: [JsonPipe, RouterLink],
  templateUrl: './game.html',
  styleUrl: './game.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GamePage {
  private readonly engine = new GameEngine();
  private readonly injector = inject(Injector);
  private readonly origin = readBlueprintChapter(
    inject(Router).currentNavigation()?.extras.state ?? inject(Location).getState(),
  );

  protected readonly state = signal(this.engine.getState());
  protected readonly targetAgeWeeks = TARGET_AGE_WEEKS;
  protected readonly lastTurn = computed(() => this.state().history.at(-1));
  protected readonly displayedSteps = signal(this.state().upcomingSteps);
  protected readonly phase = signal<'ready' | 'landing' | 'encounter' | 'scrolling'>('ready');
  protected readonly sliding = computed(() => this.phase() === 'landing');
  protected readonly busy = computed(() => this.phase() !== 'ready');
  protected readonly cameraWeeks = signal(0);
  protected readonly scrollDistance = computed(() => (this.lastTurn()?.weeksAdvanced ?? 0) * 7);
  protected readonly encounterDialog =
    viewChild.required<ElementRef<HTMLDialogElement>>('encounterDialog');
  protected readonly landingPosition = signal(7);
  protected readonly diceFaces: Record<number, readonly number[]> = {
    1: [4],
    2: [0, 8],
    3: [0, 4, 8],
    4: [0, 2, 6, 8],
    5: [0, 2, 4, 6, 8],
    6: [0, 2, 3, 5, 6, 8],
  };

  constructor() {
    if (this.origin) {
      this.state.set(this.engine.startNewGame(this.origin.name, toHeroStartingState(this.origin)));
      this.displayedSteps.set(this.state().upcomingSteps);
    }
  }

  protected rollDice(): void {
    if (this.busy() || this.state().status === 'completed') {
      return;
    }
    const turn = this.engine.rollTurn();
    if (!turn) {
      return;
    }
    this.state.set(this.engine.getState());
    this.landingPosition.set(turn.status === 'completed' ? 95 : 7 + turn.diceSum * 7);
    this.phase.set('landing');
  }

  protected finishSlide(event: AnimationEvent): void {
    if (
      event.target !== event.currentTarget ||
      !event.animationName.endsWith('hero-slide') ||
      !this.sliding()
    ) {
      return;
    }
    this.phase.set('encounter');
    this.encounterDialog().nativeElement.showModal();
  }

  protected acknowledgeEncounter(): void {
    if (this.phase() !== 'encounter') return;
    this.encounterDialog().nativeElement.close();
    if (this.state().status === 'completed') {
      this.phase.set('ready');
      this.displayedSteps.set([]);
      return;
    }
    const advanced = this.lastTurn()!.weeksAdvanced;
    this.displayedSteps.update((steps) => [
      ...steps,
      ...this.state().upcomingSteps.slice(12 - advanced),
    ]);
    this.phase.set('scrolling');
  }

  protected finishScroll(event: AnimationEvent): void {
    if (
      event.target !== event.currentTarget ||
      !event.animationName.endsWith('world-scroll') ||
      this.phase() !== 'scrolling'
    )
      return;
    this.cameraWeeks.update((weeks) => weeks + this.lastTurn()!.weeksAdvanced);
    this.displayedSteps.set(this.state().upcomingSteps);
    this.landingPosition.set(7);
    this.phase.set('ready');
    afterNextRender(() => this.rollButton().nativeElement.focus(), { injector: this.injector });
  }

  protected readonly rollButton = viewChild.required<ElementRef<HTMLButtonElement>>('rollButton');

  protected encounterIcon(step: Step): string {
    if (step.kind === 'empty') return 'quiet';
    if (step.kind === 'item') return step.itemBehavior === 'collectible' ? 'bag' : 'apple';
    if (step.templateId === 'shared-reading' || step.templateId === 'school-encouragement') {
      return 'book';
    }
    if (step.templateId === 'minor-illness') return 'illness';
    if (step.eventCategory === 'setback') return 'warning';
    if (step.effects.some((effect) => effect.target === 'money')) return 'bag';
    return 'heart';
  }

  protected newGame(): void {
    this.encounterDialog().nativeElement.close();
    this.phase.set('ready');
    this.landingPosition.set(7);
    this.cameraWeeks.set(0);
    this.state.set(
      this.origin
        ? this.engine.startNewGame(this.origin.name, toHeroStartingState(this.origin))
        : this.engine.startNewGame(),
    );
    this.displayedSteps.set(this.state().upcomingSteps);
  }
}
