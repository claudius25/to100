import type { Group } from 'three';
import type { CharacterMetrics } from './character-config';

/**
 * Hierarchical joint pivots. Every pivot is an empty `THREE.Group` placed at the
 * real joint position; meshes hang below their pivot. The rig `root` only ever
 * carries world placement (x position + yaw), never animation, so a rigged GLB
 * can be swapped in later by implementing this same interface.
 */
export interface LegJoints {
  readonly hip: Group;
  readonly knee: Group;
  readonly ankle: Group;
}

export interface ArmJoints {
  readonly shoulder: Group;
  readonly elbow: Group;
  /** Carries the hand; used for a little follow-through on the swing. */
  readonly wrist: Group;
}

export interface CharacterRig {
  /** World placement node: position.x along the line, rotation.y for facing. */
  readonly root: Group;
  readonly pelvis: Group;
  readonly torso: Group;
  readonly neck: Group;
  readonly head: Group;
  /** Limb nearest the camera (+Z). */
  readonly nearArm: ArmJoints;
  readonly farArm: ArmJoints;
  readonly nearLeg: LegJoints;
  readonly farLeg: LegJoints;
  readonly metrics: CharacterMetrics;
  /** Releases every geometry/material owned by this rig. */
  dispose(): void;
}
