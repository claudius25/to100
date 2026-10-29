import type { BlueprintTraitKey } from '../starting-blueprint/model/starting-blueprint';

export const MALE_NAMES: readonly string[] = [
  'Adam',
  'Alex',
  'Amir',
  'Andre',
  'Andy',
  'Arlo',
  'Aron',
  'Axel',
  'Beau',
  'Ben',
  'Blake',
  'Boris',
  'Brent',
  'Brett',
  'Brian',
  'Bruno',
  'Caleb',
  'Carl',
  'Chad',
  'Chris',
  'Cody',
  'Cole',
  'Colin',
  'Craig',
  'Damon',
  'Dan',
  'David',
  'Dean',
  'Diego',
  'Drew',
  'Dylan',
  'Eden',
  'Eli',
  'Elias',
  'Emil',
  'Eric',
  'Ethan',
  'Evan',
  'Ezra',
  'Felix',
  'Finn',
  'Flynn',
  'Frank',
  'Gabe',
  'Gavin',
  'Grant',
  'Greg',
  'Hank',
  'Harry',
  'Hugo',
  'Ian',
  'Idris',
  'Isaac',
  'Ivan',
  'Jack',
  'Jake',
  'James',
  'Jasper',
  'Jay',
  'Joel',
  'John',
  'Jonah',
  'Jorge',
  'Jude',
  'Kai',
  'Karl',
  'Keith',
  'Ken',
  'Kevin',
  'Kian',
  'Kurt',
  'Kyle',
  'Lars',
  'Leo',
  'Leon',
  'Levi',
  'Liam',
  'Logan',
  'Louis',
  'Luca',
  'Luke',
  'Malik',
  'Mark',
  'Mason',
  'Max',
  'Miles',
  'Milo',
  'Nate',
  'Neil',
  'Nico',
  'Noah',
  'Omar',
  'Oscar',
  'Otis',
  'Owen',
  'Paul',
  'Peter',
  'Quinn',
  'Ravi',
  'Rhys',
];

/** Shared with the original tower so the same level always has the same wording. */
export const CHAPTER_LEVEL_LABELS: Record<
  BlueprintTraitKey,
  readonly [string, string, string, string]
> = {
  healthBlueprint: ['Fragile', 'Sensitive', 'Healthy', 'Robust'],
  familyFinances: ['Limited', 'Modest', 'Comfortable', 'Abundant'],
  emotionalResilience: ['Sensitive', 'Developing', 'Steady', 'Resilient'],
  socialSkills: ['Reserved', 'Warming up', 'Outgoing', 'Connector'],
};

export const CHAPTER_COLORS = {
  name: '#198bdd',
  health: '#20b967',
  finance: '#f4a51c',
  emotions: '#ec507c',
  social: '#9554e9',
  clearLiquid: '#f2faff',
  surface: '#e3e2df',
  dryText: '#b6b5b1',
} as const;

export const CHAPTER_TRAITS = [
  { key: 'healthBlueprint', label: 'HEALTH:', color: CHAPTER_COLORS.health },
  { key: 'familyFinances', label: 'FINANCE:', color: CHAPTER_COLORS.finance },
  { key: 'emotionalResilience', label: 'EMOTIONS:', color: CHAPTER_COLORS.emotions },
  { key: 'socialSkills', label: 'SOCIAL:', color: CHAPTER_COLORS.social },
] as const;

export const CHAPTER_TEXT = {
  brand: 'TO100',
  home: 'Return home',
  eyebrow: 'CHAPTER 1',
  title: 'The beginning of you.',
  recordTitle: 'The beginning of you',
  nameLabel: 'NAME:',
  valueSeparator: '. ',
  restart: 'Start over',
  begin: 'Begin life →',
  debug: 'Chapter 1 · current state JSON',
  loading: 'Preparing your chapter…',
  animating: 'Let it settle…',
  completed: 'Chapter 1 is complete. Your life begins next.',
  hints: [
    'Tap to leave your first mark.',
    'Tap to discover your name.',
    'Tap to discover your health blueprint.',
    'Tap to discover your family finances.',
    'Tap to discover your emotional resilience.',
    'Tap to discover your social skills.',
  ],
  noGpu: 'GPU water is unavailable. Showing an animated 2D preview.',
  gpuFailed: 'The 3D water renderer could not continue. Showing an animated 2D preview.',
  navigationFailed: 'Could not open your life journey. Please try again.',
} as const;

