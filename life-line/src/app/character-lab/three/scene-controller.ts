import {
  AmbientLight,
  CircleGeometry,
  Color,
  DirectionalLight,
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  OrthographicCamera,
  PlaneGeometry,
  Raycaster,
  RingGeometry,
  Scene,
  Vector2,
  WebGLRenderer,
  type BufferGeometry,
  type Material,
} from 'three';
import {
  DEFAULT_CHARACTER_CONFIG,
  computeMetrics,
  type CharacterConfig,
} from '../model/character-config';
import type { CharacterRig } from '../model/character-rig';
import { CharacterAnimator } from './character-animator';
import { createCharacter } from './character-factory';
import { buildMarkerPositions, MovementController } from './movement-controller';
import { OutlineMaterialSet } from './outline';

export interface LabStatus {
  readonly currentMarker: number | null;
  readonly targetMarker: number | null;
  readonly hoveredMarker: number | null;
  readonly moving: boolean;
  readonly continuous: boolean;
  readonly paused: boolean;
}

export const MARKER_COUNT = 12;
const MARKER_SPAN = 6.0;
const BASE_VIEW_HEIGHT = 2.9;
const BASE_VIEW_WIDTH = 6.8;
const GROUND_FRACTION = 0.1;
const MAX_DELTA_SECONDS = 0.05;
const CHARCOAL = 0x2f3236;
const MARKER_IDLE = 0xa8adb4;

interface MarkerVisual {
  readonly index: number;
  readonly dot: Mesh;
  readonly ring: Mesh;
  readonly hitArea: Mesh;
}

export function isWebGLAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(
      window.WebGL2RenderingContext &&
        (canvas.getContext('webgl2') ?? canvas.getContext('webgl')),
    );
  } catch {
    return false;
  }
}

/**
 * Owns the renderer, camera, resize handling and the animation loop.
 * Nothing in here touches Angular; the component talks to it through plain
 * method calls and a single status callback.
 */
export class SceneController {
  private readonly scene = new Scene();
  private readonly camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  private readonly movement = new MovementController(buildMarkerPositions(MARKER_COUNT, MARKER_SPAN));
  private readonly animator = new CharacterAnimator();
  private readonly outlines = new OutlineMaterialSet(CHARCOAL, 0.011);
  private readonly raycaster = new Raycaster();
  private readonly pointer = new Vector2();
  private readonly markers: MarkerVisual[] = [];
  private readonly ownedGeometries: BufferGeometry[] = [];
  private readonly ownedMaterials: Material[] = [];

  private renderer: WebGLRenderer | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private rig: CharacterRig | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private config: CharacterConfig = { ...DEFAULT_CHARACTER_CONFIG };
  private groundLine: Mesh | null = null;
  private markerRoot: Group | null = null;
  private markerIdleMaterial: MeshBasicMaterial | null = null;
  private markerActiveMaterial: MeshBasicMaterial | null = null;

  private lastFrameTime = 0;
  private paused = false;
  private hoveredMarker: number | null = null;
  private lastStatus: LabStatus | null = null;
  private disposed = false;
  private started = false;

  constructor(
    private readonly host: HTMLElement,
    private readonly onStatus: (status: LabStatus) => void,
  ) {}

  init(config: CharacterConfig): void {
    if (this.started || this.disposed) {
      return;
    }
    this.started = true;
    this.config = { ...config };

    const renderer = new WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearAlpha(0);
    this.renderer = renderer;

    this.canvas = renderer.domElement;
    this.canvas.classList.add('lab-canvas');
    this.host.appendChild(this.canvas);

    this.camera.position.set(0, 0, 10);
    this.camera.lookAt(0, 0, 0);

    this.scene.add(new HemisphereLight(0xffffff, 0xb9bec6, 2.1));
    this.scene.add(new AmbientLight(0xffffff, 0.45));
    const key = new DirectionalLight(0xffffff, 1.5);
    key.position.set(2.5, 4.2, 5);
    this.scene.add(key);

    this.buildGround();
    this.buildMarkers();
    this.rebuildCharacter();

    this.canvas.addEventListener('pointerdown', this.onPointerDown);
    this.canvas.addEventListener('pointermove', this.onPointerMove);
    this.canvas.addEventListener('pointerleave', this.onPointerLeave);
    document.addEventListener('visibilitychange', this.onVisibilityChange);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.host);
    this.resize();

