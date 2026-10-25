import type { CharacterMetrics } from '../model/character-config';
import type { ArmJoints, CharacterRig, LegJoints } from '../model/character-rig';
import type { MovementSnapshot } from './movement-controller';

const TAU = Math.PI * 2;

interface FootTarget {
  x: number;
  y: number;
}

/**
 * Procedural walk / idle poser.
 *
 * Legs are driven by foot targets + a two-segment analytic IK solve, which is
 * what keeps the stance foot planted on the ground line (no sliding) while the
 * pelvis bobs. Everything is a function of `gaitPhase` (distance based) and
 * `walkBlend`, so speed changes and stop/start are continuous, never snapped.
 */
export class CharacterAnimator {
  private rig: CharacterRig | null = null;
  private idleClock = 0;

  setRig(rig: CharacterRig | null): void {
    this.rig = rig;
  }

  /** Called with dt = 0 while paused, which freezes the pose exactly. */
  update(dt: number, state: MovementSnapshot): void {
    const rig = this.rig;
    if (!rig) {
      return;
    }

    this.idleClock += dt;

    const m = rig.metrics;
    const blend = state.walkBlend;
    const phase = state.gaitPhase;

    rig.root.position.x = state.x;
    rig.root.rotation.y = state.yaw;

    const breathe = Math.sin(this.idleClock * 1.6) * m.hipHeight * 0.004;
    const bob = -Math.cos(phase * TAU * 2) * m.bobAmplitude;
    const pelvisY = m.hipHeight - m.walkCrouch * blend + bob * blend + breathe * (1 - blend * 0.6);
    rig.pelvis.position.y = pelvisY;

    // Torso: slight forward lean while walking plus a small counter-sway.
    rig.torso.rotation.z = -0.055 * blend - 0.02 * blend * Math.sin(phase * TAU);
    rig.torso.rotation.y = 0.07 * blend * Math.sin(phase * TAU);
    rig.neck.rotation.z = 0.045 * blend + 0.012 * Math.sin(this.idleClock * 1.2) * (1 - blend);
    rig.head.rotation.z = 0.015 * blend * Math.sin(phase * TAU + Math.PI / 2);

    this.poseArm(rig.nearArm, phase, blend, 1);
    this.poseArm(rig.farArm, phase, blend, -1);

    this.poseLeg(rig.nearLeg, m, phase, blend, pelvisY, m.hipHeight * 0.03);
    this.poseLeg(rig.farLeg, m, (phase + 0.5) % 1, blend, pelvisY, -m.hipHeight * 0.05);
  }

  private poseArm(arm: ArmJoints, phase: number, blend: number, side: number): void {
    const swing = Math.cos(phase * TAU) * side;
    // Arms swing opposite to the leg on the same side; the idle offset keeps the
    // near and far arm from hiding each other in the side view.
    const idleSwing = side > 0 ? -0.05 : 0.07;
    arm.shoulder.rotation.z = -0.52 * blend * swing + idleSwing * (1 - blend);
    arm.shoulder.rotation.x = -0.09 * side;
    const idleBend = 0.12;
    arm.elbow.rotation.z = idleBend + blend * (0.28 + 0.3 * (0.5 - 0.5 * swing));
  }

  /**
   * Foot target in pelvis-local space, then analytic 2-link IK.
   * Stance moves the foot backwards exactly as fast as the root moves forward.
   */
  private poseLeg(
    leg: LegJoints,
    m: CharacterMetrics,
    phase: number,
    blend: number,
    pelvisY: number,
    idleOffsetX: number,
  ): void {
    const target = this.footTarget(phase, m, blend, idleOffsetX);

    const hipToFootX = target.x;
    const hipToFootY = m.ankleHeight + target.y - pelvisY;

    const thigh = m.thighLength;
    const shin = m.shinLength;
    const reach = thigh + shin;

    let distance = Math.hypot(hipToFootX, hipToFootY);
    const maxReach = reach * 0.995;
    let dirX = hipToFootX;
    let dirY = hipToFootY;
    if (distance > maxReach) {
      const k = maxReach / distance;
      dirX *= k;
      dirY *= k;
      distance = maxReach;
    }
    const minReach = Math.abs(thigh - shin) * 1.05 + 1e-4;
    if (distance < minReach) {
      const k = minReach / Math.max(distance, 1e-6);
      dirX *= k;
      dirY *= k;
      distance = minReach;
    }

    // Angle of the hip -> foot line measured from straight down, positive = forward.
    const lineAngle = Math.atan2(dirX, -dirY);
    const hipOffset = Math.acos(
      clamp((thigh * thigh + distance * distance - shin * shin) / (2 * thigh * distance), -1, 1),
    );
    const kneeOffset = Math.acos(
      clamp((shin * shin + distance * distance - thigh * thigh) / (2 * shin * distance), -1, 1),
    );

    const thighAngle = lineAngle + hipOffset;
    const shinAngle = lineAngle - kneeOffset;

    leg.hip.rotation.z = thighAngle;
    leg.knee.rotation.z = shinAngle - thighAngle;

    // Keep the sole parallel to the ground, with a little toe-up during swing.
    const toeUp = phase >= 0.5 ? Math.sin((phase - 0.5) * 2 * Math.PI) * 0.22 * blend : 0;
    leg.ankle.rotation.z = -shinAngle + toeUp;
  }

  private footTarget(phase: number, m: CharacterMetrics, blend: number, idleX: number): FootTarget {
    const stride = m.cycleDistance;
    let x: number;
    let y: number;

    if (phase < 0.5) {
      const t = phase / 0.5;
      x = stride / 4 - t * (stride / 2);
      y = 0;
    } else {
      const t = (phase - 0.5) / 0.5;
      const eased = t * t * (3 - 2 * t);
      x = -stride / 4 + eased * (stride / 2);
      y = Math.sin(Math.PI * t) * m.footLift;
    }

    // Idle target is a relaxed stance, so blending between the two is a plain lerp.
    return { x: x * blend + idleX * (1 - blend), y: y * blend };
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
