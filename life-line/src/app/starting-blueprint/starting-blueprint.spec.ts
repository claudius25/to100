import { BlueprintReveal } from './model/blueprint-reveal';
import {
  DIE_FACES,
  describeTrait,
  rollBlueprint,
  TRAIT_KEYS,
  type TraitKey,
} from './model/starting-blueprint';

describe('rollBlueprint', () => {
  it('returns an integer from 1 to 6 for every trait', () => {
    const seen = new Map<TraitKey, Set<number>>(TRAIT_KEYS.map((key) => [key, new Set<number>()]));

    for (let i = 0; i < 2000; i++) {
      const blueprint = rollBlueprint();
      for (const key of TRAIT_KEYS) {
        const value = blueprint[key];
        expect(Number.isInteger(value)).toBe(true);
        expect(value).toBeGreaterThanOrEqual(1);
        expect(value).toBeLessThanOrEqual(DIE_FACES);
        seen.get(key)?.add(value);
      }
    }

    // Every face should turn up for every trait, i.e. they are rolled independently.
    for (const key of TRAIT_KEYS) {
      expect(seen.get(key)?.size).toBe(DIE_FACES);
    }
  });
});

describe('describeTrait', () => {
  it('describes rolled and unrolled traits', () => {
    expect(describeTrait('Social Skills', 4)).toBe('Social Skills: 4 out of 6');
    expect(describeTrait('Social Skills', null)).toBe('Social Skills: not rolled yet');
  });
});

describe('BlueprintReveal', () => {
  it('reveals every trait immediately when reduced motion is requested', () => {
    const reveal = new BlueprintReveal();
    const revealed: TraitKey[] = [];
    let completed = 0;
    let ticks = 0;

    reveal.start(
      TRAIT_KEYS,
      {
        onTick: () => ticks++,
        onReveal: (key) => revealed.push(key),
        onComplete: () => completed++,
      },
      true,
    );

    expect(revealed).toEqual([...TRAIT_KEYS]);
    expect(completed).toBe(1);
    expect(ticks).toBe(0);
    reveal.cancel();
  });

  it('stops every timer when cancelled', async () => {
    const reveal = new BlueprintReveal();
    let calls = 0;

    reveal.start(
      TRAIT_KEYS,
      {
        onTick: () => calls++,
        onReveal: () => calls++,
        onComplete: () => calls++,
      },
      false,
    );
    reveal.cancel();

    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(calls).toBe(0);
  });
});
