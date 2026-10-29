import { CHAPTER_LEVEL_LABELS } from '../../blueprint-water/chapter.constants';

/**
 * Starting traits revealed before a life begins. They describe starting
 * circumstances only and are deliberately kept separate from in-game resources
 * such as health, money or mood. The liquid chapter has an explicit adapter
 * mapping these levels to Hero's 0-100 starting blueprint.
 */
export type BlueprintTraitKey =
  'healthBlueprint' | 'familyFinances' | 'emotionalResilience' | 'socialSkills';

export type BlueprintLevel = 1 | 2 | 3 | 4;

export interface TraitResult {
  trait: BlueprintTraitKey;
  level: BlueprintLevel;
  label: string;
}

export interface BlueprintResult {
  healthBlueprint: BlueprintLevel;
  familyFinances: BlueprintLevel;
  emotionalResilience: BlueprintLevel;
  socialSkills: BlueprintLevel;
}

export interface BlueprintTraitConfig {
  readonly key: BlueprintTraitKey;
  readonly name: string;
  readonly color: string;
  readonly colorName: string;
  readonly levels: readonly [string, string, string, string];
}

export type RandomSource = () => number;

export const BLUEPRINT_LEVEL_COUNT = 4;

/** Tower order: the first entry is the bottom cube. */
export const BLUEPRINT_TRAITS: readonly BlueprintTraitConfig[] = [
  {
    key: 'healthBlueprint',
    name: 'Health blueprint',
    color: '#16B85A',
    colorName: 'green',
    levels: CHAPTER_LEVEL_LABELS.healthBlueprint,
  },
  {
    key: 'familyFinances',
    name: 'Family finances',
    color: '#FF9418',
    colorName: 'orange',
    levels: CHAPTER_LEVEL_LABELS.familyFinances,
  },
  {
    key: 'emotionalResilience',
    name: 'Emotional resilience',
    color: '#EF3545',
    colorName: 'red',
    levels: CHAPTER_LEVEL_LABELS.emotionalResilience,
  },
  {
    key: 'socialSkills',
    name: 'Social skills',
    color: '#923FEA',
    colorName: 'purple',
    levels: CHAPTER_LEVEL_LABELS.socialSkills,
  },
];

export const BLUEPRINT_TRAIT_KEYS: readonly BlueprintTraitKey[] = BLUEPRINT_TRAITS.map(
  (trait) => trait.key,
);

/** Uniform value in [0, 1); 2^32 is divisible by 4, so level sampling stays fair. */
export function secureRandom(): number {
  const source = globalThis.crypto;
  if (source?.getRandomValues) {
    return source.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;
  }
  return Math.random();
}

export function rollLevel(random: RandomSource = secureRandom): BlueprintLevel {
  const index = Math.min(BLUEPRINT_LEVEL_COUNT - 1, Math.max(0, Math.floor(random() * 4)));
  return (index + 1) as BlueprintLevel;
}

export function traitResult(index: number, level: BlueprintLevel): TraitResult {
  const trait = BLUEPRINT_TRAITS[index];
  return { trait: trait.key, level, label: trait.levels[level - 1] };
}

export function describeTraitResult(result: TraitResult): string {
  const name = BLUEPRINT_TRAITS.find((trait) => trait.key === result.trait)?.name ?? result.trait;
  return `${name}: ${result.label}, level ${result.level} of ${BLUEPRINT_LEVEL_COUNT}`;
}

/** Returns null until every trait has exactly one result. */
export function toBlueprintResult(results: readonly TraitResult[]): BlueprintResult | null {
  const levels = new Map(results.map((result) => [result.trait, result.level]));
  if (results.length !== BLUEPRINT_TRAIT_KEYS.length || levels.size !== results.length) {
    return null;
  }
  const value = (key: BlueprintTraitKey) => levels.get(key);
  const health = value('healthBlueprint');
  const finances = value('familyFinances');
  const emotional = value('emotionalResilience');
  const social = value('socialSkills');
  if (!health || !finances || !emotional || !social) {
    return null;
  }
  return {
    healthBlueprint: health,
    familyFinances: finances,
    emotionalResilience: emotional,
    socialSkills: social,
  };
}
