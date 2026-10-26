import { DIE_FACES, type TraitKey } from './starting-blueprint';

export interface RevealHandlers {
  /** A throwaway value shown while the die is still tumbling. */
  onTick(key: TraitKey, value: number): void;
  /** The card may now show its final, already-decided result. */
  onReveal(key: TraitKey): void;
  onComplete(): void;
}

const TICK_INTERVAL_MS = 70;
const FIRST_REVEAL_MS = 420;
const STAGGER_MS = 180;
const SETTLE_MS = 80;

/**
 * Owns the reveal timing only.
 *
 * It never sees the rolled blueprint: it just emits throwaway tick values and
 * tells the page when each card may show the result it already holds, so a
 * stray timer can never overwrite a final value.
 */
export class BlueprintReveal {
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();
  private ticker: ReturnType<typeof setInterval> | null = null;
  private pending = new Set<TraitKey>();

  /** Total animation length, used by the page for its button state only. */
  static durationMs(count: number): number {
    return FIRST_REVEAL_MS + Math.max(0, count - 1) * STAGGER_MS + SETTLE_MS;
  }

  /**
   * @param reducedMotion when true everything resolves synchronously, as
   * required by `prefers-reduced-motion`.
   */
  start(keys: readonly TraitKey[], handlers: RevealHandlers, reducedMotion: boolean): void {
    this.cancel();

    if (reducedMotion) {
      for (const key of keys) {
        handlers.onReveal(key);
      }
      handlers.onComplete();
      return;
    }

    this.pending = new Set(keys);

    this.ticker = setInterval(() => {
      for (const key of this.pending) {
        handlers.onTick(key, 1 + Math.floor(Math.random() * DIE_FACES));
      }
    }, TICK_INTERVAL_MS);

    keys.forEach((key, index) => {
      this.schedule(() => {
        this.pending.delete(key);
        handlers.onReveal(key);
      }, FIRST_REVEAL_MS + index * STAGGER_MS);
    });

    this.schedule(() => {
      this.stopTicker();
      handlers.onComplete();
    }, BlueprintReveal.durationMs(keys.length));
  }

  cancel(): void {
    this.stopTicker();
    for (const timer of this.timers) {
      clearTimeout(timer);
    }
    this.timers.clear();
    this.pending.clear();
  }

  private schedule(action: () => void, delay: number): void {
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      action();
    }, delay);
    this.timers.add(timer);
  }

  private stopTicker(): void {
    if (this.ticker !== null) {
      clearInterval(this.ticker);
      this.ticker = null;
    }
  }
}
