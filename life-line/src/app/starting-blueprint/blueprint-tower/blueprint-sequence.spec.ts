import type { BlueprintResult, TraitResult } from '../model/starting-blueprint';
import {
  BlueprintSequence,
  type TowerListener,
  type TowerScheduler,
  type TowerStage,
  type TowerVisual,
} from './blueprint-sequence';

class FakeVisual implements TowerVisual {
  resets = 0;
  spins: { index: number; result: TraitResult; done: () => void }[] = [];
  reveals: { index: number; done: () => void }[] = [];

  reset(): void {
    this.resets++;
  }
  spin(index: number, result: TraitResult, done: () => void): void {
    this.spins.push({ index, result, done });
  }
  reveal(index: number, done: () => void): void {
    this.reveals.push({ index, done });
  }
}

class FakeScheduler implements TowerScheduler {
  pending: { callback: () => void; ms: number; handle: number }[] = [];
  private next = 0;

  setTimeout(callback: () => void, ms: number): unknown {
    const handle = ++this.next;
    this.pending.push({ callback, ms, handle });
    return handle;
  }
  clearTimeout(handle: unknown): void {
    this.pending = this.pending.filter((entry) => entry.handle !== handle);
  }
  flush(): void {
    const due = this.pending;
    this.pending = [];
    due.forEach((entry) => entry.callback());
  }
}

function setup(randomValues: number[] = [0.9, 0.1, 0.6, 0.3]) {
  const visual = new FakeVisual();
  const scheduler = new FakeScheduler();
  const stages: TowerStage[] = [];
  const traits: TraitResult[] = [];
  const completed: BlueprintResult[] = [];
  const listener: TowerListener = {
    stageChanged: (stage) => stages.push(stage),
    traitDetermined: (result) => traits.push(result),
    blueprintCompleted: (result) => completed.push(result),
  };
  const values = [...randomValues];
  const random = vi.fn(() => values.shift() ?? 0);
  const sequence = new BlueprintSequence(visual, listener, { scheduler, random });
  sequence.reset();
  stages.length = 0;
  return { sequence, visual, scheduler, stages, traits, completed, random };
}

function completeRound(ctx: ReturnType<typeof setup>): void {
  ctx.sequence.press();
  ctx.visual.spins.at(-1)!.done();
  ctx.scheduler.flush();
  ctx.visual.reveals.at(-1)?.done();
}

describe('BlueprintSequence', () => {
  it('follows ready -> spinning -> waiting -> revealing -> ready, then done', () => {
    const ctx = setup();
    for (let i = 0; i < 4; i++) {
      completeRound(ctx);
    }

    expect(ctx.stages).toEqual([
      ...Array(3).fill(['spinning', 'waiting', 'revealing', 'ready']).flat(),
      'spinning',
      'waiting',
      'done',
    ]);
    expect(ctx.visual.reveals.map((reveal) => reveal.index)).toEqual([1, 2, 3]);
  });

  it('samples exactly one result per accepted press and locks input while busy', () => {
    const ctx = setup();

    expect(ctx.sequence.press()).toBe(true);
    expect(ctx.sequence.press()).toBe(false);
    expect(ctx.sequence.press(0)).toBe(false);
    expect(ctx.random).toHaveBeenCalledTimes(1);
    expect(ctx.visual.spins).toHaveLength(1);

    ctx.visual.spins[0].done();
    ctx.visual.spins[0].done();
    expect(ctx.sequence.press()).toBe(false);
    expect(ctx.traits).toEqual([{ trait: 'healthBlueprint', level: 4, label: 'Robust' }]);
  });

  it('ignores presses on a cube other than the active one', () => {
    const ctx = setup();
    expect(ctx.sequence.press(1)).toBe(false);
    expect(ctx.random).not.toHaveBeenCalled();
  });

  it('waits one second after a roll before revealing the next cube', () => {
    const ctx = setup();
    ctx.sequence.press();
    ctx.visual.spins[0].done();

    expect(ctx.scheduler.pending.map((entry) => entry.ms)).toEqual([1000]);
    expect(ctx.visual.reveals).toHaveLength(0);
    ctx.scheduler.flush();
    expect(ctx.visual.reveals).toHaveLength(1);
  });

  it('emits completion once with every trait level', () => {
    const ctx = setup();
    for (let i = 0; i < 4; i++) {
      completeRound(ctx);
    }
    ctx.scheduler.flush();
    ctx.visual.spins.at(-1)!.done();

    expect(ctx.traits).toHaveLength(4);
    expect(ctx.completed).toEqual([
      { healthBlueprint: 4, familyFinances: 1, emotionalResilience: 3, socialSkills: 2 },
    ]);
    expect(ctx.sequence.press()).toBe(false);
  });

  it('drops stale spin, timer and reveal callbacks after reset', () => {
    const ctx = setup();
    ctx.sequence.press();
    const staleSpin = ctx.visual.spins[0];
    ctx.sequence.reset();
    staleSpin.done();
    expect(ctx.traits).toHaveLength(0);

    ctx.sequence.press();
    ctx.visual.spins[1].done();
    ctx.sequence.reset();
    expect(ctx.scheduler.pending).toHaveLength(0);

    completeRound(ctx);
    ctx.sequence.press();
    ctx.visual.spins.at(-1)!.done();
    ctx.scheduler.flush();
    const staleReveal = ctx.visual.reveals.at(-1)!;
    ctx.sequence.reset();
    staleReveal.done();

    expect(ctx.sequence.stage).toBe('ready');
    expect(ctx.sequence.activeIndex).toBe(0);
    expect(ctx.sequence.traitResults).toHaveLength(0);
  });

  it('emits nothing after destroy', () => {
    const ctx = setup();
    ctx.sequence.press();
    const spin = ctx.visual.spins[0];
    ctx.sequence.destroy();
    spin.done();
    ctx.scheduler.flush();

    expect(ctx.traits).toHaveLength(0);
    expect(ctx.sequence.press()).toBe(false);
  });
});
