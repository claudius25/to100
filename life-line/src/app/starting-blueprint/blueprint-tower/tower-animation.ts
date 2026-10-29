import type { BlueprintLevel } from '../model/starting-blueprint';

/** Durations are in seconds unless the name ends in `Ms`. */
export interface TowerTimings {
  spinMs: number;
  settleDelayMs: number;
  popMs: number;
  opening: number;
  launch: number;
  flight: number;
  landing: number;
  flapCloseStart: number;
  flapCloseEnd: number;
  rotationEnd: number;
  lift: number;
  spinTurns: number;
  spinBob: number;
  wobble: boolean;
  bounce: boolean;
}

export const DEFAULT_TOWER_TIMINGS: TowerTimings = {
  spinMs: 2300,
  settleDelayMs: 1000,
  popMs: 650,
  opening: 0.5,
  launch: 0.55,
  flight: 0.85,
  landing: 0.48,
  flapCloseStart: 0.15,
  flapCloseEnd: 0.55,
  rotationEnd: 0.7,
  lift: 0.12,
  spinTurns: 3,
  spinBob: 0.4,
  wobble: true,
  bounce: true,
};

const REDUCED_SCALE = 0.35;

/** Same sequence and 1s pause, but a brief spin and reveal with no bounce. */
export const REDUCED_MOTION_TOWER_TIMINGS: TowerTimings = {
  ...DEFAULT_TOWER_TIMINGS,
  spinMs: 350,
  popMs: 0,
  opening: 0.15,
  launch: DEFAULT_TOWER_TIMINGS.launch * REDUCED_SCALE,
  flight: DEFAULT_TOWER_TIMINGS.flight * REDUCED_SCALE,
  landing: 0,
  flapCloseStart: DEFAULT_TOWER_TIMINGS.flapCloseStart * REDUCED_SCALE,
  flapCloseEnd: DEFAULT_TOWER_TIMINGS.flapCloseEnd * REDUCED_SCALE,
  rotationEnd: DEFAULT_TOWER_TIMINGS.rotationEnd * REDUCED_SCALE,
  spinTurns: 0,
  spinBob: 0,
  wobble: false,
  bounce: false,
};

export const CUBE_BASE_SIZE = 2;
export const CUBE_SIZE_RATIO = 0.87;
export const FIRST_CUBE_ANGLE = -0.3;
export const CHILD_ANGLE_OFFSET = Math.PI / 6;
/** Hinge rotation of a fully open flap (about 146 degrees). */
export const FLAP_OPEN_ANGLE = 2.55;

export function cubeSize(index: number): number {
  return CUBE_BASE_SIZE * CUBE_SIZE_RATIO ** index;
}

/** Centre height of a resting cube stacked on all previous cubes. */
export function cubeRestY(index: number): number {
  let below = 0;
  for (let i = 0; i < index; i++) {
    below += cubeSize(i);
  }
  return below + cubeSize(index) / 2;
}

export function restingAngle(index: number, parentAngle: number): number {
  return parentAngle + (index % 2 ? 1 : -1) * CHILD_ANGLE_OFFSET;
}

/**
 * Side faces in Three.js BoxGeometry material order (+x, -x, +y, -y, +z, -z).
 * `azimuth` is the local outward direction measured as atan2(x, z); a Y
 * rotation of θ moves it to azimuth + θ in world space.
 */
export const SIDE_FACES: readonly {
  readonly materialIndex: number;
  readonly level: BlueprintLevel;
  readonly azimuth: number;
}[] = [
  { materialIndex: 0, level: 1, azimuth: Math.PI / 2 },
  { materialIndex: 4, level: 2, azimuth: 0 },
  { materialIndex: 1, level: 3, azimuth: -Math.PI / 2 },
  { materialIndex: 5, level: 4, azimuth: Math.PI },
];

function sideFace(level: BlueprintLevel) {
  return SIDE_FACES.find((face) => face.level === level)!;
}

