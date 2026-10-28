import type { HeroSnapshot } from './hero';
import type { Step } from './step';

export const WEEKS_PER_YEAR = 52;
export const TARGET_AGE_WEEKS = 100 * WEEKS_PER_YEAR;

export type RandomSource = () => number;
export type GameStatus = 'playing' | 'completed';
export type EventCategory = 'setback' | 'breakthrough' | 'mixed';
export type ItemBehavior = 'consumable' | 'collectible';

export type Effect =
  | { target: 'health'; amount: number }
  | { target: 'energy'; amount: number }
  | { target: 'mood'; amount: number }
  | { target: 'money'; amount: number };

export interface Changes {
  health: number;
  energy: number;
  mood: number;
  money: number;
}

export interface NamedEntry {
  id: string;
  name: string;
}

export interface Skill extends NamedEntry {
  level: number;
}

export interface Asset extends NamedEntry {
  incomePerWeek: number;
}

export interface Job extends NamedEntry {
  payPerWeek: number;
}

export type Encounter =
  | { kind: 'empty'; eventCategory?: never; itemBehavior?: never }
  | { kind: 'event'; eventCategory: EventCategory; itemBehavior?: never }
  | { kind: 'item'; itemBehavior: ItemBehavior; eventCategory?: never };

export type StepTemplate = Encounter & {
  id: string;
  title: string;
  description: string;
  minAgeWeeks: number;
  maxAgeWeeks: number | null;
  weight: number;
  effects: readonly Effect[];
};

export interface TurnResult {
  turnNumber: number;
  dice: [number, number];
  diceSum: number;
  weeksAdvanced: number;
  ageBefore: number;
  ageAfter: number;
  resolvedStep: Step | null;
  appliedChanges: Changes;
  status: GameStatus;
  heroAfter: HeroSnapshot;
}

export interface GameState {
  hero: HeroSnapshot;
  upcomingSteps: Step[];
  turnNumber: number;
  status: GameStatus;
  history: TurnResult[];
}
