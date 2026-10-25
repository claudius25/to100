import {
  BufferGeometry,
  CapsuleGeometry,
  CatmullRomCurve3,
  Color,
  Group,
  LatheGeometry,
  Material,
  Mesh,
  MeshLambertMaterial,
  SphereGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
} from 'three';
import { computeMetrics, type CharacterConfig, type CharacterMetrics } from '../model/character-config';
import type { ArmJoints, CharacterRig, LegJoints } from '../model/character-rig';
import { attachOutline, type OutlineMaterialSet } from './outline';

const NEAR_BODY_COLOR = 0xfdfdfd;
const FAR_BODY_COLOR = 0xe6e7ea;
const DETAIL_COLOR = 0x33363a;

/**
 * Builds the whole character in code: capsules, spheres and two small lathe /
 * tube profiles for the nose and the hair curl. Joint pivots are plain Groups
 * placed at the anatomical joint, so the animator only sets rotations.
 */
export function createCharacter(config: CharacterConfig, outlines: OutlineMaterialSet): CharacterRig {
  const metrics = computeMetrics(config);
  const geometries: BufferGeometry[] = [];
  const materials: Material[] = [];

  const track = <T extends BufferGeometry>(geometry: T): T => {
    geometries.push(geometry);
    return geometry;
  };

  const nearSkin = new MeshLambertMaterial({ color: new Color(NEAR_BODY_COLOR) });
  const farSkin = new MeshLambertMaterial({ color: new Color(FAR_BODY_COLOR) });
  const detail = new MeshLambertMaterial({ color: new Color(DETAIL_COLOR) });
  materials.push(nearSkin, farSkin, detail);

  const bodyOutline = outlines.create(1);
  const fineOutline = outlines.create(0.45);

  const addPart = (
    parent: Group,
    geometry: BufferGeometry,
    material: Material,
    outline: 'body' | 'fine' | 'none' = 'body',
  ): Mesh => {
    const mesh = new Mesh(track(geometry), material);
    parent.add(mesh);
    if (outline !== 'none') {
      attachOutline(mesh as Mesh<BufferGeometry, Material>, outline === 'body' ? bodyOutline : fineOutline);
    }
    return mesh;
  };

  /** Capsule whose total length (caps included) is `length`, hanging down from y = 0. */
  const limbGeometry = (radius: number, length: number): CapsuleGeometry =>
    new CapsuleGeometry(radius, Math.max(0.0001, length - 2 * radius), 8, 20);

  const root = new Group();
  root.name = 'character-root';

  const pelvis = new Group();
  pelvis.name = 'pelvis';
  pelvis.position.y = metrics.hipHeight;
  root.add(pelvis);

  // Hip block keeps both hip pivots visually connected.
  const hipBlock = addPart(
    pelvis,
    new CapsuleGeometry(metrics.bodyRadius * 0.82, metrics.hipOffsetZ * 2, 6, 18),
    nearSkin,
  );
  hipBlock.rotation.x = Math.PI / 2;

  const torso = new Group();
  torso.name = 'torso';
  pelvis.add(torso);

  const torsoMesh = addPart(torso, torsoGeometry(metrics), nearSkin);
  torsoMesh.scale.set(0.96, 1, 0.9);

  const shoulderBlock = addPart(
    torso,
    new CapsuleGeometry(metrics.bodyRadius * 0.7, metrics.shoulderOffsetZ * 2, 6, 18),
    nearSkin,
  );
  shoulderBlock.position.y = metrics.shoulderY;
  shoulderBlock.rotation.x = Math.PI / 2;

  const neck = new Group();
  neck.name = 'neck';
  neck.position.y = metrics.torsoLength;
  torso.add(neck);

  const neckMesh = addPart(neck, limbGeometry(metrics.neckRadius, metrics.neckLength * 1.8), nearSkin);
  neckMesh.position.y = metrics.neckLength * 0.35;

  const head = new Group();
  head.name = 'head';
  head.position.y = metrics.neckLength;
  neck.add(head);
  buildHead(head, metrics, nearSkin, detail, addPart);

  const nearArm = buildArm(torso, metrics, +metrics.shoulderOffsetZ, nearSkin, addPart, limbGeometry);
  const farArm = buildArm(torso, metrics, -metrics.shoulderOffsetZ, farSkin, addPart, limbGeometry);
  const nearLeg = buildLeg(pelvis, metrics, +metrics.hipOffsetZ, nearSkin, addPart, limbGeometry);
  const farLeg = buildLeg(pelvis, metrics, -metrics.hipOffsetZ, farSkin, addPart, limbGeometry);

  return {
    root,
    pelvis,
    torso,
    neck,
    head,
    nearArm,
    farArm,
    nearLeg,
    farLeg,
    metrics,
    dispose: () => {
      root.removeFromParent();
      for (const geometry of geometries) {
        geometry.dispose();
      }
      for (const material of materials) {
        material.dispose();
      }
      geometries.length = 0;
      materials.length = 0;
    },
  };
}

