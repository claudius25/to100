import {
  BLUEPRINT_TRAITS,
  rollLevel,
  secureRandom,
  toBlueprintResult,
  traitResult,
  type BlueprintResult,
  type RandomSource,
  type TraitResult,
} from '../model/starting-blueprint';

export type TowerStage = 'ready' | 'spinning' | 'waiting' | 'revealing' | 'done';

/** Rendering side of the tower. `done` callbacks may arrive after a reset and are ignored. */
export interface TowerVisual {
  reset(): void;
  spin(index: number, result: TraitResult, done: () => void): void;
  reveal(index: number, done: () => void): void;
}

export interface TowerListener {
  stageChanged(stage: TowerStage, activeIndex: number): void;
  traitDetermined(result: TraitResult): void;
  blueprintCompleted(result: BlueprintResult): void;
}

export interface TowerScheduler {
  setTimeout(callback: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

export interface TowerSequenceOptions {
  random?: RandomSource;
  settleDelayMs?: number;
  scheduler?: TowerScheduler;
}

const DEFAULT_SCHEDULER: TowerScheduler = {
  setTimeout: (callback, ms) => setTimeout(callback, ms),
  clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

/**
 * The single state machine shared by direct cube presses and the accessible
 * button: ready -> spinning -> waiting -> revealing -> ready, then done after
 * the fourth result. Each result is sampled exactly once per accepted press.
 */
export class BlueprintSequence {
  private currentStage: TowerStage = 'ready';
  private active = 0;
  private results: TraitResult[] = [];
  private generation = 0;
  private timer: unknown = null;
  private destroyed = false;
  private readonly random: RandomSource;
  private readonly settleDelayMs: number;
  private readonly scheduler: TowerScheduler;

  constructor(
    private readonly visual: TowerVisual,
    private readonly listener: TowerListener,
    options: TowerSequenceOptions = {},
  ) {
    this.random = options.random ?? secureRandom;
    this.settleDelayMs = options.settleDelayMs ?? 1000;
    this.scheduler = options.scheduler ?? DEFAULT_SCHEDULER;
  }

  get stage(): TowerStage {
    return this.currentStage;
  }

  get activeIndex(): number {
    return this.active;
  }

  get traitResults(): readonly TraitResult[] {
    return this.results;
  }

  /** Accepts a press only on the active cube while ready. Returns whether it rolled. */
  press(index = this.active): boolean {
    if (this.destroyed || this.currentStage !== 'ready' || index !== this.active) {
      return false;
    }
    const result = traitResult(this.active, rollLevel(this.random));
    const token = this.generation;
    this.setStage('spinning');
    this.visual.spin(this.active, result, () => this.spinFinished(token, result));
    return true;
  }

  reset(): void {
    if (this.destroyed) {
      return;
    }
    this.invalidate();
    this.active = 0;
    this.results = [];
    this.visual.reset();
    this.setStage('ready');
  }

  destroy(): void {
    this.invalidate();
    this.destroyed = true;
  }

  private spinFinished(token: number, result: TraitResult): void {
    if (token !== this.generation || this.currentStage !== 'spinning') {
      return;
    }
    this.results = [...this.results, result];
    this.setStage('waiting');
    this.listener.traitDetermined({ ...result });
    this.timer = this.scheduler.setTimeout(() => this.waitFinished(token), this.settleDelayMs);
  }

  private waitFinished(token: number): void {
    this.timer = null;
    if (token !== this.generation || this.currentStage !== 'waiting') {
      return;
    }
    if (this.active + 1 < BLUEPRINT_TRAITS.length) {
      this.active++;
      this.setStage('revealing');
      this.visual.reveal(this.active, () => this.revealFinished(token));
      return;
    }
    const blueprint = toBlueprintResult(this.results);
    this.setStage('done');
    if (blueprint) {
      this.listener.blueprintCompleted(blueprint);
    }
  }

  private revealFinished(token: number): void {
    if (token !== this.generation || this.currentStage !== 'revealing') {
      return;
    }
    this.setStage('ready');
  }

  private invalidate(): void {
    this.generation++;
    if (this.timer !== null) {
      this.scheduler.clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private setStage(stage: TowerStage): void {
    this.currentStage = stage;
    this.listener.stageChanged(stage, this.active);
  }
}
