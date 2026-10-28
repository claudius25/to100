import { Step } from './step';
import { START_STEP_TEMPLATE, STEP_TEMPLATES } from './step-templates';
import { TARGET_AGE_WEEKS, type RandomSource, type StepTemplate } from './types';

export class StepFactory {
  private nextInstanceId = 0;

  constructor(
    private readonly random: RandomSource = Math.random,
    private readonly templates: readonly StepTemplate[] = STEP_TEMPLATES,
  ) {
    if (templates.some((template) => !Number.isFinite(template.weight) || template.weight <= 0)) {
      throw new Error('Encounter weights must be finite and positive.');
    }
  }

  eligibleTemplates(ageWeeks: number): readonly StepTemplate[] {
    return this.templates.filter(
      (template) =>
        ageWeeks >= template.minAgeWeeks &&
        (template.maxAgeWeeks === null || ageWeeks < template.maxAgeWeeks),
    );
  }

  createStep(ageWeeks: number): Step {
    const eligible = this.eligibleTemplates(ageWeeks);
    if (eligible.length === 0) {
      throw new Error(`No encounter templates eligible at age ${ageWeeks} weeks.`);
    }
    const totalWeight = eligible.reduce((total, template) => total + template.weight, 0);
    const value = this.random();
    if (!Number.isFinite(value) || value < 0 || value >= 1) {
      throw new Error('Random source must return a finite number in [0, 1).');
    }
    let remainingWeight = value * totalWeight;
    for (const template of eligible) {
      remainingWeight -= template.weight;
      if (remainingWeight < 0) {
        return new Step(`step-${++this.nextInstanceId}`, template);
      }
    }
    throw new Error('Random source must return a finite number in [0, 1).');
  }

  buildUpcomingSteps(ageWeeks: number): Step[] {
    // Index 0 represents offset 1: modeled, but unreachable with two standard dice.
    return Array.from({ length: 12 }, (_, index) =>
      index === 0
        ? new Step(`step-${++this.nextInstanceId}`, START_STEP_TEMPLATE)
        : this.createStep(Math.min(ageWeeks + index + 1, TARGET_AGE_WEEKS)),
    );
  }

  advanceUpcomingSteps(steps: readonly Step[], ageWeeks: number, weeksAdvanced: number): Step[] {
    const remaining = steps.slice(weeksAdvanced);
    return [
      ...remaining,
      ...Array.from({ length: 12 - remaining.length }, (_, index) =>
        this.createStep(Math.min(ageWeeks + remaining.length + index + 1, TARGET_AGE_WEEKS)),
      ),
    ];
  }
}
