/** Snapshot consumed by the animator and (sparsely) by the Angular component. */
export interface MovementSnapshot {
  readonly x: number;
  readonly yaw: number;
  readonly walkBlend: number;
  readonly gaitPhase: number;
  readonly currentMarker: number | null;
  readonly targetMarker: number | null;
  readonly moving: boolean;
  readonly continuous: boolean;
}

const ARRIVE_EPSILON = 1e-4;
const TURN_SPEED = 7.0;
const BLEND_IN_RATE = 1 / 0.18;
const BLEND_OUT_RATE = 1 / 0.26;

/**
 * Owns translation along the line: marker targeting, facing, gait phase.
 * Deliberately framework-free so it can be unit tested or reused by the real game.
 */
export class MovementController {
  private x: number;
  private yaw = 0;
  private walkBlend = 0;
  private gaitPhase = 0;
  private targetMarker: number | null = null;
  private continuous = false;
  private speed = 1.1;
  private cycleDistance = 0.8;

  constructor(private readonly markers: readonly number[]) {
    this.x = markers[0] ?? 0;
  }

  getMarkers(): readonly number[] {
    return this.markers;
  }

  setSpeed(speed: number): void {
    this.speed = Math.max(0.05, speed);
  }

  getSpeed(): number {
    return this.speed;
  }

  /** Keeps the gait tied to distance travelled when the body proportions change. */
  setCycleDistance(distance: number): void {
    this.cycleDistance = Math.max(0.05, distance);
  }

  setTarget(index: number): void {
    if (index < 0 || index >= this.markers.length) {
      return;
    }
    // Picking an explicit destination always wins over the patrol mode.
    this.continuous = false;
    this.targetMarker = index;
  }

  setContinuous(enabled: boolean): void {
    this.continuous = enabled;
    if (enabled) {
      this.targetMarker = this.pickPatrolTarget();
    }
  }

  isContinuous(): boolean {
    return this.continuous;
  }

  /** Used by the Walk button when the character is idle with nothing queued. */
  nudgeForward(): void {
    if (this.targetMarker !== null) {
      return;
    }
    const current = this.currentMarkerIndex();
    if (current === null) {
      this.targetMarker = this.nearestMarkerIndex();
      return;
    }
    this.targetMarker = current < this.markers.length - 1 ? current + 1 : current - 1;
  }

  reset(): void {
    this.x = this.markers[0] ?? 0;
    this.yaw = 0;
    this.walkBlend = 0;
    this.gaitPhase = 0;
    this.targetMarker = null;
    this.continuous = false;
  }

  update(dt: number): MovementSnapshot {
    if (dt > 0) {
      this.step(dt);
    }
    return this.snapshot();
  }

  snapshot(): MovementSnapshot {
    return {
      x: this.x,
      yaw: this.yaw,
      walkBlend: this.walkBlend,
      gaitPhase: this.gaitPhase,
      currentMarker: this.currentMarkerIndex(),
      targetMarker: this.targetMarker,
      moving: this.walkBlend > 0.01,
      continuous: this.continuous,
    };
  }

  private step(dt: number): void {
    const targetX = this.targetMarker !== null ? this.markers[this.targetMarker] : null;
    let remaining = 0;
    let direction = 0;

    if (targetX !== null) {
      remaining = targetX - this.x;
      if (Math.abs(remaining) <= ARRIVE_EPSILON) {
        this.x = targetX;
        remaining = 0;
        this.onArrived();
      } else {
        direction = Math.sign(remaining);
      }
    }

    const wantsToWalk = direction !== 0;

    if (direction !== 0) {
      const desiredYaw = direction > 0 ? 0 : Math.PI;
      this.yaw = turnToward(this.yaw, desiredYaw, TURN_SPEED * dt);
    }

    // Slow right down while the turn is in progress so he pivots on the spot.
    const alignment = Math.max(0, Math.cos(this.yaw - (direction >= 0 ? 0 : Math.PI)));
    const facingFactor = direction === 0 ? 0 : alignment * alignment;

    const blendTarget = wantsToWalk ? 1 : 0;
    const blendRate = wantsToWalk ? BLEND_IN_RATE : BLEND_OUT_RATE;
    this.walkBlend = approach(this.walkBlend, blendTarget, blendRate * dt);

    if (direction !== 0) {
      const velocity = this.speed * facingFactor * this.walkBlend;
      let step = velocity * dt;
      if (step >= Math.abs(remaining)) {
        step = Math.abs(remaining);
        this.x = targetX as number;
        this.onArrived();
      } else {
        this.x += direction * step;
      }
      this.gaitPhase = (this.gaitPhase + step / this.cycleDistance) % 1;
    }
  }

  private onArrived(): void {
    if (this.continuous) {
      this.targetMarker = this.targetMarker === 0 ? this.markers.length - 1 : 0;
    } else {
      this.targetMarker = null;
    }
  }

  private currentMarkerIndex(): number | null {
    for (let i = 0; i < this.markers.length; i++) {
      if (Math.abs(this.markers[i] - this.x) <= ARRIVE_EPSILON) {
        return i;
      }
    }
    return null;
  }

  private nearestMarkerIndex(): number {
    let best = 0;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (let i = 0; i < this.markers.length; i++) {
      const distance = Math.abs(this.markers[i] - this.x);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = i;
      }
    }
    return best;
  }

  private pickPatrolTarget(): number {
    const last = this.markers.length - 1;
    const current = this.currentMarkerIndex();
    if (current === last) {
      return 0;
    }
    if (current === 0) {
      return last;
    }
    return this.x <= (this.markers[0] + this.markers[last]) / 2 ? last : 0;
  }
}

function approach(value: number, target: number, maxDelta: number): number {
  const delta = target - value;
  if (Math.abs(delta) <= maxDelta) {
    return target;
  }
  return value + Math.sign(delta) * maxDelta;
}

/** Shortest-path yaw interpolation so he never spins the long way round. */
function turnToward(current: number, target: number, maxDelta: number): number {
  let delta = (target - current) % (Math.PI * 2);
  if (delta > Math.PI) {
    delta -= Math.PI * 2;
  }
  if (delta < -Math.PI) {
    delta += Math.PI * 2;
  }
  if (Math.abs(delta) <= maxDelta) {
    return target;
  }
  return current + Math.sign(delta) * maxDelta;
}

export function buildMarkerPositions(count: number, span: number): number[] {
  const positions: number[] = [];
  const spacing = span / (count - 1);
  const start = -span / 2;
  for (let i = 0; i < count; i++) {
    positions.push(start + spacing * i);
  }
  return positions;
}
