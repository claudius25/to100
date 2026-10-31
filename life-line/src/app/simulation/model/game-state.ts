import type { HeroSnapshot } from './hero';
import type { Step } from './step';
import { TARGET_AGE_WEEKS, WEEKS_PER_YEAR, type GameState, type TurnResult } from './types';

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function number(value: unknown, min = -Infinity, max = Infinity): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

function integer(value: unknown, min = 0, max = Infinity): value is number {
  return number(value, min, max) && Number.isSafeInteger(value);
}

function named(value: unknown): boolean {
  return isRecord(value) && typeof value['id'] === 'string' && typeof value['name'] === 'string';
}

function blueprint(value: unknown): boolean {
  return (
    isRecord(value) &&
    ['physicalResilience', 'emotionalResilience', 'familyFinances', 'socialSkills'].every((key) =>
      number(value[key], 0, 100),
    )
  );
}

function changes(value: unknown): boolean {
  return (
    isRecord(value) && ['health', 'energy', 'mood', 'money'].every((key) => number(value[key]))
  );
}

export function isStep(value: unknown): value is Step {
  if (
    !isRecord(value) ||
    !['id', 'templateId', 'title', 'description'].every((key) => typeof value[key] === 'string') ||
    !Array.isArray(value['effects']) ||
    !value['effects'].every(
      (effect: unknown) =>
        isRecord(effect) &&
        typeof effect['target'] === 'string' &&
        ['health', 'energy', 'mood', 'money'].includes(effect['target']) &&
        number(effect['amount']),
    )
  )
    return false;
  return (
    value['kind'] === 'empty' ||
    (value['kind'] === 'event' &&
      typeof value['eventCategory'] === 'string' &&
      ['setback', 'breakthrough', 'mixed'].includes(value['eventCategory'])) ||
    (value['kind'] === 'item' &&
      typeof value['itemBehavior'] === 'string' &&
      ['consumable', 'collectible'].includes(value['itemBehavior']))
  );
}

function hero(value: unknown): value is HeroSnapshot {
  if (!isRecord(value) || !named(value) || !integer(value['ageWeeks'], 0, TARGET_AGE_WEEKS))
    return false;
  const condition = value['condition'];
  const resources = value['resources'];
  return (
    value['ageYears'] === Math.floor(value['ageWeeks'] / WEEKS_PER_YEAR) &&
    value['ageRemainingWeeks'] === value['ageWeeks'] % WEEKS_PER_YEAR &&
    blueprint(value['blueprint']) &&
    isRecord(condition) &&
    ['health', 'energy', 'mood'].every((key) => number(condition[key], 0, 100)) &&
    isRecord(resources) &&
    number(resources['money'], 0) &&
    ['habits', 'friends', 'superpowers'].every(
      (key) => Array.isArray(value[key]) && value[key].every(named),
    ) &&
    Array.isArray(value['skills']) &&
    value['skills'].every(
      (entry: unknown) => isRecord(entry) && named(entry) && number(entry['level'], 0),
    ) &&
    Array.isArray(value['assets']) &&
    value['assets'].every(
      (entry: unknown) => isRecord(entry) && named(entry) && number(entry['incomePerWeek'], 0),
    ) &&
    (value['job'] === null ||
      (isRecord(value['job']) && named(value['job']) && number(value['job']['payPerWeek'], 0))) &&
    (value['partner'] === null || named(value['partner'])) &&
    Array.isArray(value['inventory']) &&
    value['inventory'].every(isStep) &&
    Array.isArray(value['chapters']) &&
    value['chapters'].every(
      (entry: unknown) =>
        isRecord(entry) &&
        entry['number'] === 1 &&
        entry['kind'] === 'blueprint' &&
        typeof entry['title'] === 'string' &&
        typeof entry['name'] === 'string' &&
        blueprint(entry['blueprint']),
    )
  );
}

function turn(value: unknown): value is TurnResult {
  if (
    !isRecord(value) ||
    !integer(value['turnNumber'], 1) ||
    !Array.isArray(value['dice']) ||
    value['dice'].length !== 2 ||
    !value['dice'].every((die: unknown) => integer(die, 1, 6)) ||
    !integer(value['ageBefore'], 0, TARGET_AGE_WEEKS - 1) ||
    !integer(value['ageAfter'], 0, TARGET_AGE_WEEKS) ||
    !changes(value['appliedChanges']) ||
    !hero(value['heroAfter'])
  )
    return false;
  const sum = value['dice'][0] + value['dice'][1];
  const advanced = Math.min(sum, TARGET_AGE_WEEKS - value['ageBefore']);
  const finished = value['ageAfter'] === TARGET_AGE_WEEKS;
  return (
    value['diceSum'] === sum &&
    value['weeksAdvanced'] === advanced &&
    value['ageAfter'] === value['ageBefore'] + advanced &&
    value['heroAfter'].ageWeeks === value['ageAfter'] &&
    value['status'] === (finished ? 'completed' : 'playing') &&
    (finished ? value['resolvedStep'] === null : isStep(value['resolvedStep']))
  );
}

/** Validate serialized input before it can enter the model or drive the UI. */
export function readGameState(value: unknown): GameState {
  if (
    !isRecord(value) ||
    !hero(value['hero']) ||
    !integer(value['turnNumber']) ||
    !Array.isArray(value['upcomingSteps']) ||
    !value['upcomingSteps'].every(isStep) ||
    !Array.isArray(value['history']) ||
    !value['history'].every(turn)
  )
    throw new Error('Invalid saved game state.');
  const finished = value['hero'].ageWeeks === TARGET_AGE_WEEKS;
  const history: TurnResult[] = value['history'];
  if (
    value['status'] !== (finished ? 'completed' : 'playing') ||
    value['upcomingSteps'].length !== (finished ? 0 : 12) ||
    history.length !== value['turnNumber'] ||
    history.some(
      (entry, index) =>
        entry.turnNumber !== index + 1 ||
        entry.ageBefore !== (index ? history[index - 1].ageAfter : 0),
    ) ||
    value['hero'].ageWeeks !== (history.at(-1)?.ageAfter ?? 0)
  )
    throw new Error('Inconsistent saved game progress.');
  return structuredClone({
    hero: value['hero'],
    upcomingSteps: value['upcomingSteps'],
    turnNumber: value['turnNumber'],
    status: finished ? 'completed' : 'playing',
    history,
  });
}
