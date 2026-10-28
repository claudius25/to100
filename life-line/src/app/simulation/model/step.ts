import type { Effect, EventCategory, ItemBehavior, StepTemplate } from './types';

export class Step {
  readonly templateId: string;
  readonly kind: StepTemplate['kind'];
  readonly title: string;
  readonly description: string;
  readonly effects: readonly Effect[];
  readonly eventCategory?: EventCategory;
  readonly itemBehavior?: ItemBehavior;

  constructor(
    public readonly id: string,
    template: StepTemplate,
  ) {
    this.templateId = template.id;
    this.kind = template.kind;
    this.title = template.title;
    this.description = template.description;
    this.effects = structuredClone(template.effects);
    this.eventCategory = template.eventCategory;
    this.itemBehavior = template.itemBehavior;
  }
}
