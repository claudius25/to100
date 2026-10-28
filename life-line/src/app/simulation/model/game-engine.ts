import { Hero } from './hero';
import { Step } from './step';
import { StepFactory } from './step-factory';
import { STEP_TEMPLATES } from './step-templates';
import {
  TARGET_AGE_WEEKS,
  type Changes,
  type GameState,
  type GameStatus,
  type RandomSource,
  type StepTemplate,
  type TurnResult,
} from './types';

export class GameEngine {
  private hero!: Hero;
  private upcomingSteps: Step[] = [];
  private turnNumber = 0;
  private status: GameStatus = 'playing';
  private history: TurnResult[] = [];
  private gameNumber = 0;
  private readonly stepFactory: StepFactory;

  constructor(
    private readonly random: RandomSource = Math.random,
    templates: readonly StepTemplate[] = STEP_TEMPLATES,
  ) {
    this.stepFactory = new StepFactory(random, templates);
    this.startNewGame();
  }

  startNewGame(name = 'Hero'): GameState {
    this.hero = new Hero(`hero-${++this.gameNumber}`, name);
    this.turnNumber = 0;
    this.status = 'playing';
    this.history = [];
    this.upcomingSteps = this.stepFactory.buildUpcomingSteps(this.hero.ageWeeks);
    return this.getState();
  }

  rollTurn(): TurnResult | null {
    if (this.status === 'completed') {
      return null;
    }

    const dice: [number, number] = [this.rollDie(), this.rollDie()];
    const diceSum = dice[0] + dice[1];
    const ageBefore = this.hero.ageWeeks;
    const weeksAdvanced = Math.min(diceSum, TARGET_AGE_WEEKS - ageBefore);
    this.hero.ageWeeks += weeksAdvanced;
    this.turnNumber++;

    let resolvedStep: Step | null = null;
    let appliedChanges: Changes = { health: 0, energy: 0, mood: 0, money: 0 };
    if (this.hero.ageWeeks === TARGET_AGE_WEEKS) {
      this.status = 'completed';
    } else {
      resolvedStep = this.upcomingSteps[diceSum - 1];
      appliedChanges = this.resolveStep(resolvedStep);
    }

    const result: TurnResult = {
      turnNumber: this.turnNumber,
      dice,
      diceSum,
      weeksAdvanced,
      ageBefore,
      ageAfter: this.hero.ageWeeks,
      resolvedStep: structuredClone(resolvedStep),
      appliedChanges,
      status: this.status,
      heroAfter: this.hero.snapshot(),
    };
    this.history.push(structuredClone(result));
    if (this.status === 'playing') {
      this.upcomingSteps = this.stepFactory.advanceUpcomingSteps(
        this.upcomingSteps,
        this.hero.ageWeeks,
        weeksAdvanced,
      );
    } else {
      this.upcomingSteps = [];
    }
    return result;
  }

  getState(): GameState {
    return {
      hero: this.hero.snapshot(),
      upcomingSteps: structuredClone(this.upcomingSteps),
      turnNumber: this.turnNumber,
      status: this.status,
      history: structuredClone(this.history),
    };
  }

  private rollDie(): number {
    const value = this.random();
    if (!Number.isFinite(value) || value < 0 || value >= 1) {
      throw new Error('Random source must return a finite number in [0, 1).');
    }
    return Math.floor(value * 6) + 1;
  }

  private resolveStep(step: Step): Changes {
    const changes: Changes = { health: 0, energy: 0, mood: 0, money: 0 };
    if (step.kind === 'empty') {
      return changes;
    }
    if (step.kind === 'item' && step.itemBehavior === 'collectible') {
      this.hero.inventory.push(structuredClone(step));
      return changes;
    }

    for (const effect of step.effects) {
      if (effect.target === 'money') {
        const before = this.hero.resources.money;
        this.hero.resources.money = Math.max(0, before + effect.amount);
        changes.money += this.hero.resources.money - before;
      } else {
        const before = this.hero.condition[effect.target];
        this.hero.condition[effect.target] = Math.max(0, Math.min(100, before + effect.amount));
        changes[effect.target] += this.hero.condition[effect.target] - before;
      }
    }
    // Health 0 intentionally does not end this prototype; only reaching age 100 does.
    return changes;
  }
}
