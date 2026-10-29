import type { HeroStartingState } from '../simulation/model/types';
import type {
  BlueprintLevel,
  BlueprintTraitKey,
} from '../starting-blueprint/model/starting-blueprint';
import type { WaterBlueprintResult } from './blueprint-chapter';
import { CHAPTER_TEXT, MALE_NAMES } from './chapter.constants';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isLevel(value: unknown): value is BlueprintLevel {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 4;
}

/** Navigation history also survives a reload; reject malformed chapter payloads explicitly. */
export function readBlueprintChapter(state: unknown): WaterBlueprintResult | null {
  if (!isRecord(state) || !('blueprintChapter' in state)) return null;
  const chapter = state['blueprintChapter'];
  if (
    !isRecord(chapter) ||
    typeof chapter['name'] !== 'string' ||
    !MALE_NAMES.includes(chapter['name']) ||
    !isRecord(chapter['blueprint'])
  ) {
    throw new Error('Invalid starting blueprint chapter in navigation state.');
  }
  const blueprint = chapter['blueprint'];
  const level = (key: BlueprintTraitKey): BlueprintLevel => {
    const value = blueprint[key];
    if (!isLevel(value)) throw new Error(`Invalid starting blueprint level: ${key}.`);
    return value;
  };
  return {
    name: chapter['name'],
    blueprint: {
      healthBlueprint: level('healthBlueprint'),
      familyFinances: level('familyFinances'),
      emotionalResilience: level('emotionalResilience'),
      socialSkills: level('socialSkills'),
    },
  };
}

export function toHeroStartingState(result: WaterBlueprintResult): HeroStartingState {
  const blueprint = {
    physicalResilience: result.blueprint.healthBlueprint * 25,
    familyFinances: result.blueprint.familyFinances * 25,
    emotionalResilience: result.blueprint.emotionalResilience * 25,
    socialSkills: result.blueprint.socialSkills * 25,
  };
  return {
    blueprint,
    chapter: {
      number: 1,
      kind: 'blueprint',
      title: CHAPTER_TEXT.recordTitle,
      name: result.name,
      blueprint: { ...blueprint },
    },
  };
}