export interface ChapterTimings {
  pressMs: number;
  labelValueDelayMs: number;
  fillDelayMs: number;
  fillMs: number;
  settleMs: number;
}

/** All durations are milliseconds; the liquid starts only after the text is fully pressed. */
export const CHAPTER_TIMINGS: Readonly<ChapterTimings> = {
  pressMs: 1100,
  labelValueDelayMs: 400,
  fillDelayMs: 180,
  fillMs: 1800,
  settleMs: 180,
};
export const CHAPTER_REDUCED_MOTION_MS = 120;

export const CHAPTER_LIQUID = {
  targetFill: 0.7,
  opacity: 0.96,
  // Opacity of the clear, uncolored liquid as it starts rising (0 = invisible).
  clearOpacity: 0.35,
  // Fraction of the rise spent clear before the color starts developing.
  colorDelayFraction: 0.1,
  roughness: 0.17,
  metalness: 0.08,
  clearcoat: 1,
} as const;

export const CHAPTER_SCENE = {
  recessDepth: 0.24,
  labelEdge: -1.35,
  valueEdge: -0.75,
  rowTop: 2.2,
  rowGap: 1.1,
  // Three.js world units; also scales the 2D fallback text.
  fontSize: 0.62,
  // Width and height of the ground plate in world units.
  plateSize: 80,
  // Fraction of each viewport half reserved around the full chapter layout.
  framingPadding: 0.1,
} as const;

export interface ChapterViewSettings {
  orthographic: boolean;
  zoom: number;
  panX: number;
  panY: number;
  yaw: number;
  pitch: number;
  roll: number;
  keyX: number;
  keyY: number;
  keyZ: number;
  keyEnabled: boolean;
  edgeX: number;
  edgeY: number;
  edgeZ: number;
  edgeEnabled: boolean;
  planeRotationZ: number;
  ambientIntensity: number;
  ambientEnabled: boolean;
  giEnabled: boolean;
  giEnvironment: number;
  giAoIntensity: number;
  giAoRadius: number;
}

export const CHAPTER_VIEW: Readonly<ChapterViewSettings> = {
  orthographic: true,
  zoom: 1.4,
  panX: 0.7,
  panY: -0.05,
  yaw: 7.25,
  pitch: 50,
  roll: -4,
  keyX: -3,
  keyY: 5,
  keyZ: 6,
  keyEnabled: false,
  edgeX: 7,
  edgeY: -6.9,
  edgeZ: 4.4,
  edgeEnabled: true,
  // Degrees around the axis pointing out of the ground.
  planeRotationZ: -34,
  ambientIntensity: 2.25,
  ambientEnabled: true,
  // WebGL approximation: environment light bounce (IBL) + ground-truth ambient occlusion.
  giEnabled: true,
  giEnvironment: 0.55,
  // Zero keeps the animation-time render path as the default; raise to enable idle AO.
  giAoIntensity: 0,
  giAoRadius: 1,
};

