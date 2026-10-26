import {
  AnimationClip,
  AnimationMixer,
  Box3,
  Color,
  Group,
  LoopRepeat,
  Mesh,
  MeshLambertMaterial,
  Object3D,
  SkinnedMesh,
  Vector3,
  type AnimationAction,
  type KeyframeTrack,
  type Material,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { CharacterDriver } from '../model/character-driver';
import type { MovementSnapshot } from './movement-controller';
import { SkinnedOutline } from './skinned-outline';

const NEAR_BODY_COLOR = 0xfbfbfc;
const JOINT_COLOR = 0xdfe1e5;
const OUTLINE_COLOR = 0x2f3236;
/** The exported mannequin walks along +Z; the lab walks along +X. */
const MODEL_FORWARD_YAW = Math.PI / 2;
/** Fallback stride if a clip turns out to have no root motion at all. */
const FALLBACK_STRIDE_RATIO = 0.82;

export interface GlbCharacterAssets {
  readonly idleUrl: string;
  readonly walkUrl: string;
}

/** Samples of "distance travelled by the root" against clip time. */
interface RootMotion {
  /** Normalised distance 0..1 for each sample. */
  readonly progress: number[];
  readonly times: number[];
  /** Total forward distance of one loop, in model units. */
  readonly distance: number;
}

/**
 * Imported skinned character.
 *
 * The walk clip ships with baked root motion, so instead of guessing a stride we
 * read the root track, strip it (the movement controller owns translation), and
 * invert it: clip time is looked up from distance travelled. That keeps the feet
 * locked to the ground at any speed, exactly like the procedural rig's IK does.
 */
export class GlbCharacter implements CharacterDriver {
  readonly root = new Group();
  readonly adaptiveStride = false;

  private readonly modelRoot = new Group();
  private readonly mixer: AnimationMixer;
  private readonly idleAction: AnimationAction;
  private readonly walkAction: AnimationAction;
  private readonly outline: SkinnedOutline;
  private readonly materials: Material[] = [];
  private readonly model: Object3D;
  private readonly rootMotion: RootMotion;
  private readonly modelHeight: number;
  private scale = 1;
  private disposed = false;

  constructor(
    model: Object3D,
    idleClip: AnimationClip,
    walkClip: AnimationClip,
    rootMotion: RootMotion,
    modelHeight: number,
    height: number,
  ) {
    this.model = model;
    this.rootMotion = rootMotion;
    this.modelHeight = modelHeight;

    this.root.name = 'glb-character-root';
    this.modelRoot.name = 'glb-model-root';
    this.modelRoot.rotation.y = MODEL_FORWARD_YAW;
    this.modelRoot.add(model);
    this.root.add(this.modelRoot);

    this.restyle();

    this.outline = new SkinnedOutline(OUTLINE_COLOR);
    this.outline.attachTo(model);

    this.mixer = new AnimationMixer(model);
    this.idleAction = this.mixer.clipAction(idleClip);
    this.walkAction = this.mixer.clipAction(walkClip);

    this.idleAction.setLoop(LoopRepeat, Infinity);
    this.walkAction.setLoop(LoopRepeat, Infinity);
    // The walk clip is scrubbed by distance, so the mixer must not advance it.
    this.walkAction.timeScale = 0;
    this.idleAction.play();
    this.walkAction.play();
    this.idleAction.setEffectiveWeight(1);
    this.walkAction.setEffectiveWeight(0);

    this.setHeight(height);
  }

  get cycleDistance(): number {
    return this.rootMotion.distance * this.scale;
  }

  get preferredSpeed(): number {
    const duration = this.walkAction.getClip().duration;
    return duration > 0 ? this.cycleDistance / duration : 1;
  }

  /** Uniform scale to the requested total height; feet stay on y = 0. */
  setHeight(height: number): void {
    this.scale = height / this.modelHeight;
    this.modelRoot.scale.setScalar(this.scale);
    this.outline.setModelScale(this.scale);
  }

  setOutlineThickness(worldThickness: number): void {
    this.outline.setThickness(worldThickness);
  }

  update(dt: number, state: MovementSnapshot): void {
    if (this.disposed) {
      return;
    }
    this.root.position.x = state.x;
    this.root.rotation.y = state.yaw;

    const blend = Math.min(1, Math.max(0, state.walkBlend));
    this.idleAction.setEffectiveWeight(1 - blend);
    this.walkAction.setEffectiveWeight(blend);
    this.walkAction.time = this.timeForProgress(state.gaitPhase);

    this.mixer.update(dt);
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;

    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.model);
    this.outline.dispose();

    const geometries = new Set<{ dispose(): void }>();
    this.model.traverse((child) => {
      const mesh = child as Mesh;
      if (mesh.isMesh) {
        geometries.add(mesh.geometry);
      }
      const skinned = child as SkinnedMesh;
      if (skinned.isSkinnedMesh) {
        skinned.skeleton.dispose();
      }
    });
    for (const geometry of geometries) {
      geometry.dispose();
    }
    for (const material of this.materials) {
      material.dispose();
    }
    this.materials.length = 0;
    this.root.removeFromParent();
    this.root.clear();
  }

  /** Replaces the imported PBR materials with the lab's pale, outlined look. */
  private restyle(): void {
    const body = new MeshLambertMaterial({ color: new Color(NEAR_BODY_COLOR) });
    const joints = new MeshLambertMaterial({ color: new Color(JOINT_COLOR) });
    this.materials.push(body, joints);

    this.model.traverse((child) => {
      const mesh = child as Mesh;
      if (!mesh.isMesh) {
        return;
      }
      const original = mesh.material;
      const originals = Array.isArray(original) ? original : [original];
      const isJoint = originals.some((material) => /joint/i.test(material?.name ?? ''));
      mesh.material = isJoint ? joints : body;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.frustumCulled = false;
      for (const material of originals) {
        material?.dispose();
      }
    });
  }

  /** Piecewise-linear inverse of the baked root motion curve. */
  private timeForProgress(phase: number): number {
    const { progress, times } = this.rootMotion;
    const u = ((phase % 1) + 1) % 1;
    if (progress.length < 2) {
      return u * this.walkAction.getClip().duration;
    }
    let low = 0;
    let high = progress.length - 1;
    while (high - low > 1) {
      const mid = (low + high) >> 1;
      if (progress[mid] <= u) {
        low = mid;
      } else {
        high = mid;
      }
    }
    const span = progress[high] - progress[low];
    const t = span > 1e-9 ? (u - progress[low]) / span : 0;
    return times[low] + (times[high] - times[low]) * t;
  }
}