    this.lastFrameTime = performance.now();
    renderer.setAnimationLoop(this.tick);
    this.emitStatus();
  }

  getMarkerCount(): number {
    return this.movement.getMarkers().length;
  }

  setConfig(config: CharacterConfig): void {
    this.config = { ...config };
    this.rebuildCharacter();
  }

  setSpeed(speed: number): void {
    this.movement.setSpeed(speed);
  }

  setOutlineThickness(thickness: number): void {
    this.outlines.setThickness(thickness);
  }

  getOutlineThickness(): number {
    return this.outlines.getThickness();
  }

  selectMarker(index: number): void {
    this.movement.setTarget(index);
    this.paused = false;
    this.emitStatus();
  }

  setContinuous(enabled: boolean): void {
    this.movement.setContinuous(enabled);
    if (enabled) {
      this.paused = false;
    }
    this.emitStatus();
  }

  togglePause(): void {
    this.paused = !this.paused;
    if (!this.paused) {
      this.movement.nudgeForward();
      this.lastFrameTime = performance.now();
    }
    this.emitStatus();
  }

  isPaused(): boolean {
    return this.paused;
  }

  reset(): void {
    this.movement.reset();
    this.paused = false;
    this.animator.update(0, this.movement.snapshot());
    this.emitStatus();
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;

    this.renderer?.setAnimationLoop(null);
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;

    this.canvas?.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas?.removeEventListener('pointermove', this.onPointerMove);
    this.canvas?.removeEventListener('pointerleave', this.onPointerLeave);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);

    this.animator.setRig(null);
    this.rig?.dispose();
    this.rig = null;

    for (const geometry of this.ownedGeometries) {
      geometry.dispose();
    }
    for (const material of this.ownedMaterials) {
      material.dispose();
    }
    this.ownedGeometries.length = 0;
    this.ownedMaterials.length = 0;
    this.outlines.dispose();

    this.scene.clear();

    if (this.renderer) {
      this.renderer.dispose();
      this.renderer.forceContextLoss();
    }
    this.canvas?.remove();
    this.canvas = null;
    this.renderer = null;
  }

  private readonly tick = (time: number): void => {
    if (this.disposed || !this.renderer) {
      return;
    }
    // Clamping protects against the huge delta produced by an inactive tab.
    const rawDelta = (time - this.lastFrameTime) / 1000;
    this.lastFrameTime = time;
    const delta = this.paused ? 0 : Math.min(Math.max(rawDelta, 0), MAX_DELTA_SECONDS);

    const snapshot = this.movement.update(delta);
    this.animator.update(delta, snapshot);
    this.updateMarkerHighlights(snapshot.targetMarker, snapshot.currentMarker);
    this.renderer.render(this.scene, this.camera);
    this.emitStatus();
  };

  private rebuildCharacter(): void {
    this.animator.setRig(null);
    this.rig?.dispose();

    const rig = createCharacter(this.config, this.outlines);
    this.scene.add(rig.root);
    this.rig = rig;
    this.animator.setRig(rig);
    this.movement.setCycleDistance(computeMetrics(this.config).cycleDistance);
    this.animator.update(0, this.movement.snapshot());
  }

  private buildGround(): void {
    const geometry = new PlaneGeometry(1, 1);
    const material = new MeshBasicMaterial({ color: new Color(CHARCOAL) });
    this.ownedGeometries.push(geometry);
    this.ownedMaterials.push(material);
    const line = new Mesh(geometry, material);
    line.position.z = -0.05;
    this.scene.add(line);
    this.groundLine = line;
  }

  private buildMarkers(): void {
    const dotGeometry = new CircleGeometry(0.035, 24);
    const ringGeometry = new RingGeometry(0.07, 0.092, 28);
    const hitGeometry = new PlaneGeometry(0.44, 0.7);
    const idleMaterial = new MeshBasicMaterial({ color: new Color(MARKER_IDLE) });
    const activeMaterial = new MeshBasicMaterial({ color: new Color(CHARCOAL) });
    const hitMaterial = new MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
    this.markerIdleMaterial = idleMaterial;
    this.markerActiveMaterial = activeMaterial;

    this.ownedGeometries.push(dotGeometry, ringGeometry, hitGeometry);
    this.ownedMaterials.push(idleMaterial, activeMaterial, hitMaterial);

    const root = new Group();
    root.name = 'markers';
    this.scene.add(root);
    this.markerRoot = root;

    this.movement.getMarkers().forEach((x, index) => {
      const dot = new Mesh(dotGeometry, idleMaterial);
      dot.position.set(x, 0, -0.04);

      const ring = new Mesh(ringGeometry, activeMaterial);
      ring.position.set(x, 0, -0.03);
      ring.visible = false;

      const hitArea = new Mesh(hitGeometry, hitMaterial);
      hitArea.position.set(x, 0.1, -0.02);
      hitArea.userData['markerIndex'] = index;

      root.add(dot, ring, hitArea);
      this.markers.push({ index, dot, ring, hitArea });
    });
  }

  private updateMarkerHighlights(target: number | null, current: number | null): void {
    const idle = this.markerIdleMaterial;
    const active = this.markerActiveMaterial;
    for (const marker of this.markers) {
      const hovered = marker.index === this.hoveredMarker;
      // Ring = "where he is heading" / hover affordance; filled dot = where he stands.
      marker.ring.visible = hovered || marker.index === target;
      marker.dot.scale.setScalar(hovered ? 1.45 : 1);
      if (idle && active) {
        marker.dot.material = marker.index === current || hovered ? active : idle;
      }
    }
  }

  private resize(): void {
    const renderer = this.renderer;
    if (!renderer) {
      return;
    }
    const width = Math.max(1, this.host.clientWidth);
    const height = Math.max(1, this.host.clientHeight);
    renderer.setSize(width, height, false);

    // Fit by whichever axis is tighter so the scene is never stretched and the
    // full marker span plus the character height always stay visible.
    const aspect = width / height;
    let viewHeight: number;
    if (aspect >= BASE_VIEW_WIDTH / BASE_VIEW_HEIGHT) {
      viewHeight = BASE_VIEW_HEIGHT;
    } else {
      viewHeight = BASE_VIEW_WIDTH / aspect;
    }
    const viewWidth = viewHeight * aspect;

    this.camera.left = -viewWidth / 2;
    this.camera.right = viewWidth / 2;
    this.camera.top = viewHeight * (1 - GROUND_FRACTION);
    this.camera.bottom = -viewHeight * GROUND_FRACTION;
    this.camera.updateProjectionMatrix();

    if (this.groundLine) {
      this.groundLine.scale.set(viewWidth * 1.2, viewHeight * 0.0045, 1);
    }
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    const index = this.pickMarker(event);
    if (index !== null) {
      this.selectMarker(index);
    }
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    const index = this.pickMarker(event);
    if (index !== this.hoveredMarker) {
      this.hoveredMarker = index;
      if (this.canvas) {
        this.canvas.style.cursor = index === null ? 'default' : 'pointer';
      }
      this.emitStatus();
    }
  };

  private readonly onPointerLeave = (): void => {
    if (this.hoveredMarker !== null) {
      this.hoveredMarker = null;
      if (this.canvas) {
        this.canvas.style.cursor = 'default';
      }
      this.emitStatus();
    }
  };

  private readonly onVisibilityChange = (): void => {
    if (!document.hidden) {
      this.lastFrameTime = performance.now();
    }
  };

  private pickMarker(event: PointerEvent): number | null {
    if (!this.canvas || !this.markerRoot) {
      return null;
    }
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(
      this.markers.map((marker) => marker.hitArea),
      false,
    );
    const hit = hits[0];
    if (!hit) {
      return null;
    }
    const index = hit.object.userData['markerIndex'];
    return typeof index === 'number' ? index : null;
  }

  private emitStatus(): void {
    const snapshot = this.movement.snapshot();
    const status: LabStatus = {
      currentMarker: snapshot.currentMarker,
      targetMarker: snapshot.targetMarker,
      hoveredMarker: this.hoveredMarker,
      moving: snapshot.moving && !this.paused,
      continuous: snapshot.continuous,
      paused: this.paused,
    };
    const previous = this.lastStatus;
    if (
      previous &&
      previous.currentMarker === status.currentMarker &&
      previous.targetMarker === status.targetMarker &&
      previous.hoveredMarker === status.hoveredMarker &&
      previous.moving === status.moving &&
      previous.continuous === status.continuous &&
      previous.paused === status.paused
    ) {
      return;
    }
    this.lastStatus = status;
    this.onStatus(status);
  }
}
