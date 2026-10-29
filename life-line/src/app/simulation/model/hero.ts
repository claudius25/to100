import type { Step } from './step';
import {
  WEEKS_PER_YEAR,
  type Asset,
  type BlueprintLifeChapter,
  type HeroBlueprint,
  type Job,
  type NamedEntry,
  type Skill,
} from './types';

export class Hero {
  ageWeeks = 0;
  blueprint: HeroBlueprint = {
    physicalResilience: 50,
    emotionalResilience: 50,
    familyFinances: 50,
    socialSkills: 50,
  };
  condition = { health: 100, energy: 100, mood: 100 };
  resources = { money: 0 };
  habits: NamedEntry[] = [];
  skills: Skill[] = [];
  assets: Asset[] = [];
  job: Job | null = null;
  friends: NamedEntry[] = [];
  partner: NamedEntry | null = null;
  superpowers: NamedEntry[] = [];
  inventory: Step[] = [];
  chapters: BlueprintLifeChapter[] = [];

  constructor(
    public readonly id: string,
    public name: string,
  ) {}

  get ageYears(): number {
    return Math.floor(this.ageWeeks / WEEKS_PER_YEAR);
  }

  get ageRemainingWeeks(): number {
    return this.ageWeeks % WEEKS_PER_YEAR;
  }

  snapshot(): HeroSnapshot {
    return {
      ...structuredClone(this),
      ageYears: this.ageYears,
      ageRemainingWeeks: this.ageRemainingWeeks,
    };
  }
}

export type HeroSnapshot = Omit<Hero, 'snapshot'>;