type AddPart = (
  parent: Group,
  geometry: BufferGeometry,
  material: Material,
  outline?: 'body' | 'fine' | 'none',
) => Mesh;

type LimbGeometry = (radius: number, length: number) => CapsuleGeometry;

/**
 * Lathed torso profile: narrow waist, fuller chest, closed (radius -> 0) caps so
 * the inverted-hull outline never exposes an open edge.
 */
function torsoGeometry(metrics: CharacterMetrics): LatheGeometry {
  const r = metrics.bodyRadius;
  const t = metrics.torsoLength;
  const profile: Vector2[] = [
    new Vector2(0.001, -t * 0.14),
    new Vector2(r * 0.6, -t * 0.11),
    new Vector2(r * 0.97, -t * 0.01),
    new Vector2(r * 0.9, t * 0.2),
    new Vector2(r * 0.84, t * 0.38),
    new Vector2(r * 0.99, t * 0.6),
    new Vector2(r * 1.04, t * 0.78),
    new Vector2(r * 0.93, t * 0.93),
    new Vector2(r * 0.6, t * 1.03),
    new Vector2(r * 0.28, t * 1.08),
    new Vector2(0.001, t * 1.09),
  ];
  return new LatheGeometry(profile, 26);
}

function buildHead(
  head: Group,
  metrics: CharacterMetrics,
  skin: Material,
  detail: Material,
  addPart: AddPart,
): void {
  const r = metrics.headRadius;
  const centerY = r;

  const skull = addPart(head, new SphereGeometry(r, 32, 24), skin);
  skull.position.y = centerY;
  skull.scale.set(0.95, 1.06, 0.92);

  // Mature, slightly jutting chin / jaw.
  const chin = addPart(head, new SphereGeometry(r * 0.62, 24, 18), skin);
  chin.position.set(r * 0.36, centerY - r * 0.62, 0);
  chin.scale.set(1.08, 0.78, 0.76);

  // Lathe profile -> smooth, clearly projecting nose (no hard polygon seams).
  const noseLength = r * 1.0;
  const nosePoints = [
    new Vector2(0.001, 0),
    new Vector2(r * 0.3, noseLength * 0.05),
    new Vector2(r * 0.29, noseLength * 0.3),
    new Vector2(r * 0.24, noseLength * 0.55),
    new Vector2(r * 0.16, noseLength * 0.78),
    new Vector2(r * 0.07, noseLength * 0.95),
    new Vector2(0.001, noseLength),
  ];
  const nose = addPart(head, new LatheGeometry(nosePoints, 24), skin, 'fine');
  nose.rotation.z = -Math.PI / 2;
  nose.scale.set(1, 1, 0.9);
  nose.position.set(r * 0.62, centerY - r * 0.06, 0);

  const eye = addPart(head, new SphereGeometry(r * 0.1, 16, 12), detail, 'none');
  eye.position.set(r * 0.58, centerY + r * 0.28, r * 0.46);
  eye.scale.set(0.8, 1.2, 1);

  // Hair curl: a single swept tube, the only "drawn line" of the silhouette.
  const curl = new CatmullRomCurve3([
    new Vector3(-r * 0.3, centerY + r * 0.95, 0),
    new Vector3(-r * 0.08, centerY + r * 1.24, 0),
    new Vector3(r * 0.26, centerY + r * 1.33, 0),
    new Vector3(r * 0.44, centerY + r * 1.1, 0),
    new Vector3(r * 0.24, centerY + r * 0.98, 0),
  ]);
  addPart(head, new TubeGeometry(curl, 28, r * 0.055, 8, false), detail, 'none');
}

