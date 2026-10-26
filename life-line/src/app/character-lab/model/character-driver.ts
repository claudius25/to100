import type { Object3D } from 'three';
import type { MovementSnapshot } from '../three/movement-controller';

/**
 * What the scene needs from "a character", regardless of whether it is the
 * procedural rig or an imported skinned GLB.
 *
 * Both implementations own their own root `Object3D`, consume the same
 * `MovementSnapshot`, and report the gait figures the movement controller needs
 * to keep the feet tied to distance travelled.
 */
export interface CharacterDriver {
  /** Added to the scene by the controller; carries world placement. */
  readonly root: Object3D;
  /** Ground distance covered by one full gait cycle. */
  readonly cycleDistance: number;
  /** Speed at which that stride looks natural. */
  readonly preferredSpeed: number;
  /**
   * False when the stride is baked into an animation clip and must not be
   * stretched by the movement controller (imported clips).
   */
  readonly adaptiveStride: boolean;
  update(dt: number, state: MovementSnapshot): void;
  setOutlineThickness(worldThickness: number): void;
  dispose(): void;
}

export type CharacterMode = 'procedural' | 'glb';
