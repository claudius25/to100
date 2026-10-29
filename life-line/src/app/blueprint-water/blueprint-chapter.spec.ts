import { BlueprintChapter, type ReliefRow, type WaterBlueprintResult } from './blueprint-chapter';
import { CHAPTER_TEXT, CHAPTER_TRAITS, MALE_NAMES } from './chapter.constants';
import { readBlueprintChapter, toHeroStartingState } from './hero-blueprint';
import { GameEngine } from '../simulation/model/game-engine';

function setup(samples = [0, 0, 0.25, 0.5, 0.99]) {
  const queue = [...samples];
  const random = vi.fn(() => queue.shift() ?? 0);
  const frames: ReliefRow[][] = [];
  const callbacks: (() => void)[] = [];
  const completed = vi.fn<(result: WaterBlueprintResult) => void>();
  const reset = vi.fn();
  const chapter = new BlueprintChapter(
    {
      present: (rows, done) => {
        frames.push(structuredClone([...rows]));
        callbacks.push(done);
      },
      reset,
    },
    vi.fn(),
    completed,
    random,
  );
  const finish = () => {
    const done = callbacks.shift();
    if (!done) throw new Error('No visual is pending.');
    done();
  };
  return { chapter, random, completed, frames, callbacks, finish, reset };
}

describe('BlueprintChapter', () => {
  it('has exactly 100 unique short male names and can select both endpoints', () => {
    expect(MALE_NAMES).toHaveLength(100);
    expect(new Set(MALE_NAMES).size).toBe(100);
    expect(MALE_NAMES.every((name) => name.length <= 6)).toBe(true);
    for (const [sample, name] of [
      [0, MALE_NAMES[0]],
      [0.99999, MALE_NAMES[99]],
    ] as const) {
      const { chapter, finish } = setup([sample]);
      chapter.advance();
      finish();
      chapter.advance();
      expect(chapter.snapshot.rows[0].value).toBe(name.toUpperCase());
    }
  });

  it('starts blank, reveals only Name on tap 1, and samples once on each later tap', () => {
    const ctx = setup();
    expect(ctx.chapter.snapshot.rows).toEqual([]);
    ctx.chapter.advance();
    expect(ctx.chapter.snapshot.rows).toEqual([
      { label: CHAPTER_TEXT.nameLabel, value: '', raised: true },
    ]);
    expect(ctx.random).not.toHaveBeenCalled();
    expect(ctx.chapter.advance()).toBe(false);
    ctx.finish();
    ctx.chapter.advance();
    expect(ctx.random).toHaveBeenCalledTimes(1);
    expect(ctx.chapter.snapshot.rows[0]).toEqual({
      label: CHAPTER_TEXT.nameLabel,
      value: MALE_NAMES[0].toUpperCase(),
      raised: false,
    });
    expect(ctx.chapter.snapshot.rows[1]).toEqual({
      label: CHAPTER_TRAITS[0].label,
      value: '',
      raised: true,
    });
    expect(ctx.chapter.advance()).toBe(false);
    ctx.finish();
    for (let i = 0; i < 4; i++) {
      expect(ctx.chapter.advance()).toBe(true);
      expect(ctx.chapter.advance()).toBe(false);
      const raised = ctx.chapter.snapshot.rows.filter((row) => row.raised);
      expect(raised.map((row) => row.label)).toEqual(i < 3 ? [CHAPTER_TRAITS[i + 1].label] : []);
      expect(ctx.chapter.snapshot.rows[i + 1].value).not.toBe('');
      ctx.finish();
    }
    expect(ctx.chapter.snapshot.rows.map((row) => [row.label, row.value, row.raised])).toEqual([
      [CHAPTER_TEXT.nameLabel, MALE_NAMES[0].toUpperCase(), false],
      [CHAPTER_TRAITS[0].label, '1. Fragile', false],
      [CHAPTER_TRAITS[1].label, '2. Modest', false],
      [CHAPTER_TRAITS[2].label, '3. Steady', false],
      [CHAPTER_TRAITS[3].label, '4. Connector', false],
    ]);
    expect(ctx.random).toHaveBeenCalledTimes(5);
    expect(ctx.chapter.stage).toBe('completed');
    expect(ctx.completed).toHaveBeenCalledExactlyOnceWith({
      name: MALE_NAMES[0].toUpperCase(),
      blueprint: { healthBlueprint: 1, familyFinances: 2, emotionalResilience: 3, socialSkills: 4 },
    });
    expect(ctx.chapter.advance()).toBe(false);
    expect(ctx.completed).toHaveBeenCalledTimes(1);
    expect(ctx.frames[0][0].value).toBe('');
    const snapshot = ctx.chapter.snapshot;
    snapshot.rows[0].value = 'Changed';
    expect(ctx.chapter.snapshot.rows[0].value).toBe(MALE_NAMES[0].toUpperCase());
  });

  it('ignores callbacks after reset or destruction and starts blank again', () => {
    const ctx = setup();
    ctx.chapter.advance();
    const stale = ctx.callbacks.shift()!;
    ctx.chapter.reset();
    stale();
    expect(ctx.chapter.snapshot).toEqual({ stage: 'ready', tap: 0, rows: [] });
    ctx.chapter.advance();
    ctx.chapter.destroy();
    ctx.finish();
    expect(ctx.chapter.advance()).toBe(false);
    expect(ctx.completed).not.toHaveBeenCalled();
    expect(ctx.reset).toHaveBeenCalledTimes(2);
  });

  it('emits completion only after the final label and value have recessed', () => {
    const ctx = setup();
    for (let i = 0; i < 5; i++) {
      ctx.chapter.advance();
      ctx.finish();
    }
    ctx.chapter.advance();
    expect(ctx.completed).not.toHaveBeenCalled();
    const done = ctx.callbacks.shift()!;
    done();
    done();
    expect(ctx.completed).toHaveBeenCalledTimes(1);
  });
});

