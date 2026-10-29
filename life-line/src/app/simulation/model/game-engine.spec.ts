import { GameEngine } from './game-engine';
import { Hero } from './hero';
import { Step } from './step';
import { StepFactory } from './step-factory';
import { STEP_TEMPLATES } from './step-templates';
import { TARGET_AGE_WEEKS, type Effect, type StepTemplate } from './types';

function event(effects: readonly Effect[] = []): Extract<StepTemplate, { kind: 'event' }> {
  return {
    id: 'test-event',
    kind: 'event',
    eventCategory: 'mixed',
    title: 'Test encounter',
    description: 'A deterministic encounter.',
    minAgeWeeks: 0,
    maxAgeWeeks: null,
    weight: 1,
    effects,
  };
}

describe('Hero and Step', () => {
  it('initializes all state and derives age without duplicate stored age values', () => {
    const hero = new Hero('hero-id', 'Alex');
    expect(hero.snapshot()).toEqual({
      id: 'hero-id',
      name: 'Alex',
      ageWeeks: 0,
      ageYears: 0,
      ageRemainingWeeks: 0,
      blueprint: {
        physicalResilience: 50,
        emotionalResilience: 50,
        familyFinances: 50,
        socialSkills: 50,
      },
      condition: { health: 100, energy: 100, mood: 100 },
      resources: { money: 0 },
      habits: [],
      skills: [],
      assets: [],
      job: null,
      friends: [],
      partner: null,
      superpowers: [],
      inventory: [],
      chapters: [],
    });
    hero.ageWeeks = 2 * 52 + 7;
    expect(hero.ageYears).toBe(2);
    expect(hero.ageRemainingWeeks).toBe(7);
    expect(Object.hasOwn(hero, 'ageYears')).toBe(false);
    expect(Object.hasOwn(hero, 'ageRemainingWeeks')).toBe(false);
    hero.resources.money = 25;
    expect(hero.blueprint.familyFinances).toBe(50);
  });

  it('copies encounter data without mutating templates or a hero', () => {
    const template = event([{ target: 'health', amount: -10 }]);
    const hero = new Hero('one', 'Hero');
    const step = new Step('instance', template);
    expect(step.templateId).toBe(template.id);
    expect(step.effects).toEqual(template.effects);
    expect(step.effects).not.toBe(template.effects);
    expect(hero.condition.health).toBe(100);
  });
});

describe('StepFactory', () => {
  it('filters age before applying relative weights and respects exact boundaries', () => {
    const templates: StepTemplate[] = [
      { ...event(), id: 'young', minAgeWeeks: 0, maxAgeWeeks: 260, weight: 1000 },
      { ...event(), id: 'older-a', minAgeWeeks: 260, weight: 1 },
      { ...event(), id: 'older-b', minAgeWeeks: 260, weight: 3 },
    ];
    let value = 0;
    const factory = new StepFactory(() => value, templates);
    expect(factory.createStep(259).templateId).toBe('young');
    expect(factory.eligibleTemplates(260).map((template) => template.id)).toEqual([
      'older-a',
      'older-b',
    ]);
    expect(factory.createStep(260).templateId).toBe('older-a');
    value = 0.249999;
    expect(factory.createStep(260).templateId).toBe('older-a');
    value = 0.25;
    expect(factory.createStep(260).templateId).toBe('older-b');
    value = 0.999999;
    expect(factory.createStep(5200).templateId).toBe('older-b');
  });

  it('includes common empty encounters and covers every age band', () => {
    const factory = new StepFactory(() => 0);
    for (const age of [0, 259, 260, 727, 728, 1299, 1300, 3119, 3120, 5200]) {
      const eligible = factory.eligibleTemplates(age);
      const emptyWeight = eligible
        .filter((template) => template.kind === 'empty')
        .reduce((sum, template) => sum + template.weight, 0);
      const totalWeight = eligible.reduce((sum, template) => sum + template.weight, 0);
      expect(emptyWeight / totalWeight).toBeGreaterThan(0.5);
      expect(eligible.some((template) => template.kind !== 'empty')).toBe(true);
      expect(factory.createStep(age).kind).toBe('empty');
    }
    expect(new Set(STEP_TEMPLATES.map((template) => template.id)).size).toBe(STEP_TEMPLATES.length);
  });

  it('builds twelve independent instances using each landing age, including band transitions', () => {
    const factory = new StepFactory(
      () => 0,
      [
        { ...event(), id: 'young', maxAgeWeeks: 260 },
        { ...event(), id: 'school', minAgeWeeks: 260 },
      ],
    );
    const steps = factory.buildUpcomingSteps(254);
    expect(steps).toHaveLength(12);
    expect(steps[0].kind).toBe('empty');
    expect(steps[0].effects).toEqual([]);
    expect(steps.slice(1, 5).every((step) => step.templateId === 'young')).toBe(true);
    expect(steps.slice(5).every((step) => step.templateId === 'school')).toBe(true);
    expect(new Set(steps.map((step) => step.id)).size).toBe(12);
    expect(factory.buildUpcomingSteps(254)[0].id).not.toBe(steps[0].id);
  });

  it('caps every generated landing age at the target', () => {
    const factory = new StepFactory(() => 0);
    const create = vi.spyOn(factory, 'createStep');
    factory.buildUpcomingSteps(5197);
    expect(create.mock.calls.map(([age]) => age)).toEqual([
      5199, 5200, 5200, 5200, 5200, 5200, 5200, 5200, 5200, 5200, 5200,
    ]);
  });

  it('preserves the tail and appends only the missing tiles at their correct future ages', () => {
    const factory = new StepFactory(
      () => 0,
      [
        { ...event(), id: 'young', maxAgeWeeks: 260 },
        { ...event(), id: 'school', minAgeWeeks: 260 },
      ],
    );
    const initial = factory.buildUpcomingSteps(245);
    const create = vi.spyOn(factory, 'createStep');
    const next = factory.advanceUpcomingSteps(initial, 251, 6);
    expect(next).toHaveLength(12);
    expect(next.slice(0, 6)).toEqual(initial.slice(6));
    expect(create.mock.calls.map(([age]) => age)).toEqual([258, 259, 260, 261, 262, 263]);
    expect(next.slice(6).map((step) => step.templateId)).toEqual([
      'young',
      'young',
      'school',
      'school',
      'school',
      'school',
    ]);
    expect(new Set(next.map((step) => step.id)).size).toBe(12);
    const capped = vi.spyOn(factory, 'createStep');
    capped.mockClear();
    factory.advanceUpcomingSteps(next, 5199, 6);
    expect(capped.mock.calls.every(([age]) => age === 5200)).toBe(true);
  });

  it('reports missing eligible templates and invalid probability inputs explicitly', () => {
    expect(() => new StepFactory(() => 0, []).createStep(0)).toThrow('No encounter');
    expect(() => new StepFactory(() => 0, [{ ...event(), weight: -1 }])).toThrow('weights');
    for (const invalid of [-0.1, 1, NaN, Infinity]) {
      expect(() => new StepFactory(() => invalid).createStep(0)).toThrow('Random source');
    }
  });
});