function buildArm(
  torso: Group,
  metrics: CharacterMetrics,
  offsetZ: number,
  skin: Material,
  addPart: AddPart,
  limbGeometry: LimbGeometry,
): ArmJoints {
  const shoulder = new Group();
  shoulder.name = `shoulder${offsetZ > 0 ? 'Near' : 'Far'}`;
  shoulder.position.set(0, metrics.shoulderY, offsetZ);
  torso.add(shoulder);

  addPart(shoulder, new SphereGeometry(metrics.armRadius * 1.18, 18, 14), skin);

  const upperArm = addPart(shoulder, limbGeometry(metrics.armRadius, metrics.upperArmLength), skin);
  upperArm.position.y = -metrics.upperArmLength / 2;

  const elbow = new Group();
  elbow.name = `elbow${offsetZ > 0 ? 'Near' : 'Far'}`;
  elbow.position.y = -metrics.upperArmLength;
  shoulder.add(elbow);

  addPart(elbow, new SphereGeometry(metrics.armRadius * 1.04, 16, 12), skin);

  const forearm = addPart(elbow, limbGeometry(metrics.armRadius * 0.92, metrics.forearmLength), skin);
  forearm.position.y = -metrics.forearmLength / 2;

  const hand = addPart(elbow, new SphereGeometry(metrics.handRadius, 18, 14), skin);
  hand.position.y = -metrics.forearmLength - metrics.handRadius * 0.3;
  hand.scale.set(1.1, 1.25, 0.72);

  return { shoulder, elbow };
}

function buildLeg(
  pelvis: Group,
  metrics: CharacterMetrics,
  offsetZ: number,
  skin: Material,
  addPart: AddPart,
  limbGeometry: LimbGeometry,
): LegJoints {
  const hip = new Group();
  hip.name = `hip${offsetZ > 0 ? 'Near' : 'Far'}`;
  hip.position.set(0, 0, offsetZ);
  pelvis.add(hip);

  addPart(hip, new SphereGeometry(metrics.thighRadius * 1.1, 18, 14), skin);

  const thigh = addPart(hip, limbGeometry(metrics.thighRadius, metrics.thighLength), skin);
  thigh.position.y = -metrics.thighLength / 2;

  const knee = new Group();
  knee.name = `knee${offsetZ > 0 ? 'Near' : 'Far'}`;
  knee.position.y = -metrics.thighLength;
  hip.add(knee);

  addPart(knee, new SphereGeometry(metrics.shinRadius * 1.15, 16, 12), skin);

  const shin = addPart(knee, limbGeometry(metrics.shinRadius, metrics.shinLength), skin);
  shin.position.y = -metrics.shinLength / 2;

  const ankle = new Group();
  ankle.name = `ankle${offsetZ > 0 ? 'Near' : 'Far'}`;
  ankle.position.y = -metrics.shinLength;
  knee.add(ankle);

  const foot = addPart(ankle, new SphereGeometry(1, 20, 14), skin);
  foot.scale.set(metrics.footLength * 0.5, metrics.ankleHeight * 0.92, metrics.footWidth * 0.5);
  foot.position.set(metrics.footLength * 0.16, -metrics.ankleHeight + metrics.ankleHeight * 0.92, 0);

  return { hip, knee, ankle };
}