describe('Hero blueprint chapter adapter', () => {
  const result: WaterBlueprintResult = {
    name: 'Leo',
    blueprint: { healthBlueprint: 1, familyFinances: 2, emotionalResilience: 3, socialSkills: 4 },
  };

  it('maps every level to 25/50/75/100, records chapter 1, and keeps personal resources separate', () => {
    const startingState = toHeroStartingState(result);
    const engine = new GameEngine(() => 0);
    const state = engine.startNewGame(result.name, startingState);
    expect(state.hero.name).toBe('Leo');
    expect(state.hero.blueprint).toEqual({
      physicalResilience: 25,
      familyFinances: 50,
      emotionalResilience: 75,
      socialSkills: 100,
    });
    expect(state.hero.resources.money).toBe(0);
    expect(state.hero.condition).toEqual({ health: 100, energy: 100, mood: 100 });
    expect(state.hero.ageWeeks).toBe(0);
    expect(state.hero.chapters).toEqual([startingState.chapter]);
    startingState.blueprint.familyFinances = 0;
    startingState.chapter.name = 'Changed';
    state.hero.chapters[0].blueprint.socialSkills = 0;
    expect(engine.getState().hero.chapters[0].name).toBe('Leo');
    expect(engine.getState().hero.blueprint.familyFinances).toBe(50);
    expect(engine.getState().hero.chapters[0].blueprint.socialSkills).toBe(100);
    engine.rollTurn();
    expect(engine.getState().history[0].heroAfter.chapters[0].name).toBe('Leo');
    expect(engine.startNewGame().hero.chapters).toEqual([]);
    expect(engine.getState().hero.blueprint.physicalResilience).toBe(50);
  });

  it('reads detached navigation payloads and explicitly rejects malformed chapters', () => {
    expect(readBlueprintChapter({ navigationId: 1 })).toBeNull();
    const parsed = readBlueprintChapter({ blueprintChapter: result });
    expect(parsed).toEqual(result);
    expect(parsed?.blueprint).not.toBe(result.blueprint);
    expect(() => readBlueprintChapter({ blueprintChapter: { ...result, name: '' } })).toThrow();
    for (const level of [0, 5, NaN, 1.1, '1', null]) {
      expect(() =>
        readBlueprintChapter({
          blueprintChapter: {
            ...result,
            blueprint: { ...result.blueprint, socialSkills: level },
          },
        }),
      ).toThrow('socialSkills');
    }
  });
});
