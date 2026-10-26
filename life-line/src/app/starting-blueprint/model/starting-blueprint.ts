/**
 * Starting traits rolled before a life begins. These describe starting
 * circumstances only — they are deliberately kept separate from in-game
 * resources such as money or energy, and no formula converts between them.
 */
export interface StartingBlueprint {
  healthBlueprint: number;
  familyFinances: number;
  emotionalResilience: number;
  socialSkills: number;
}

export type TraitKey = keyof StartingBlueprint;

export type TraitIcon = 'battery' | 'coin' | 'shield' | 'bubbles';

export interface TraitCardConfig {
  readonly key: TraitKey;
  readonly title: string;
  /** Used for screen readers and the live announcement. */
  readonly label: string;
  readonly description: string;
  readonly icon: TraitIcon;
  /** CSS colour driving the icon fill and the filled pips. */
  readonly accent: string;
}

export const DIE_FACES = 6;

export const TRAIT_CARDS: readonly TraitCardConfig[] = [
  {
    key: 'healthBlueprint',
    title: 'HEALTH BLUEPRINT',
    label: 'Health Blueprint',
    description: 'How quickly you recover and recharge.',
    icon: 'battery',
    accent: '#3ac45f',
  },
  {
    key: 'familyFinances',
    title: 'FAMILY FINANCES',
    label: 'Family Finances',
    description: 'Your access to education and opportunities.',
    icon: 'coin',
    accent: '#f6c33d',
  },
  {
    key: 'emotionalResilience',
    title: 'EMOTIONAL RESILIENCE',
    label: 'Emotional Resilience',
    description: 'How you cope with setbacks.',
    icon: 'shield',
    accent: '#fb6f5c',
  },
  {
    key: 'socialSkills',
    title: 'SOCIAL SKILLS',
    label: 'Social Skills',
    description: 'How you connect and build friendships.',
    icon: 'bubbles',
    accent: '#aa9cf2',
  },
];

export const TRAIT_KEYS: readonly TraitKey[] = TRAIT_CARDS.map((card) => card.key);

/**
 * One fair six-sided die.
 *
 * Uses rejection sampling on `crypto` so the result is uniform: plain
 * `byte % 6` would make 1-4 slightly more likely than 5-6.
 */
export function rollDie(): number {
  const source = globalThis.crypto;
  if (source?.getRandomValues) {
    const buffer = new Uint8Array(1);
    const limit = 252; // 42 * 6, the largest multiple of 6 under 256
    let value = limit;
    do {
      source.getRandomValues(buffer);
      value = buffer[0];
    } while (value >= limit);
    return (value % DIE_FACES) + 1;
  }
  return Math.floor(Math.random() * DIE_FACES) + 1;
}

/** Rolls every trait independently. Pure: no animation, no component state. */
export function rollBlueprint(): StartingBlueprint {
  return {
    healthBlueprint: rollDie(),
    familyFinances: rollDie(),
    emotionalResilience: rollDie(),
    socialSkills: rollDie(),
  };
}

export function describeTrait(label: string, value: number | null): string {
  return value === null
    ? `${label}: not rolled yet`
    : `${label}: ${value} out of ${DIE_FACES}`;
}
