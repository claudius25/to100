/**
 * Every tuning value the nursery puzzle needs. Swapping in better models means
 * editing this file and `model-bindings.ts`, never the object behaviour.
 */

export const NURSERY_MODEL_URL = 'assets/nursery-room.glb';

export const NURSERY_VIEW = {
  /** World units covered by the orthographic frustum height. */
  verticalSpan: 4.15,
  near: 0.01,
  far: 30,
  background: 0xeeeade,
  maxPolarAngle: Math.PI * 0.48,
  roomTarget: [0, 0.8, 0],
  roomOffset: [3.4, 2.4, 4.4],
  roomZoom: 1,
  /** How far above an object's bounding box a tooltip is pinned. */
  tooltipLift: 0.1,
} as const;

export const NURSERY_LIGHTS = {
  skyColor: 0xfff7e7,
  groundColor: 0xb6bda7,
  hemisphereIntensity: 2,
  sunColor: 0xfff2d2,
  sunIntensity: 2.2,
  sunPosition: [2, 5, 3],
} as const;

export const NURSERY_TIMINGS = {
  /** Plain camera transitions. */
  cameraMs: 700,
  /** Transitions that also walk the bear clear of the wall. */
  bearMs: 1100,
  /** A resumed tab must not spin the mobile forward by the whole pause. */
  maxDeltaSeconds: 0.05,
} as const;

export const BEAR_CONFIG = {
  /** Measured clearance: the bear sits against the wall and steps forward to turn. */
  restX: -1.43,
  inspectX: -1.12,
  homeYaw: Math.PI / 2,
  backYaw: Math.PI,
  /** Camera offset and zoom used while inspecting the pocket. */
  focusOffset: [0, 0.25, 3],
  focusLift: 0.36,
  focusZoom: 4,
  /** Phases of the transition, as fractions. Moving clears the wall first. */
  turnMovePhase: [0, 0.35],
  turnRotatePhase: [0.35, 1],
  homeRotatePhase: [0, 0.65],
  homeMovePhase: [0.65, 1],
  pocketOpenRotationX: -2.65,
  eyeEmissive: 0xffd38b,
  flickerMs: 1000,
  /** Flicker shape, taken from the reference viewer. */
  flickerHz: 0.038,
  flickerHigh: 2,
  flickerLow: 0.4,
} as const;

export const CLOCK_CONFIG = {
  focusOffset: [0, 0.2, 3],
  focusLift: 0.09,
  focusZoom: 6,
  backYaw: Math.PI,
  frontYaw: 0,
  doorOpenRotationY: -2.5,
  colonBlinkMs: 500,
} as const;

export const DESK_CONFIG = {
  drawerClosedZ: 0,
  /** Chosen so the open drawer still clears the cot. */
  drawerOpenZ: 0.48,
  focusOffset: [0, 2.5, 1.4],
  focusLift: 0.53,
  focusZoom: 3.7,
} as const;

export const BED_CONFIG = {
  doorOpenRotationY: -2.5,
  /** Offset from a compartment slot to where a battery body sits in it. */
  batterySlotOffset: [0, -0.005, 0.019],
  rotorSpeed: 0.38,
} as const;

export const NURSERY_TEXT = {
  explore: 'Touch something to explore.',
  loading: 'Loading the room…',
  loadFailed: 'The room could not load.',
  bearName: 'Teddy bear',
  clockName: 'Alarm clock',
  bearBack: 'The fabric tab is on the back.',
  bearFlicker: 'The eyes flicker… then go dark.',
  bearDead: 'The teddy has no power.',
  clockBack: 'A small screw holds the battery cover.',
  clockBlinking: 'The clock display is still blinking.',
  clockDead: 'The clock has no power.',
  clockLocked: 'I cannot open it.',
  clockOpened: 'The cover is open. The batteries are inside.',
  pocketOpened: 'Touch a battery to collect it.',
  pocketClosed: 'Pocket closed.',
  teddyBatteryTaken: 'Battery collected from the teddy.',
  clockBatteryTaken: 'Clock battery collected. The display goes dark.',
  screwdriverTaken: 'Screwdriver collected.',
  drawerOpened: 'Touch an item inside the drawer.',
  needBothBatteries: 'Collect both batteries from this object first.',
  installed: 'Batteries installed. Press the red button to try the mobile.',
  mobileDead: 'it doesnt work',
  mobileRunning: 'The mobile is running.',
  mobileStopped: 'The mobile stopped.',
} as const;
