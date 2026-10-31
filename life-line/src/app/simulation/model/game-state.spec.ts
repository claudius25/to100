import { GameEngine } from './game-engine';
import { readGameState } from './game-state';
import { TARGET_AGE_WEEKS } from './types';

describe('Saved game restoration', () => {
  it('round-trips all progress and continues with independent snapshots and unique encounters', () => {
    const engine = new GameEngine(() => 0);
    for (let index = 0; index < 5; index++) engine.rollTurn();
    const saved = engine.getState();
    const restored = new GameEngine(() => 0);
    expect(restored.restoreState(JSON.parse(JSON.stringify(saved)))).toEqual(saved);
    const ids = new Set(saved.upcomingSteps.map((step) => step.id));
    const result = restored.rollTurn()!;
    expect(result.turnNumber).toBe(6);
    expect(result.ageBefore).toBe(saved.hero.ageWeeks);
    expect(
      restored
        .getState()
        .upcomingSteps.slice(-2)
        .every((step) => !ids.has(step.id)),
    ).toBe(true);
    saved.hero.condition.health = 0;
    saved.history[0].heroAfter.condition.health = 0;
    expect(restored.getState().history[0].heroAfter.condition.health).toBe(100);
  });

  it('rehydrates age from weeks, not stored duplicate age values', () => {
    const engine = new GameEngine(() => 0);
    for (let index = 0; index < 27; index++) engine.rollTurn();
    const state = engine.getState();
    expect(new GameEngine(() => 0).restoreState(state).hero.ageYears).toBe(1);
    expect(() => readGameState({ ...state, hero: { ...state.hero, ageYears: 90 } })).toThrow(
      'Invalid saved game state',
    );
  });

  it('restores a completed life without permitting further rolls', () => {
    const engine = new GameEngine(() => 0.99);
    while (engine.rollTurn()) {}
    const saved = engine.getState();
    const restored = new GameEngine(() => 0);
    restored.restoreState(saved);
    expect(restored.getState().hero.ageWeeks).toBe(TARGET_AGE_WEEKS);
    expect(restored.rollTurn()).toBeNull();
    expect(restored.getState()).toEqual(saved);
  });

  it('rejects malformed saves without changing the engine', () => {
    const engine = new GameEngine(() => 0);
    const before = engine.getState();
    const invalid = engine.getState();
    invalid.hero.resources.money = -1;
    expect(() => engine.restoreState(invalid)).toThrow();
    expect(engine.getState()).toEqual(before);
    expect(() => readGameState({ ...before, upcomingSteps: [] })).toThrow();
    expect(() => readGameState({ ...before, turnNumber: 1 })).toThrow();
  });
});
