import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  NgZone,
  output,
  PLATFORM_ID,
  signal,
  viewChild,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  BLUEPRINT_LEVEL_COUNT,
  BLUEPRINT_TRAITS,
  describeTraitResult,
  type BlueprintResult,
  type RandomSource,
  type TraitResult,
} from '../model/starting-blueprint';
import { BlueprintSequence, type TowerStage, type TowerVisual } from './blueprint-sequence';
import {
  cubeSize,
  DEFAULT_TOWER_TIMINGS,
  REDUCED_MOTION_TOWER_TIMINGS,
  revealDuration,
  type TowerTimings,
} from './tower-animation';
import { BlueprintTowerScene, isWebGLAvailable } from './tower-scene';

type RenderMode = 'pending' | 'webgl' | 'fallback';

/** Accessible non-WebGL visual: same sequence, timed CSS states instead of a 3D scene. */
class TimedTowerVisual implements TowerVisual {
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();

  constructor(private readonly timings: TowerTimings) {}

  reset(): void {
    this.dispose();
  }

  spin(_index: number, _result: TraitResult, done: () => void): void {
    this.after(this.timings.spinMs, done);
  }

  reveal(_index: number, done: () => void): void {
    this.after(revealDuration(this.timings) * 1000, done);
  }

  dispose(): void {
    this.timers.forEach((timer) => clearTimeout(timer));
    this.timers.clear();
  }

  private after(ms: number, done: () => void): void {
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      done();
    }, ms);
    this.timers.add(timer);
  }
}

@Component({
  selector: 'app-blueprint-tower',
  templateUrl: './blueprint-tower.html',
  styleUrl: './blueprint-tower.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BlueprintTower {
  /** Overrides for animation timings; defaults follow the prototype. */
  readonly timings = input<Partial<TowerTimings>>({});
  /** Injectable for deterministic tests; defaults to crypto-backed sampling. */
  readonly random = input<RandomSource | undefined>(undefined);

  readonly traitDetermined = output<TraitResult>();
  readonly blueprintCompleted = output<BlueprintResult>();
  readonly restarted = output<void>();

  private readonly zone = inject(NgZone);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly stageHost = viewChild.required<ElementRef<HTMLDivElement>>('stage');
  private sequence: BlueprintSequence | null = null;
  private scene: BlueprintTowerScene | null = null;
  private fallback: TimedTowerVisual | null = null;

  protected readonly traits = BLUEPRINT_TRAITS;
  protected readonly levelCount = BLUEPRINT_LEVEL_COUNT;
  protected readonly stage = signal<TowerStage>('ready');
  protected readonly activeIndex = signal(0);
  protected readonly results = signal<readonly TraitResult[]>([]);
  protected readonly renderMode = signal<RenderMode>('pending');
  protected readonly announcement = signal('');

  protected readonly activeTrait = computed(() => BLUEPRINT_TRAITS[this.activeIndex()]);
  protected readonly canAct = computed(
    () => this.renderMode() !== 'pending' && (this.stage() === 'ready' || this.stage() === 'done'),
  );
  protected readonly buttonLabel = computed(() =>
    this.stage() === 'done'
      ? 'Build a new blueprint'
      : `Reveal ${this.activeTrait().name.toLowerCase()}`,
  );
  protected readonly hint = computed(() => {
    const trait = this.activeTrait();
    switch (this.stage()) {
      case 'ready':
        return `Tap the ${trait.colorName} cube to roll`;
      case 'spinning':
        return `Discovering your ${trait.name.toLowerCase()}…`;
      case 'waiting':
        return `${trait.name}: ${this.results()[this.activeIndex()]?.label ?? ''}`;
      case 'revealing':
        return 'Your next trait is unfolding…';
      case 'done':
        return 'Your starting blueprint is complete. Your story can change it.';
    }
  });
  protected readonly rows = computed(() => {
    const results = this.results();
    const active = this.activeIndex();
    const done = this.stage() === 'done';
    return BLUEPRINT_TRAITS.map((trait, index) => {
      const result = results[index];
      const value = result
        ? `${result.label} · ${result.level}/${BLUEPRINT_LEVEL_COUNT}`
        : index === active && !done
          ? 'Awaiting your touch'
          : '—';
      return { trait, value };
    });
  });
  protected readonly fallbackCubes = computed(() => {
    const stage = this.stage();
    const active = this.activeIndex();
    const results = this.results();
    return BLUEPRINT_TRAITS.slice(0, active + 1).map((trait, index) => ({
      index,
      trait,
      size: Math.round(60 * cubeSize(index)),
      result: results[index] ?? null,
      spinning: stage === 'spinning' && index === active,
      emerging: stage === 'revealing' && index === active,
      pressable: stage === 'ready' && index === active,
    }));
  });

  constructor() {
    afterNextRender(() => this.initialise());
    inject(DestroyRef).onDestroy(() => this.teardown());
  }

  protected primaryAction(): void {
    if (this.stage() === 'done') {
      this.restart();
    } else {
      this.press(this.activeIndex());
    }
  }

  protected press(index: number): void {
    this.sequence?.press(index);
  }

  protected restart(): void {
    if (!this.sequence) {
      return;
    }
    this.sequence.reset();
    this.announcement.set('Blueprint cleared. Tap the green cube to begin again.');
    this.restarted.emit();
  }

  private initialise(): void {
    if (!this.isBrowser || this.sequence) {
      return;
    }
    const timings: TowerTimings = {
      ...(prefersReducedMotion() ? REDUCED_MOTION_TOWER_TIMINGS : DEFAULT_TOWER_TIMINGS),
      ...this.timings(),
    };

    let visual: TowerVisual | null = null;
    if (isWebGLAvailable()) {
      // The render loop and pointer handlers stay outside Angular; only state changes enter it.
      visual = this.zone.runOutsideAngular(() => {
        const scene = new BlueprintTowerScene(
          this.stageHost().nativeElement,
          (index) => this.zone.run(() => this.press(index)),
          timings,
        );
        try {
          scene.init();
          this.scene = scene;
          return scene;
        } catch {
          scene.dispose();
          return null;
        }
      });
    }
    if (!visual) {
      this.fallback = new TimedTowerVisual(timings);
      visual = this.fallback;
    }
    this.renderMode.set(this.scene ? 'webgl' : 'fallback');

    this.sequence = new BlueprintSequence(
      visual,
      {
        stageChanged: (stage, activeIndex) =>
          this.zone.run(() => {
            this.stage.set(stage);
            this.activeIndex.set(activeIndex);
            this.results.set([...(this.sequence?.traitResults ?? [])]);
            this.scene?.setInteractive(stage === 'ready' ? activeIndex : null);
          }),
        traitDetermined: (result) =>
          this.zone.run(() => {
            this.results.set([...(this.sequence?.traitResults ?? [])]);
            this.announcement.set(describeTraitResult(result));
            this.traitDetermined.emit(result);
          }),
        blueprintCompleted: (result) =>
          this.zone.run(() => {
            this.announcement.set('Your starting blueprint is complete.');
            this.blueprintCompleted.emit(result);
          }),
      },
      { settleDelayMs: timings.settleDelayMs, random: this.random() },
    );
    this.sequence.reset();
  }

  private teardown(): void {
    this.sequence?.destroy();
    this.sequence = null;
    this.scene?.dispose();
    this.scene = null;
    this.fallback?.dispose();
    this.fallback = null;
  }
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}
