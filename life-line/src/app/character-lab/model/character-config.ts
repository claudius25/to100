/**
 * Typed appearance configuration for the procedural character.
 *
 * Appearance is intentionally decoupled from movement: the animator only ever
 * reads `CharacterMetrics` (derived, absolute world units), so new presets,
 * hairstyles or clothing can be added by extending the factory without
 * touching the walk cycle.
 */
export interface CharacterConfig {
  /** Total standing height in world units (metres). */
  height: number;
  /** Relative head size multiplier. */
  headScale: number;
  /** Pelvis -> neck base length (proportion units, before height normalisation). */
  torsoLength: number;
  /** Ground -> hip pivot length (proportion units, before height normalisation). */
  legLength: number;
  /** Distance between shoulder pivots (proportion units). */
  shoulderWidth: number;
  /** Distance between hip pivots (proportion units). */
  hipWidth: number;
  /** Overall body thickness (proportion units). */
  bodyWidth: number;
}

export interface SliderSpec {
  readonly key: keyof CharacterConfig;
  readonly label: string;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly unit: string;
}

export interface CharacterPreset {
  readonly id: string;
  readonly label: string;
  readonly config: CharacterConfig;
}

export const DEFAULT_CHARACTER_CONFIG: CharacterConfig = {
  height: 1.75,
  headScale: 1,
  torsoLength: 0.54,
  legLength: 0.88,
  shoulderWidth: 0.34,
  hipWidth: 0.23,
  bodyWidth: 0.21,
};

export const CHARACTER_SLIDERS: readonly SliderSpec[] = [
  { key: 'height', label: 'Height', min: 1.3, max: 2.2, step: 0.01, unit: 'm' },
  { key: 'headScale', label: 'Head scale', min: 0.7, max: 1.4, step: 0.01, unit: '×' },
  { key: 'torsoLength', label: 'Torso length', min: 0.35, max: 0.78, step: 0.01, unit: '' },
  { key: 'legLength', label: 'Leg length', min: 0.6, max: 1.15, step: 0.01, unit: '' },
  { key: 'shoulderWidth', label: 'Shoulder width', min: 0.22, max: 0.5, step: 0.01, unit: '' },
  { key: 'hipWidth', label: 'Hip width', min: 0.14, max: 0.36, step: 0.01, unit: '' },
  { key: 'bodyWidth', label: 'Body width', min: 0.12, max: 0.32, step: 0.01, unit: '' },
];

export const CHARACTER_PRESETS: readonly CharacterPreset[] = [
  {
    id: 'tall-wiry',
    label: 'Tall & Wiry',
    config: {
      height: 2.0,
      headScale: 0.88,
      torsoLength: 0.52,
      legLength: 1.05,
      shoulderWidth: 0.33,
      hipWidth: 0.18,
      bodyWidth: 0.17,
    },
  },
  {
    id: 'short-sturdy',
    label: 'Short & Sturdy',
    config: {
      height: 1.5,
      headScale: 1.18,
      torsoLength: 0.5,
      legLength: 0.72,
      shoulderWidth: 0.45,
      hipWidth: 0.31,
      bodyWidth: 0.29,
    },
  },
  {
    id: 'long-torso',
    label: 'Long Torso',
    config: {
      height: 1.78,
      headScale: 1.02,
      torsoLength: 0.75,
      legLength: 0.7,
      shoulderWidth: 0.39,
      hipWidth: 0.27,
      bodyWidth: 0.23,
    },
  },
];

/** Absolute, height-normalised dimensions used by the factory and the animator. */
export interface CharacterMetrics {
  /** Uniform scale applied to the proportion units so total height matches config.height. */
  readonly scale: number;
  readonly hipHeight: number;
  readonly ankleHeight: number;
  readonly thighLength: number;
  readonly shinLength: number;
  readonly thighRadius: number;
  readonly shinRadius: number;
  readonly torsoLength: number;
  readonly bodyRadius: number;
  readonly shoulderY: number;
  readonly shoulderOffsetZ: number;
  readonly hipOffsetZ: number;
  readonly upperArmLength: number;
  readonly forearmLength: number;
  readonly armRadius: number;
  readonly handRadius: number;
  readonly neckLength: number;
  readonly neckRadius: number;
  readonly headRadius: number;
  readonly footLength: number;
  readonly footWidth: number;
  /** Ground distance covered by one full two-step gait cycle at the natural pace. */
  readonly cycleDistance: number;
  /** Speed at which the natural stride is used; faster settings lengthen the stride. */
  readonly preferredSpeed: number;
  /** Peak foot clearance during swing. */
  readonly footLift: number;
  /** Vertical pelvis oscillation amplitude while walking. */
  readonly bobAmplitude: number;
  readonly totalHeight: number;
}

export function clampConfig(config: CharacterConfig): CharacterConfig {
  const next: CharacterConfig = { ...config };
  for (const slider of CHARACTER_SLIDERS) {
    const value = next[slider.key];
    next[slider.key] = Math.min(
      slider.max,
      Math.max(slider.min, Number.isFinite(value) ? value : slider.min),
    );
  }
  return next;
}

export function computeMetrics(rawConfig: CharacterConfig): CharacterMetrics {
  const config = clampConfig(rawConfig);

  const neckLengthRaw = 0.055 + 0.02 * config.headScale;
  const headRadiusRaw = 0.115 * config.headScale;
  const naturalHeight = config.legLength + config.torsoLength + neckLengthRaw + 2 * headRadiusRaw;
  const scale = config.height / naturalHeight;

  const hipHeight = config.legLength * scale;
  const ankleHeight = hipHeight * 0.085;
  const legSpan = hipHeight - ankleHeight;
  const thighLength = legSpan * 0.52;
  const shinLength = legSpan * 0.48;

  const torsoLength = config.torsoLength * scale;
  const bodyRadius = (config.bodyWidth * scale) / 2;

  const stepLength = Math.min(0.46 * hipHeight, 0.62 * legSpan);
  const cycleDistance = 2 * stepLength;

  return {
    scale,
    hipHeight,
    ankleHeight,
    thighLength,
    shinLength,
    thighRadius: bodyRadius * 0.52,
    shinRadius: bodyRadius * 0.4,
    torsoLength,
    bodyRadius,
    shoulderY: torsoLength * 0.9,
    shoulderOffsetZ: (config.shoulderWidth * scale) / 2,
    hipOffsetZ: (config.hipWidth * scale) / 2,
    upperArmLength: torsoLength * 0.46,
    forearmLength: torsoLength * 0.42,
    armRadius: bodyRadius * 0.34,
    handRadius: bodyRadius * 0.42,
    neckLength: neckLengthRaw * scale,
    neckRadius: bodyRadius * 0.42,
    headRadius: headRadiusRaw * scale,
    footLength: headRadiusRaw * scale * 1.7,
    footWidth: bodyRadius * 0.7,
    cycleDistance,
    preferredSpeed: 1.2 * Math.sqrt(hipHeight / 0.9),
    footLift: legSpan * 0.1,
    bobAmplitude: hipHeight * 0.022,
    totalHeight: config.height,
  };
}
