import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  output,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { BlueprintReveal } from './model/blueprint-reveal';
import {
  rollBlueprint,
  TRAIT_CARDS,
  TRAIT_KEYS,
  type StartingBlueprint,
  type TraitKey,
} from './model/starting-blueprint';
import { TraitCard } from './trait-card/trait-card';

type TickValues = Partial<Record<TraitKey, number>>;

@Component({
  selector: 'app-starting-blueprint',
  imports: [RouterLink, TraitCard],
  templateUrl: './starting-blueprint.html',
  styleUrl: './starting-blueprint.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StartingBlueprintPage {
  /**
   * There is no game-state store in the project yet, so the final blueprint is
   * surfaced as a typed event instead of being written to an invented store or
   * navigated to an invented route.
   */
  readonly beginLife = output<StartingBlueprint>();

  private readonly reveal = new BlueprintReveal();

  /** Decided once per roll; animation never writes to this. */
  private readonly results = signal<StartingBlueprint | null>(null);
  private readonly revealed = signal<ReadonlySet<TraitKey>>(new Set());
  private readonly ticks = signal<TickValues>({});

  protected readonly rolling = signal(false);
  protected readonly announcement = signal('');
  protected readonly started = signal(false);

  protected readonly cards = computed(() => {
    const results = this.results();
    const revealed = this.revealed();
    const ticks = this.ticks();
    const rolling = this.rolling();

    return TRAIT_CARDS.map((config) => {
      const isRevealed = revealed.has(config.key);
      const value = isRevealed
        ? (results?.[config.key] ?? null)
        : rolling
          ? (ticks[config.key] ?? null)
          : null;
      return { config, value, tumbling: rolling && !isRevealed };
    });
  });

  protected readonly complete = computed(
    () => this.results() !== null && this.revealed().size === TRAIT_KEYS.length,
  );

  protected readonly hasRolled = computed(() => this.results() !== null);
  protected readonly canBegin = computed(() => this.complete() && !this.rolling());
  protected readonly rollLabel = computed(() =>
    this.hasRolled() ? 'ROLL AGAIN' : 'ROLL YOUR BLUEPRINT',
  );

  constructor() {
    inject(DestroyRef).onDestroy(() => this.reveal.cancel());
  }

  protected roll(): void {
    if (this.rolling()) {
      return;
    }

    // Final results exist before the first frame of the animation.
    const outcome = rollBlueprint();
    this.results.set(outcome);
    this.revealed.set(new Set());
    this.ticks.set({});
    this.started.set(false);
    this.announcement.set('');
    this.rolling.set(true);

    this.reveal.start(
      TRAIT_KEYS,
      {
        onTick: (key, value) => this.ticks.update((current) => ({ ...current, [key]: value })),
        onReveal: (key) =>
          this.revealed.update((current) => {
            const next = new Set(current);
            next.add(key);
            return next;
          }),
        onComplete: () => {
          this.rolling.set(false);
          this.ticks.set({});
          this.announcement.set(this.summarise(outcome));
        },
      },
      prefersReducedMotion(),
    );
  }

  protected begin(): void {
    const outcome = this.results();
    if (!outcome || !this.canBegin()) {
      return;
    }
    this.started.set(true);
    this.announcement.set('Blueprint locked in. Your life is ready to begin.');
    this.beginLife.emit({ ...outcome });
  }

  private summarise(outcome: StartingBlueprint): string {
    const parts = TRAIT_CARDS.map(
      (card) => `${card.label}: ${outcome[card.key]} out of 6`,
    );
    return `Blueprint rolled. ${parts.join('. ')}.`;
  }
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}