function wrapAngle(angle: number): number {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

/** Level printed on the side face closest to the viewer. */
export function facingLevel(rotationY: number, viewAzimuth: number): BlueprintLevel {
  let best = SIDE_FACES[0];
  let bestDistance = Infinity;
  for (const face of SIDE_FACES) {
    const distance = Math.abs(wrapAngle(face.azimuth + rotationY - viewAzimuth));
    if (distance < bestDistance) {
      best = face;
      bestDistance = distance;
    }
  }
  return best.level;
}

/** Final Y rotation for a spin that starts at `from` and settles on `level`. */
export function spinTarget(
  from: number,
  level: BlueprintLevel,
  viewAzimuth: number,
  turns: number,
): number {
  const base = viewAzimuth - sideFace(level).azimuth;
  const twoPi = Math.PI * 2;
  return base + Math.ceil((from - base) / twoPi) * twoPi + turns * twoPi;
}

export interface SpinPose {
  rotationY: number;
  rotationZ: number;
  lift: number;
}

export function spinPose(
  progress: number,
  from: number,
  to: number,
  timings: TowerTimings,
): SpinPose {
  const p = clamp01(progress);
  const ease = 1 - (1 - p) ** 4;
  return {
    rotationY: from + (to - from) * ease,
    rotationZ: timings.wobble ? Math.sin(p * Math.PI * 4) * (1 - p) * 0.035 : 0,
    lift: Math.sin(p * Math.PI) * timings.spinBob,
  };
}

/** Elastic grow-in for the very first cube. */
export function popScale(progress: number): number {
  const p = clamp01(progress);
  return p === 1 ? 1 : Math.max(0.001, 1 - 2 ** (-10 * p) * Math.cos(p * Math.PI * 3));
}

export interface RevealPath {
  /** Parent centre height; the child starts hidden and aligned inside it. */
  from: number;
  /** Child resting centre height. */
  to: number;
  size: number;
  alignedAngle: number;
  restingAngle: number;
}

export type RevealPhase = 'opening' | 'launch' | 'flight' | 'landing' | 'settled';

export interface RevealPose {
  phase: RevealPhase;
  visible: boolean;
  /** Parent flap opening from 0 (closed) to 1 (fully open). */
  flapOpen: number;
  y: number;
  rotationY: number;
  scaleXZ: number;
  scaleY: number;
}

export function revealDuration(timings: TowerTimings): number {
  return timings.opening + timings.launch + timings.flight + timings.landing;
}

export function revealPose(seconds: number, path: RevealPath, timings: TowerTimings): RevealPose {
  const { opening, launch, flight, landing, lift } = timings;
  const distance = path.to + lift - path.from;
  const velocity = (2 * distance) / launch;
  const gravity = (2 * (velocity * flight + lift)) / (flight * flight);
  const t = Math.max(0, seconds);
  const settled: RevealPose = {
    phase: 'settled',
    visible: true,
    flapOpen: 0,
    y: path.to,
    rotationY: path.restingAngle,
    scaleXZ: 1,
    scaleY: 1,
  };

  if (t < opening) {
    return {
      phase: 'opening',
      visible: false,
      flapOpen: smooth(t / opening),
      y: path.from,
      rotationY: path.alignedAngle,
      scaleXZ: 1,
      scaleY: 1,
    };
  }
  if (t < opening + launch) {
    // Accelerates straight up at full scale, aligned with the parent's walls.
    const u = (t - opening) / launch;
    return {
      phase: 'launch',
      visible: true,
      flapOpen: 1,
      y: path.from + distance * u * u,
      rotationY: path.alignedAngle,
      scaleXZ: 1,
      scaleY: 1,
    };
  }
  if (t < opening + launch + flight) {
    // Ballistic: the flaps close underneath while the cube keeps moving.
    const f = t - opening - launch;
    const closeSpan = timings.flapCloseEnd - timings.flapCloseStart;
    return {
      phase: 'flight',
      visible: true,
      flapOpen: 1 - smooth((f - timings.flapCloseStart) / closeSpan),
      y: path.to + lift + velocity * f - 0.5 * gravity * f * f,
      rotationY:
        path.alignedAngle +
        (path.restingAngle - path.alignedAngle) * smooth(f / timings.rotationEnd),
      scaleXZ: 1,
      scaleY: 1,
    };
  }
  if (timings.bounce && landing > 0 && t < opening + launch + flight + landing) {
    const u = (t - opening - launch - flight) / landing;
    const scaleY = 1 - 0.12 * Math.exp(-5 * u) * Math.sin(5 * Math.PI * u);
    const bounce = 0.2 * Math.exp(-4 * u) * Math.abs(Math.sin(2 * Math.PI * u));
    return {
      phase: 'landing',
      visible: true,
      flapOpen: 0,
      // Deformation is anchored at the bottom face so it never sinks into the parent.
      y: path.to + bounce + (path.size * (scaleY - 1)) / 2,
      rotationY: path.restingAngle,
      scaleXZ: 1 / Math.sqrt(scaleY),
      scaleY,
    };
  }
  return settled;
}

/** Height of a flap's free edge above the parent's rim. */
export function flapTipHeight(parentSize: number, open: number): number {
  return (parentSize / 2) * Math.sin(open * FLAP_OPEN_ANGLE);
}

export function smooth(value: number): number {
  const x = clamp01(value);
  return x * x * (3 - 2 * x);
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