/**
 * Loads the two clips. The idle file supplies the mesh and skeleton; only the
 * clip is taken from the walk file (identical rig), which keeps one skinned
 * model in memory instead of two.
 */
export async function loadGlbCharacter(
  assets: GlbCharacterAssets,
  height: number,
): Promise<GlbCharacter> {
  const loader = new GLTFLoader();
  const [idleGltf, walkGltf] = await Promise.all([
    loader.loadAsync(assets.idleUrl),
    loader.loadAsync(assets.walkUrl),
  ]);

  const model = idleGltf.scene;
  const idleClip = idleGltf.animations[0];
  const walkClip = walkGltf.animations[0];
  if (!idleClip || !walkClip) {
    disposeScene(walkGltf.scene);
    throw new Error('GLB assets do not contain the expected idle/walk animation clips.');
  }

  const rootMotion = extractRootMotion(walkClip);

  // The walk-file mesh is redundant once its clip has been harvested.
  disposeScene(walkGltf.scene);

  const bounds = new Box3().setFromObject(model);
  const size = bounds.getSize(new Vector3());
  const modelHeight = size.y > 1e-3 ? size.y : 1.8;

  if (rootMotion.distance <= 1e-3) {
    rootMotion.distance = modelHeight * FALLBACK_STRIDE_RATIO;
  }

  return new GlbCharacter(model, idleClip, walkClip, rootMotion, modelHeight, height);
}

/**
 * Finds the baked forward motion, records its distance/time samples and removes
 * the track so the model animates in place.
 */
function extractRootMotion(clip: AnimationClip): RootMotion & { distance: number } {
  let best: KeyframeTrack | null = null;
  let bestDistance = 0;
  let bestAxis = 2;

  for (const track of clip.tracks) {
    if (!track.name.endsWith('.position')) {
      continue;
    }
    const values = track.values;
    const count = values.length / 3;
    if (count < 2) {
      continue;
    }
    for (let axis = 0; axis < 3; axis++) {
      const distance = Math.abs(values[(count - 1) * 3 + axis] - values[axis]);
      if (distance > bestDistance) {
        bestDistance = distance;
        best = track;
        bestAxis = axis;
      }
    }
  }

  if (!best || bestDistance <= 1e-3) {
    return { progress: [0, 1], times: [0, clip.duration], distance: 0 };
  }

  const values = best.values;
  const times = Array.from(best.times);
  const start = values[bestAxis];
  const sign = Math.sign(values[(times.length - 1) * 3 + bestAxis] - start) || 1;

  const progress: number[] = [];
  let travelled = 0;
  let previous = 0;
  for (let i = 0; i < times.length; i++) {
    // Monotonic distance, so the inverse lookup always has a solution.
    const raw = (values[i * 3 + bestAxis] - start) * sign;
    travelled = Math.max(previous, raw);
    previous = travelled;
    progress.push(travelled);
  }

  const total = progress[progress.length - 1];
  for (let i = 0; i < progress.length; i++) {
    progress[i] = total > 0 ? progress[i] / total : i / (progress.length - 1);
  }

  clip.tracks = clip.tracks.filter((track) => track !== best);

  return { progress, times, distance: total };
}

function disposeScene(scene: Object3D): void {
  scene.traverse((child) => {
    const mesh = child as Mesh;
    if (!mesh.isMesh) {
      return;
    }
    mesh.geometry.dispose();
    const material = mesh.material;
    for (const entry of Array.isArray(material) ? material : [material]) {
      entry?.dispose();
    }
  });
  scene.removeFromParent();
}