export const CHAPTER_VIEW_SLIDERS = [
  { key: 'zoom', label: 'Zoom', min: 0.25, max: 4, step: 0.05, group: 'Camera' },
  { key: 'panX', label: 'Pan X', min: -8, max: 8, step: 0.1, group: 'Camera' },
  { key: 'panY', label: 'Pan Y', min: -6, max: 6, step: 0.05, group: 'Camera' },
  { key: 'yaw', label: 'Yaw (degrees)', min: -80, max: 80, step: 1, group: 'Camera' },
  { key: 'pitch', label: 'Tilt (degrees)', min: -80, max: 80, step: 1, group: 'Camera' },
  { key: 'roll', label: 'Roll (degrees)', min: -180, max: 180, step: 1, group: 'Camera' },
  { key: 'keyX', label: 'Key light X', min: -12, max: 12, step: 0.1, group: 'Key light' },
  { key: 'keyY', label: 'Key light Y', min: -12, max: 12, step: 0.1, group: 'Key light' },
  { key: 'keyZ', label: 'Key light Z', min: 0.5, max: 15, step: 0.1, group: 'Key light' },
  { key: 'edgeX', label: 'Fill light X', min: -12, max: 12, step: 0.1, group: 'Fill light' },
  { key: 'edgeY', label: 'Fill light Y', min: -12, max: 12, step: 0.1, group: 'Fill light' },
  { key: 'edgeZ', label: 'Fill light Z', min: 0.5, max: 15, step: 0.1, group: 'Fill light' },
  {
    key: 'planeRotationZ',
    label: 'Rotation Z (degrees)',
    min: -180,
    max: 180,
    step: 1,
    group: 'Plane',
  },
  {
    key: 'ambientIntensity',
    label: 'Intensity',
    min: 0,
    max: 4,
    step: 0.05,
    group: 'Ambient light',
  },
  {
    key: 'giEnvironment',
    label: 'Environment bounce',
    min: 0,
    max: 3,
    step: 0.05,
    group: 'Global illumination',
  },
  {
    key: 'giAoIntensity',
    label: 'AO amount',
    min: 0,
    max: 2,
    step: 0.05,
    group: 'Global illumination',
  },
  {
    key: 'giAoRadius',
    label: 'AO radius',
    min: 0.05,
    max: 2,
    step: 0.05,
    group: 'Global illumination',
  },
] as const satisfies readonly {
  key: Exclude<
    keyof ChapterViewSettings,
    'orthographic' | 'keyEnabled' | 'edgeEnabled' | 'ambientEnabled' | 'giEnabled'
  >;
  label: string;
  min: number;
  max: number;
  step: number;
  group: string;
}[];

export const CHAPTER_MOUSE = {
  rotationDegreesPerPixel: 0.25,
  zoomPerPixel: 0.001,
} as const;

/** Lightweight rendering settings, applied on page load. */
export const CHAPTER_QUALITY = {
  curveSegments: 12,
  // Skip the global-illumination AO pass while something moves.
  giOnlyWhenIdle: true,
  // How long the scene must be still before enabling the optional GI pass.
  idleDelayMs: 250,
  // Limit supersampling on high-density screens to balance sharpness and performance.
  maxPixelRatio: 1.5,
  shadowMapSize: 2048,
} as const;

/** Whether camera controls, FPS sampling and the state JSON start open. */
export const CHAPTER_DEBUG = false;

/** Show the top DEV button that toggles the dev tools at runtime. */
export const CHAPTER_DEV_BUTTON = true;

/** Dev-only frame statistics overlay. */
export const CHAPTER_STATS = {
  // Show the overlay when the page opens (it can be toggled in the dev panel).
  visible: true,
  // How often the numbers refresh. Each value is averaged over this window.
  sampleMs: 500,
  // Frame times above this are counted as dropped frames (≈ 60 fps budget).
  slowFrameMs: 20,
} as const;

export const CHAPTER_WATER = {
  resolution: 256,
  bounds: 16,
  // Automatic drops keep the liquid moving without touch or hover.
  rippleIntervalMs: 220,
  dropsPerRipple: 2,
  damping: 0.985,
  rippleRadius: 0.2,
  impulse: 0.1,
  // Maximum ripple height in world units (also limited by the space above the liquid).
  maxAmplitude: 0.025,
  // Constant rolling swell layered on top of the ripples.
  swellAmplitude: 0.014,
  swellSpeed: 1.4,
  swellWavelength: 1.2,
} as const;
