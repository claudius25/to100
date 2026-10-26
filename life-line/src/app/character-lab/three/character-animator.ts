import type { CharacterMetrics } from '../model/character-config';
import type { ArmJoints, CharacterRig, LegJoints } from '../model/character-rig';
import type { MovementSnapshot } from './movement-controller';

const TAU = Math.PI * 2;
/**
 * Fraction of the cycle each foot spends on the ground. Human walking sits
 * around 0.6-0.65, which leaves a short double-support overlap — a 50/50 split
 * is what makes naive walk cycles look mechanical.
 */
const STANCE_DUTY = 0.62;
/** Foot pitch (radians, + = toe up) at heel strike and at toe-off. */
const HEEL_STRIKE_PITCH = 0.2;
const TOE_OFF_PITCH = -0.5;
/** The arms trail the legs slightly rather than mirroring them exactly. */
const ARM_LAG = 0.05;

interface FootPose {
  /** Forward offset of the ankle, pelvis-local. */
  x: number;
  /** Ankle height above its resting height. */
  y: number;
  /** Absolute foot pitch, + = toe up. */
  pitch: number;
}

interface LegContext {
  pelvisY: number;
  pelvisYaw: number;
  pelvisRoll: number;
  maxFootX: number;
  strideRatio: number;
  idleX: number;
}