describe('GameEngine', () => {
  it('rolls every dice face and advances age by the correct sum', () => {
    let value = 0;
    const engine = new GameEngine(() => value, [event()]);
    let age = 0;
    for (let face = 1; face <= 6; face++) {
      value = (face - 1) / 6;
      const result = engine.rollTurn()!;
      expect(result.dice).toEqual([face, face]);
      expect(result.diceSum).toBe(face * 2);
      expect(result.weeksAdvanced).toBe(face * 2);
      expect(result.ageBefore).toBe(age);
      age += face * 2;
      expect(result.ageAfter).toBe(age);
      expect(result.turnNumber).toBe(face);
      expect(result.status).toBe('playing');
    }
    expect(engine.getState().hero.ageWeeks).toBe(age);
  });

  it('rolls the two dice independently', () => {
    const values = Array(11).fill(0).concat([0, 0.999999], Array(7).fill(0));
    const engine = new GameEngine(() => values.shift()!, [event()]);
    const result = engine.rollTurn()!;
    expect(result.dice).toEqual([1, 6]);
    expect(result.diceSum).toBe(7);
  });

  it('applies only the landing offset, preserves steps ahead and refills to twelve', () => {
    const values = Array.from({ length: 11 }, (_, index) => (index === 6 ? 0.9 : 0));
    const engine = new GameEngine(
      () => values.shift() ?? 0.5,
      [
        { ...event([{ target: 'money', amount: 1 }]), id: 'crossed' },
        { ...event([{ target: 'money', amount: 100 }]), id: 'landing' },
      ],
    );
    const before = engine.getState().upcomingSteps;
    const result = engine.rollTurn()!;
    expect(result.diceSum).toBe(8);
    expect(result.resolvedStep).toEqual(before[7]);
    expect(result.appliedChanges.money).toBe(100);
    expect(engine.getState().hero.resources.money).toBe(100);
    const next = engine.getState().upcomingSteps;
    expect(next).toHaveLength(12);
    expect(next.slice(0, 4)).toEqual(before.slice(8));
    expect(next.slice(4).every((step) => !before.some((old) => old.id === step.id))).toBe(true);
  });

  it('clamps conditions to 0..100 and money to 0 while reporting actual net changes', () => {
    const engine = new GameEngine(
      () => 0,
      [
        event([
          { target: 'health', amount: -150 },
          { target: 'energy', amount: -25 },
          { target: 'mood', amount: 10 },
          { target: 'money', amount: -40 },
          { target: 'money', amount: 10 },
        ]),
      ],
    );
    const result = engine.rollTurn()!;
    expect(result.appliedChanges).toEqual({ health: -100, energy: -25, mood: 0, money: 10 });
    expect(result.heroAfter.condition).toEqual({ health: 0, energy: 75, mood: 100 });
    expect(result.status).toBe('playing');
    expect(engine.rollTurn()!.appliedChanges.health).toBe(0);

    const upper = new GameEngine(
      () => 0,
      [
        event([
          { target: 'health', amount: -5 },
          { target: 'health', amount: 50 },
          { target: 'energy', amount: 20 },
          { target: 'mood', amount: -200 },
          { target: 'money', amount: 1000 },
        ]),
      ],
    ).rollTurn()!;
    expect(upper.heroAfter.condition).toEqual({ health: 100, energy: 100, mood: 0 });
    expect(upper.appliedChanges).toEqual({ health: 0, energy: 0, mood: -100, money: 1000 });
  });

  it('does not apply passive effects or effects on empty steps', () => {
    const engine = new GameEngine(
      () => 0,
      [
        {
          ...event([{ target: 'money', amount: 50 }]),
          kind: 'empty',
          eventCategory: undefined,
        },
      ],
    );
    const result = engine.rollTurn()!;
    expect(result.appliedChanges).toEqual({ health: 0, energy: 0, mood: 0, money: 0 });
    expect(result.heroAfter.condition).toEqual({ health: 100, energy: 100, mood: 100 });
  });

  it.each(['consumable', 'collectible'] as const)('handles %s items correctly', (behavior) => {
    const engine = new GameEngine(
      () => 0,
      [
        {
          id: 'item',
          kind: 'item',
          itemBehavior: behavior,
          title: 'Item',
          description: 'Test item',
          minAgeWeeks: 0,
          maxAgeWeeks: null,
          weight: 1,
          effects: [{ target: 'money', amount: 25 }],
        },
      ],
    );
    const result = engine.rollTurn()!;
    const collectible = behavior === 'collectible';
    expect(result.appliedChanges.money).toBe(collectible ? 0 : 25);
    expect(result.heroAfter.resources.money).toBe(collectible ? 0 : 25);
    expect(result.heroAfter.inventory).toHaveLength(collectible ? 1 : 0);
    if (collectible) {
      expect(result.heroAfter.inventory[0]).toEqual(result.resolvedStep);
    }
  });

  it('isolates history, returned results, state reads, templates and later turns', () => {
    const effects: Effect[] = [{ target: 'money', amount: 5 }];
    const engine = new GameEngine(() => 0, [event(effects)]);
    const first = engine.rollTurn()!;
    const saved = structuredClone(engine.getState().history[0]);
    effects[0].amount = 999;
    first.heroAfter.blueprint.familyFinances = 0;
    first.heroAfter.resources.money = 1000;
    first.appliedChanges.money = 2000;
    const snapshot = engine.getState();
    snapshot.hero.condition.health = 0;
    snapshot.hero.inventory.push(snapshot.upcomingSteps[0]);
    snapshot.upcomingSteps[0].effects[0].amount = 3000;
    snapshot.history[0].heroAfter.resources.money = 4000;
    snapshot.history[0].dice[0] = 6;
    engine.rollTurn();
    const after = engine.getState();
    expect(after.history[0]).toEqual(saved);
    expect(after.hero.resources.money).toBe(10);
    expect(after.hero.condition.health).toBe(100);
    expect(after.hero.inventory).toEqual([]);
    expect(after.hero.blueprint.familyFinances).toBe(50);
  });

  it.each([
    { random: 0.7, turns: 520, lastWeeks: 10 },
    { random: 0.999999, turns: 434, lastWeeks: 4 },
  ])(
    'finishes at exactly 100 years with $lastWeeks final weeks',
    ({ random, turns, lastWeeks }) => {
      const source = vi.fn(() => random);
      const engine = new GameEngine(source, [event([{ target: 'money', amount: 1 }])]);
      for (let turn = 1; turn < turns; turn++) {
        expect(engine.rollTurn()!.status).toBe('playing');
      }
      const result = engine.rollTurn()!;
      expect(result.status).toBe('completed');
      expect(result.ageAfter).toBe(TARGET_AGE_WEEKS);
      expect(result.weeksAdvanced).toBe(lastWeeks);
      expect(result.resolvedStep).toBeNull();
      expect(result.appliedChanges).toEqual({ health: 0, energy: 0, mood: 0, money: 0 });
      const finalState = engine.getState();
      expect(finalState.hero.ageYears).toBe(100);
      expect(finalState.hero.ageRemainingWeeks).toBe(0);
      expect(finalState.hero.resources.money).toBe(turns - 1);
      expect(finalState.history).toHaveLength(turns);
      expect(finalState.upcomingSteps).toHaveLength(0);
      const calls = source.mock.calls.length;
      expect(engine.rollTurn()).toBeNull();
      expect(engine.rollTurn()).toBeNull();
      expect(engine.getState()).toEqual(finalState);
      expect(source).toHaveBeenCalledTimes(calls);

      const reset = engine.startNewGame('New hero');
      expect(reset.status).toBe('playing');
      expect(reset.turnNumber).toBe(0);
      expect(reset.history).toEqual([]);
      expect(reset.hero).toEqual(new Hero(reset.hero.id, 'New hero').snapshot());
      expect(reset.hero.id).not.toBe(finalState.hero.id);
      expect(reset.upcomingSteps).toHaveLength(12);
      expect(reset.upcomingSteps[0].kind).toBe('empty');
      expect(engine.rollTurn()!.turnNumber).toBe(1);
    },
  );
});
