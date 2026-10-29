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
  surface: '#e3e2df',
  dryText: '#b6b5b1',
} as const;

export const CHAPTER_TRAITS = [
  { key: 'healthBlueprint', label: 'HEALTH', color: CHAPTER_COLORS.health },
  { key: 'familyFinances', label: 'FINANCE', color: CHAPTER_COLORS.finance },
  { key: 'emotionalResilience', label: 'EMOTIONS', color: CHAPTER_COLORS.emotions },
  { key: 'socialSkills', label: 'SOCIAL', color: CHAPTER_COLORS.social },
] as const;

export const CHAPTER_TEXT = {
  brand: 'TO100',
  home: 'Return home',
  eyebrow: 'CHAPTER 1',
  title: 'The beginning of you.',
  recordTitle: 'The beginning of you',
  nameLabel: 'NAME',
  valueSeparator: '. ',
  restart: 'Start over',
  begin: 'Begin life →',
  debug: 'Chapter 1 · current state JSON',
  loading: 'Preparing your chapter…',
  animating: 'Let it settle…',
  completed: 'Chapter 1 is complete. Your life begins next.',
  hints: [
    'Tap to raise the Name button.',
    'Press the raised Name label to discover your name.',
    'Press the raised Health label to discover your health blueprint.',
    'Press the raised Finance label to discover your family finances.',
    'Press the raised Emotions label to discover your emotional resilience.',
    'Press the raised Social label to discover your social skills.',
  ],
  noGpu: 'The 3D renderer is unavailable. Showing an animated 2D preview.',
  gpuFailed: 'The 3D renderer could not continue. Showing an animated 2D preview.',
  navigationFailed: 'Could not open your life journey. Please try again.',
} as const;

export interface ChapterTimings {
  pressMs: number;
  settleMs: number;
}

/** All durations are milliseconds; label, value and next-button motion run together. */
export const CHAPTER_TIMINGS: Readonly<ChapterTimings> = {
  pressMs: 640,
  settleMs: 40,
};
export const CHAPTER_REDUCED_MOTION_MS = 120;

export const CHAPTER_APPEARANCE = {
  fadeMs: 650,
} as const;

export const CHAPTER_CLOSING_TEXTS = [
  'Every beginning holds a thousand possibilities. Your story is waiting for its first adventure.',
  'A name, a spark, a world to discover. The next chapter belongs to you and the choices you make.',
  'Small steps can lead to extraordinary places. Take your time and make this journey your own.',
  'No two lives follow the same road. Yours begins here, with room for surprises around every corner.',
  'The future is not written in stone. Bring curiosity, courage, and a little kindness along the way.',
  'This is only the starting point. There are friendships to find and unexpected paths to explore.',
  'A whole lifetime stretches ahead. Gather little moments and see what kind of story they become.',
  'Your beginnings are part of your story, not its ending. There is still so much for you to discover.',
  'Some days will challenge you, others will surprise you. Keep moving toward your next possibility.',
  'Here starts a life like no other. Make space for new adventures and the people you meet along the way.',
] as const;

export const CHAPTER_PATH_TEXT = {
  fontSize: 0.52,
  startLeft: 1.5,
  // Limit the final run; long phrases scale down instead of widening the camera fit.
  finalRun: 2,
  color: '#B8B8B8',
  // Extra world-space clearance around the rows, in addition to the offsets below.
  gap: 0.6,
  belowSocial: 0.65,
  valueClearance: 0.45,
  letterSpacing: 0.015,
  surfaceOffset: 0.003,
  bendRadius: 0.65,
  // Baseline of the final rightward run, relative to the Name row baseline.
  nameTurnOffset: 0,
} as const;

export const CHAPTER_SCENE = {
  recessDepth: 0.24,
  raisedHeight: 0.24,
  // Key travel stays well above the plane at the deepest point of a press.
  keyTravel: 0.15,
  // Extra world-space padding around a label's tappable rectangle.
  labelHitPadding: 0.12,
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
  // Cap pixel density to balance sharpness and GPU workload.
  maxPixelRatio: 2,
  shadowMapSize: 2048,
} as const;

/** Whether camera controls, FPS sampling and the state JSON start open. */
export const CHAPTER_DEBUG = false;

/** Allow revealing the DEV button with the top-left triple-tap gesture. */
export const CHAPTER_DEV_BUTTON = true;

export const CHAPTER_DEV_UNLOCK = {
  taps: 3,
  tapWindowMs: 1200,
  cornerSize: 64,
} as const;

/** Dev-only frame statistics overlay. */
export const CHAPTER_STATS = {
  // Show the overlay when the page opens (it can be toggled in the dev panel).
  visible: true,
  // How often the numbers refresh. Each value is averaged over this window.
  sampleMs: 500,
  // Frame times above this are counted as dropped frames (≈ 60 fps budget).
  slowFrameMs: 20,
} as const;