/**
 * Procedural walk / idle poser.
 *
 * Legs are driven by foot targets plus a two-segment analytic IK solve, which is
 * what keeps the stance foot planted on the ground line (no sliding) while the
 * pelvis bobs. Everything is a function of `gaitPhase` (distance based) and
 * `walkBlend`, so speed changes and stop/start are continuous, never snapped.
 *
 * Fluidity comes from layering: asymmetric stance/swing timing, a rolling foot
 * (heel strike -> flat -> toe-off), pelvis rotation with counter-rotating
 * shoulders, a stabilised head, and lagged arm/hand follow-through.
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
    const blend = clamp(state.walkBlend, 0, 1);
    const phase = state.gaitPhase;
    const theta = phase * TAU;
    const stride = state.strideLength;
    const strideRatio = clamp(stride / m.cycleDistance, 0.6, 1.6);
    const maxFootX = (stride * STANCE_DUTY) / 2;

    rig.root.position.x = state.x;
    rig.root.rotation.y = state.yaw;

    // Pelvis must drop enough that a straight leg still reaches the contact point.
    const reach = m.thighLength + m.shinLength;
    const crouch =
      (reach - Math.sqrt(Math.max(0, reach * reach - maxFootX * maxFootX))) * 1.1 + reach * 0.012;

    const breathe = Math.sin(this.idleClock * 1.6) * m.hipHeight * 0.005;
    const idleSway = Math.sin(this.idleClock * 0.73);
    const bob = -Math.cos(theta * 2) * m.bobAmplitude * (0.7 + 0.4 * strideRatio);

    const pelvisY = m.hipHeight - crouch * blend + bob * blend + breathe * (1 - 0.7 * blend);
    // Transverse pelvis rotation: the hip of the forward leg leads.
    const pelvisYaw = 0.09 * blend * Math.cos(theta) + 0.014 * (1 - blend) * idleSway;
    // Frontal-plane list, strongest just after each heel strike.
    const pelvisRoll = -0.022 * blend * Math.sin(theta);

    rig.pelvis.position.y = pelvisY;
    rig.pelvis.rotation.y = pelvisYaw;
    rig.pelvis.rotation.z = pelvisRoll;

    // Trunk: lean into the walk, counter-rotate the shoulders, damp the bob.
    const lean = -(0.042 + 0.028 * (strideRatio - 0.8)) * blend;
    rig.torso.rotation.z =
      lean - 0.016 * blend * Math.sin(theta * 2) - 0.006 * (1 - blend) * idleSway;
    rig.torso.rotation.y = -1.6 * pelvisYaw;
    rig.torso.position.y = -0.3 * bob * blend;

    rig.neck.rotation.z =
      0.038 * blend +
      0.014 * blend * Math.cos(theta * 2 + 0.7) +
      0.012 * (1 - blend) * Math.sin(this.idleClock * 1.1);
    // Gaze stabilisation: the head largely cancels the trunk's rotation.
    rig.head.rotation.y = -0.75 * (pelvisYaw + rig.torso.rotation.y);
    rig.head.rotation.z = -0.35 * rig.neck.rotation.z + 0.013 * blend * Math.cos(theta + 1.1);

    this.poseArm(rig.nearArm, theta, blend, 1, idleSway);
    this.poseArm(rig.farArm, theta, blend, -1, idleSway);

    const context: Omit<LegContext, 'idleX'> = {
      pelvisY,
      pelvisYaw,
      pelvisRoll,
      maxFootX,
      strideRatio,
    };
    this.poseLeg(rig.nearLeg, m, phase, blend, 1, { ...context, idleX: m.hipHeight * 0.03 });
    this.poseLeg(rig.farLeg, m, (phase + 0.5) % 1, blend, -1, {
      ...context,
      idleX: -m.hipHeight * 0.05,
    });
  }

  private poseArm(
    arm: ArmJoints,
    theta: number,
    blend: number,
    side: number,
    idleSway: number,
  ): void {
    const t = theta - ARM_LAG * TAU;
    // The second harmonic makes the backswing fuller than the forward swing,
    // which is what real arm swing looks like.
    const swing = Math.cos(t) - 0.16 * Math.cos(2 * t);
    const idleOffset = side > 0 ? -0.05 : 0.07;

    arm.shoulder.rotation.z =
      -0.46 * blend * swing * side + (idleOffset + 0.012 * idleSway * side) * (1 - blend);
    arm.shoulder.rotation.x = -0.09 * side;

    // "Forwardness" of this arm, normalised to roughly -1..1.
    const forward = clamp((-side * swing) / 1.16, -1, 1);
    arm.elbow.rotation.z = 0.12 + blend * (0.2 + 0.26 * (0.5 + 0.5 * forward));
    // The hand trails the forearm by a few hundredths of a cycle.
    const handLag = Math.cos(t - 0.55) * -side;
    arm.wrist.rotation.z = 0.05 + blend * 0.16 * handLag;
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
    hipSign: number,
    ctx: LegContext,
  ): void {
    const pose = this.footPose(phase, ctx.maxFootX, m, ctx.strideRatio);

    // Pivoting on the heel or the toe lifts the ankle; deriving the lift from
    // the pitch keeps the sole on the ground line through the whole roll.
    const heelDistance = m.footLength * 0.34;
    const toeDistance = m.footLength * 0.6;
    const roll =
      pose.pitch >= 0 ? Math.sin(pose.pitch) * heelDistance : Math.sin(-pose.pitch) * toeDistance;

    const targetX = pose.x * blend + ctx.idleX * (1 - blend);
    const targetY = (pose.y + roll) * blend;
    const pitch = pose.pitch * blend;

    // Hip pivot displacement caused by the rotating pelvis.
    const hipSwing = hipSign * m.hipOffsetZ * Math.sin(ctx.pelvisYaw);
    const hipX = hipSwing * Math.cos(ctx.pelvisRoll);
    const hipY = ctx.pelvisY + hipSwing * Math.sin(ctx.pelvisRoll);

    const thigh = m.thighLength;
    const shin = m.shinLength;
    const reach = thigh + shin;

    let dirX = targetX - hipX;
    let dirY = m.ankleHeight + targetY - hipY;
    let distance = Math.hypot(dirX, dirY);

    const maxReach = reach * 0.995;
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

    // Angles are absolute (root space), so subtract what the pelvis already applies.
    leg.hip.rotation.z = thighAngle - ctx.pelvisRoll;
    leg.knee.rotation.z = shinAngle - thighAngle;
    leg.ankle.rotation.z = -shinAngle + pitch;
  }

  private footPose(
    phase: number,
    maxFootX: number,
    m: CharacterMetrics,
    strideRatio: number,
  ): FootPose {
    if (phase < STANCE_DUTY) {
      const t = phase / STANCE_DUTY;
      const x = maxFootX - t * 2 * maxFootX;
      let pitch: number;
      if (t < 0.16) {
        // Heel strike rolling down to foot-flat.
        pitch = lerp(HEEL_STRIKE_PITCH, 0, smoothstep(t / 0.16));
      } else if (t < 0.58) {
        pitch = lerp(0, -0.05, (t - 0.16) / 0.42);
      } else {
        // Push off: the heel lifts and the ankle rises with it.
        pitch = lerp(-0.05, TOE_OFF_PITCH, smoothstep((t - 0.58) / 0.42));
      }
      return { x, y: 0, pitch };
    }

    const t = (phase - STANCE_DUTY) / (1 - STANCE_DUTY);
    const x = -maxFootX + smootherstep(t) * 2 * maxFootX;
    const lift = Math.sin(Math.PI * Math.pow(t, 0.8)) * m.footLift * (0.8 + 0.3 * strideRatio);
    const pitch =
      t < 0.45
        ? lerp(TOE_OFF_PITCH, 0.17, smoothstep(t / 0.45))
        : lerp(0.17, HEEL_STRIKE_PITCH, smoothstep((t - 0.45) / 0.55));
    return { x, y: lift, pitch };
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * clamp(t, 0, 1);
}

function smoothstep(t: number): number {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}

/** Gentler ends than smoothstep; used for the swing foot so contact is soft. */
function smootherstep(t: number): number {
  const x = clamp(t, 0, 1);
  return x * x * x * (x * (x * 6 - 15) + 10);
}
