import { MathUtils, OrthographicCamera, Vector3 } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { smoothstep, toVector3, type CameraRequest, type ProgressFn } from './interaction.types';
import { NURSERY_VIEW } from './nursery.config';

interface ActiveTransition {
  readonly startMs: number;
  readonly durationMs: number;
  readonly from: Vector3;
  readonly to: Vector3;
  readonly fromTarget: Vector3;
  readonly toTarget: Vector3;
  readonly fromZoom: number;
  readonly toZoom: number;
  readonly onProgress: ProgressFn | null;
}

/**
 * Owns the orthographic camera and the orbit controls, and runs at most one
 * transition at a time. Objects animate their own poses through the request's
 * `onProgress` callback rather than starting loops of their own.
 */
export class CameraController {
  readonly camera = new OrthographicCamera(-1, 1, 1, -1, NURSERY_VIEW.near, NURSERY_VIEW.far);
  readonly controls: OrbitControls;
  private transition: ActiveTransition | null = null;

  constructor(domElement: HTMLElement) {
    this.controls = new OrbitControls(this.camera, domElement);
    this.controls.enableDamping = true;
    this.controls.maxPolarAngle = NURSERY_VIEW.maxPolarAngle;
    this.camera.position.copy(toVector3(NURSERY_VIEW.roomOffset));
    this.controls.target.copy(toVector3(NURSERY_VIEW.roomTarget));
    this.controls.update();
  }

  get animating(): boolean {
    return this.transition !== null;
  }

  resize(width: number, height: number): void {
    const span = NURSERY_VIEW.verticalSpan;
    const aspect = height > 0 ? width / height : 1;
    this.camera.left = (-span * aspect) / 2;
    this.camera.right = (span * aspect) / 2;
    this.camera.top = span / 2;
    this.camera.bottom = -span / 2;
    this.camera.updateProjectionMatrix();
  }

  /**
   * Replaces any running transition. The old one is settled at its end pose
   * first so an interrupted object can never be left half-turned.
   */
  moveTo(request: CameraRequest, nowMs = performance.now()): void {
    this.transition?.onProgress?.(1, 1);
    this.transition = {
      startMs: nowMs,
      durationMs: Math.max(1, request.durationMs),
      from: this.camera.position.clone(),
      to: request.target.clone().add(request.offset),
      fromTarget: this.controls.target.clone(),
      toTarget: request.target.clone(),
      fromZoom: this.camera.zoom,
      toZoom: request.zoom,
      onProgress: request.onProgress ?? null,
    };
    this.controls.enabled = false;
  }

  /** Advances the transition and the damping. Returns true while transitioning. */
  update(nowMs = performance.now()): boolean {
    const transition = this.transition;
    if (transition) {
      const linear = Math.min(1, (nowMs - transition.startMs) / transition.durationMs);
      const smooth = smoothstep(linear);
      this.camera.position.lerpVectors(transition.from, transition.to, smooth);
      this.controls.target.lerpVectors(transition.fromTarget, transition.toTarget, smooth);
      this.camera.zoom = MathUtils.lerp(transition.fromZoom, transition.toZoom, smooth);
      this.camera.updateProjectionMatrix();
      transition.onProgress?.(linear, smooth);
      if (linear === 1) {
        this.transition = null;
        this.controls.enabled = true;
      }
    }
    this.controls.update();
    return transition !== null;
  }

  onOrbitStart(listener: () => void): void {
    this.controls.addEventListener('start', listener);
  }

  dispose(): void {
    this.transition = null;
    this.controls.dispose();
  }
}
