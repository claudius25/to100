import {
  BoxGeometry,
  CanvasTexture,
  DirectionalLight,
  DoubleSide,
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PCFShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  Raycaster,
  Scene,
  ShadowMaterial,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
  Color,
  type BufferGeometry,
  type Material,
  type Object3D,
  type Texture,
} from 'three';
import {
  BLUEPRINT_LEVEL_COUNT,
  BLUEPRINT_TRAITS,
  type TraitResult,
} from '../model/starting-blueprint';
import type { TowerVisual } from './blueprint-sequence';
import { drawFace, FACE_TEXTURE_SIZE } from './face-textures';
import {
  cubeRestY,
  cubeSize,
  FIRST_CUBE_ANGLE,
  FLAP_OPEN_ANGLE,
  popScale,
  restingAngle,
  revealPose,
  SIDE_FACES,
  spinPose,
  spinTarget,
  type RevealPath,
  type TowerTimings,
} from './tower-animation';

const BACKGROUND = '#fafaf8';
const FOV = 32;
/** Viewing direction from the prototype camera (8, 6.5, 13) looking at y = 3.3. */
const CAMERA_DIRECTION = new Vector3(8, 3.2, 13).normalize();
export const VIEW_AZIMUTH = Math.atan2(CAMERA_DIRECTION.x, CAMERA_DIRECTION.z);
/** Frames the full tower plus the highest airborne arc, clear of the footer controls. */
const FRAME_TARGET = new Vector3(0, 3.2, 0);
const FRAME_HEIGHT = 10.4;
const FRAME_WIDTH = 6.4;

interface CubeEntry {
  readonly index: number;
  readonly mesh: Mesh<BoxGeometry, MeshStandardMaterial[]>;
  readonly size: number;
  readonly restY: number;
  readonly flaps: Group[];
}

interface SpinAnimation {
  readonly cube: CubeEntry;
  readonly start: number;
  readonly from: number;
  readonly to: number;
  readonly done: () => void;
}

interface RevealAnimation {
  readonly cube: CubeEntry;
  readonly parent: CubeEntry;
  readonly start: number;
  readonly path: RevealPath;
  readonly done: () => void;
}

export function isWebGLAvailable(): boolean {
  try {
    if (typeof window === 'undefined' || typeof window.WebGLRenderingContext === 'undefined') {
      return false;
    }
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

/**
 * Owns the WebGL renderer, camera, resize handling and animation loop for the
 * blueprint tower. It has no Angular dependency; the sequence decides results.
 */
export class BlueprintTowerScene implements TowerVisual {
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(FOV, 1, 0.1, 100);
  private readonly raycaster = new Raycaster();
  private readonly pointer = new Vector2();
  private readonly sharedGeometries: BufferGeometry[] = [];
  private readonly sharedMaterials: Material[] = [];
  private readonly sharedTextures: Texture[] = [];
  private faceTextures: CanvasTexture[][] = [];
  private renderer: WebGLRenderer | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private frameId: number | null = null;
  private cubes: CubeEntry[] = [];
  private pop: { cube: CubeEntry; start: number } | null = null;
  private spinning: SpinAnimation | null = null;
  private revealing: RevealAnimation | null = null;
  private interactiveIndex: number | null = null;
  private disposed = false;

  constructor(
    private readonly host: HTMLElement,
    private readonly onCubePress: (index: number) => void,
    private readonly timings: TowerTimings,
  ) {}

  /** Throws when WebGL cannot be created so the caller can switch to its fallback. */
  init(): void {
    if (this.renderer || this.disposed) {
      return;
    }
    const renderer = new WebGLRenderer({ antialias: true });
    this.renderer = renderer;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = PCFShadowMap;
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.domElement.classList.add('tower-canvas');
    renderer.domElement.setAttribute('aria-hidden', 'true');
    this.host.appendChild(renderer.domElement);

    this.buildStudio();
    this.buildTextures(renderer.capabilities.getMaxAnisotropy());

    renderer.domElement.addEventListener('pointerdown', this.handlePointerDown);
    renderer.domElement.addEventListener('pointermove', this.handlePointerMove);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.host);
    this.resize();
    this.frameId = requestAnimationFrame(this.frame);
  }

  setInteractive(index: number | null): void {
    this.interactiveIndex = index;
    if (index === null && this.renderer) {
      this.renderer.domElement.style.cursor = '';
    }
  }

  reset(): void {
    this.spinning = null;
    this.revealing = null;
    this.pop = null;
    for (const cube of this.cubes) {
      this.scene.remove(cube.mesh);
      disposeCube(cube.mesh);
    }
    this.cubes = [];
    if (this.disposed || !this.renderer) {
      return;
    }
    const first = this.addCube(0);
    first.mesh.rotation.y = FIRST_CUBE_ANGLE;
    if (this.timings.popMs > 0) {
      first.mesh.scale.setScalar(0.001);
      this.pop = { cube: first, start: performance.now() };
    }
  }

  spin(index: number, result: TraitResult, done: () => void): void {
    const cube = this.cubes[index];
    if (!cube) {
      return;
    }
    const from = cube.mesh.rotation.y;
    this.spinning = {
      cube,
      start: performance.now(),
      from,
      to: spinTarget(from, result.level, VIEW_AZIMUTH, this.timings.spinTurns),
      done,
    };
  }

  reveal(index: number, done: () => void): void {
    const parent = this.cubes[index - 1];
    if (!parent || this.cubes[index]) {
      return;
    }
    const cube = this.addCube(index);
    const alignedAngle = parent.mesh.rotation.y;
    cube.mesh.visible = false;
    cube.mesh.position.y = parent.mesh.position.y;
    cube.mesh.rotation.y = alignedAngle;
    this.revealing = {
      cube,
      parent,
      start: performance.now(),
      path: {
        from: parent.mesh.position.y,
        to: cube.restY,
        size: cube.size,
        alignedAngle,
        restingAngle: restingAngle(index, alignedAngle),
      },
      done,
    };
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    if (this.frameId !== null) {
      cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.reset();
    for (const geometry of this.sharedGeometries) {
      geometry.dispose();
    }
    for (const material of this.sharedMaterials) {
      material.dispose();
    }
    for (const texture of [...this.sharedTextures, ...this.faceTextures.flat()]) {
      texture.dispose();
    }
    this.faceTextures = [];
    const renderer = this.renderer;
    if (renderer) {
      renderer.domElement.removeEventListener('pointerdown', this.handlePointerDown);
      renderer.domElement.removeEventListener('pointermove', this.handlePointerMove);
      renderer.dispose();
      renderer.domElement.remove();
      this.renderer = null;
    }
  }

  private buildStudio(): void {
    this.scene.background = new Color(BACKGROUND);
    this.scene.add(new HemisphereLight(0xffffff, 0xc4c6c0, 2.7));

    const light = new DirectionalLight(0xffffff, 3);
    light.position.set(-3, 10, 6);
    light.castShadow = true;
    light.shadow.mapSize.set(2048, 2048);
    Object.assign(light.shadow.camera, { left: -8, right: 8, top: 12, bottom: -8 });
    light.shadow.normalBias = 0.03;
    light.shadow.radius = 5;
    this.scene.add(light);

    // Shadow-only floor: the studio background stays seamless with the page.
    const floorGeometry = new PlaneGeometry(200, 200);
    const floorMaterial = new ShadowMaterial({ color: 0x30403a, opacity: 0.14 });
    const floor = new Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // A broad translucent contact shadow softens the studio floor.
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 256;
    const context = canvas.getContext('2d');
    if (context) {
      const gradient = context.createRadialGradient(128, 128, 0, 128, 128, 128);
      gradient.addColorStop(0, 'rgba(50,60,50,.2)');
      gradient.addColorStop(1, 'rgba(50,60,50,0)');
      context.fillStyle = gradient;
      context.fillRect(0, 0, 256, 256);
    }
    const shadowTexture = new CanvasTexture(canvas);
    shadowTexture.colorSpace = SRGBColorSpace;
    const shadowGeometry = new PlaneGeometry(6, 6);
    const shadowMaterial = new MeshBasicMaterial({
      map: shadowTexture,
      transparent: true,
      depthWrite: false,
    });
    const contact = new Mesh(shadowGeometry, shadowMaterial);
    contact.rotation.x = -Math.PI / 2;
    contact.position.y = 0.012;
    this.scene.add(contact);

    this.sharedGeometries.push(floorGeometry, shadowGeometry);
    this.sharedMaterials.push(floorMaterial, shadowMaterial);
    this.sharedTextures.push(shadowTexture);
  }

  /** Face textures are shared by every reset and disposed once with the scene. */
  private buildTextures(anisotropy: number): void {
    this.faceTextures = BLUEPRINT_TRAITS.map((_, traitIndex) =>
      Array.from({ length: BLUEPRINT_LEVEL_COUNT }, (_, levelIndex) => {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = FACE_TEXTURE_SIZE;
        const context = canvas.getContext('2d');
        if (context) {
          drawFace(context, traitIndex, levelIndex);
        }
        const texture = new CanvasTexture(canvas);
        texture.colorSpace = SRGBColorSpace;
        texture.anisotropy = Math.min(8, anisotropy);
        return texture;
      }),
    );
  }

  private addCube(index: number): CubeEntry {
    const size = cubeSize(index);
    const color = BLUEPRINT_TRAITS[index].color;
    const materials = Array.from({ length: 6 }, (_, materialIndex) => {
      const face = SIDE_FACES.find((side) => side.materialIndex === materialIndex);
      return face
        ? new MeshStandardMaterial({
            map: this.faceTextures[index][face.level - 1],
            color: 'white',
            roughness: 0.85,
          })
        : new MeshStandardMaterial({ color, roughness: 0.85 });
    });
    // The top face is replaced by hinged flaps.
    materials[2].transparent = true;
    materials[2].opacity = 0;
    materials[2].depthWrite = false;

    const mesh = new Mesh(new BoxGeometry(size, size, size), materials);
    mesh.position.y = cubeRestY(index);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData['cubeIndex'] = index;

    const flapGeometry = new PlaneGeometry(size, size / 2);
    const flapMaterial = new MeshStandardMaterial({ color, side: DoubleSide, roughness: 0.75 });
    const flaps: Group[] = [];
    for (let k = 0; k < 4; k++) {
      const pivot = new Group();
      pivot.position.y = size / 2;
      pivot.rotation.y = (k * Math.PI) / 2;
      const hinge = new Group();
      hinge.position.z = size / 2;
      const panel = new Mesh(flapGeometry, flapMaterial);
      panel.rotation.x = -Math.PI / 2;
      panel.position.z = -size / 4;
      panel.userData['cubeIndex'] = index;
      hinge.add(panel);
      pivot.add(hinge);
      mesh.add(pivot);
      flaps.push(hinge);
    }

    const entry: CubeEntry = { index, mesh, size, restY: mesh.position.y, flaps };
    this.scene.add(mesh);
    this.cubes[index] = entry;
    return entry;
  }

  private readonly frame = (now: number): void => {
    if (this.disposed || !this.renderer) {
      return;
    }
    this.frameId = requestAnimationFrame(this.frame);

    if (this.pop) {
      const progress = (now - this.pop.start) / this.timings.popMs;
      this.pop.cube.mesh.scale.setScalar(popScale(progress));
      if (progress >= 1) {
        this.pop = null;
      }
    }

    const spin = this.spinning;
    if (spin) {
      const progress = Math.min(1, (now - spin.start) / Math.max(1, this.timings.spinMs));
      const pose = spinPose(progress, spin.from, spin.to, this.timings);
      spin.cube.mesh.rotation.y = pose.rotationY;
      spin.cube.mesh.rotation.z = pose.rotationZ;
      spin.cube.mesh.position.y = spin.cube.restY + pose.lift;
      if (progress >= 1) {
        spin.cube.mesh.rotation.set(0, spin.to, 0);
        spin.cube.mesh.position.y = spin.cube.restY;
        this.spinning = null;
        spin.done();
      }
    }

    const reveal = this.revealing;
    if (reveal) {
      const pose = revealPose((now - reveal.start) / 1000, reveal.path, this.timings);
      setFlaps(reveal.parent, pose.flapOpen);
      const mesh = reveal.cube.mesh;
      mesh.visible = pose.visible;
      mesh.position.y = pose.y;
      mesh.rotation.y = pose.rotationY;
      mesh.scale.set(pose.scaleXZ, pose.scaleY, pose.scaleXZ);
      if (pose.phase === 'settled') {
        this.revealing = null;
        reveal.done();
      }
    }

    this.renderer.render(this.scene, this.camera);
  };

  private resize(): void {
    const width = this.host.clientWidth;
    const height = this.host.clientHeight;
    if (!this.renderer || width === 0 || height === 0) {
      return;
    }
    const aspect = width / height;
    const span = 2 * Math.tan((FOV * Math.PI) / 360);
    const distance = Math.max(FRAME_HEIGHT / span, FRAME_WIDTH / (span * aspect));
    this.camera.aspect = aspect;
    this.camera.position.copy(FRAME_TARGET).addScaledVector(CAMERA_DIRECTION, distance);
    this.camera.lookAt(FRAME_TARGET);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  private pick(event: PointerEvent): number | null {
    const canvas = this.renderer?.domElement;
    if (!canvas) {
      return null;
    }
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      return null;
    }
    this.pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      1 - ((event.clientY - rect.top) / rect.height) * 2,
    );
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const meshes = this.cubes.filter((cube) => cube.mesh.visible).map((cube) => cube.mesh);
    const hit = this.raycaster.intersectObjects(meshes, true)[0];
    const index = hit?.object.userData['cubeIndex'];
    return typeof index === 'number' ? index : null;
  }

  private readonly handlePointerDown = (event: PointerEvent): void => {
    const index = this.pick(event);
    if (index !== null) {
      this.onCubePress(index);
    }
  };

  private readonly handlePointerMove = (event: PointerEvent): void => {
    const canvas = this.renderer?.domElement;
    if (canvas) {
      const index = this.interactiveIndex === null ? null : this.pick(event);
      canvas.style.cursor = index !== null && index === this.interactiveIndex ? 'pointer' : '';
    }
  };
}

function setFlaps(cube: CubeEntry, open: number): void {
  for (const hinge of cube.flaps) {
    hinge.rotation.x = open * FLAP_OPEN_ANGLE;
  }
}

/** Disposes a cube's own geometry and materials, including flap meshes, exactly once. */
function disposeCube(root: Object3D): void {
  const geometries = new Set<BufferGeometry>();
  const materials = new Set<Material>();
  root.traverse((object) => {
    if (object instanceof Mesh) {
      geometries.add(object.geometry);
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        materials.add(material);
      }
    }
  });
  geometries.forEach((geometry) => geometry.dispose());
  // Face textures are shared, so only the materials are released here.
  materials.forEach((material) => material.dispose());
}
