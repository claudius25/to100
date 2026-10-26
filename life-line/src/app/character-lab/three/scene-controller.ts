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
import { DEFAULT_CHARACTER_CONFIG, type CharacterConfig } from '../model/character-config';
import type { CharacterDriver, CharacterMode } from '../model/character-driver';
import { loadGlbCharacter, type GlbCharacterAssets } from './glb-character';
import { buildMarkerPositions, MovementController } from './movement-controller';
import { ProceduralCharacter } from './procedural-character';

export interface LabStatus {
  readonly currentMarker: number | null;
  readonly targetMarker: number | null;
  readonly hoveredMarker: number | null;
  readonly moving: boolean;
  readonly continuous: boolean;
  readonly paused: boolean;
  readonly mode: CharacterMode;
  readonly loading: boolean;
  readonly error: string | null;
}

export const MARKER_COUNT = 12;
export const GLB_ASSETS: GlbCharacterAssets = {
  idleUrl: 'assets/idle_loop.glb',
  walkUrl: 'assets/walk_loop.glb',
};
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
  private readonly raycaster = new Raycaster();
  private readonly pointer = new Vector2();
  private readonly markers: MarkerVisual[] = [];
  private readonly ownedGeometries: BufferGeometry[] = [];
  private readonly ownedMaterials: Material[] = [];

  private renderer: WebGLRenderer | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private driver: CharacterDriver | null = null;
  private glbCharacter: Awaited<ReturnType<typeof loadGlbCharacter>> | null = null;
  private mode: CharacterMode = 'procedural';
  private loadToken = 0;
  private loading = false;
  private loadError: string | null = null;
  private outlineThickness = 0.011;
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

  init(config: CharacterConfig, mode: CharacterMode = 'procedural'): void {
    if (this.started || this.disposed) {
      return;
    }
    this.started = true;
    this.config = { ...config };
    this.mode = mode;

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
    if (mode === 'glb') {
      void this.activateGlb();
    } else {
      this.activateProcedural();
    }

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

  getMode(): CharacterMode {
    return this.mode;
  }

  /** Switches between the procedural rig and the imported GLB character. */
  setMode(mode: CharacterMode): void {
    if (mode === this.mode && (this.driver || this.loading)) {
      return;
    }
    this.mode = mode;
    this.loadError = null;
    if (mode === 'glb') {
      void this.activateGlb();
    } else {
      this.activateProcedural();
    }
    this.emitStatus();
  }

  setConfig(config: CharacterConfig): void {
    this.config = { ...config };
    if (this.driver instanceof ProceduralCharacter) {
      this.driver.setConfig(this.config);
      this.syncGait();
    } else if (this.glbCharacter) {
      // Only overall height is meaningful for an imported mesh.
      this.glbCharacter.setHeight(this.config.height);
      this.syncGait();
    }
  }

  setSpeed(speed: number): void {
    this.movement.setSpeed(speed);
  }

  setOutlineThickness(thickness: number): void {
    this.outlineThickness = thickness;
    this.driver?.setOutlineThickness(thickness);
  }

  getOutlineThickness(): number {
    return this.outlineThickness;
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
    this.driver?.update(0, this.movement.snapshot());
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

    this.loadToken++;
    this.releaseDriver();

    for (const geometry of this.ownedGeometries) {
      geometry.dispose();
    }
    for (const material of this.ownedMaterials) {
      material.dispose();
    }
    this.ownedGeometries.length = 0;
    this.ownedMaterials.length = 0;

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
    this.driver?.update(delta, snapshot);
    this.updateMarkerHighlights(snapshot.targetMarker, snapshot.currentMarker);
    this.renderer.render(this.scene, this.camera);
    this.emitStatus();
  };

  private activateProcedural(): void {
    this.loadToken++;
    this.releaseDriver();
    const character = new ProceduralCharacter(this.config, this.outlineThickness);
    this.scene.add(character.root);
    this.driver = character;
    this.syncGait();
    this.driver.update(0, this.movement.snapshot());
  }

  private async activateGlb(): Promise<void> {
    const token = ++this.loadToken;
    this.releaseDriver();
    this.loading = true;
    this.loadError = null;
    this.emitStatus();

    try {
      const character = await loadGlbCharacter(GLB_ASSETS, this.config.height);
      // A newer mode switch (or disposal) happened while we were loading.
      if (this.disposed || token !== this.loadToken) {
        character.dispose();
        return;
      }
      character.setOutlineThickness(this.outlineThickness);
      this.scene.add(character.root);
      this.driver = character;
      this.glbCharacter = character;
      this.syncGait();
      this.driver.update(0, this.movement.snapshot());
    } catch (error) {
      if (token !== this.loadToken) {
        return;
      }
      this.loadError = error instanceof Error ? error.message : 'Failed to load the GLB character.';
      this.mode = 'procedural';
      this.activateProcedural();
    } finally {
      if (token === this.loadToken) {
        this.loading = false;
        this.emitStatus();
      }
    }
  }

  private releaseDriver(): void {
    this.driver?.dispose();
    this.driver = null;
    this.glbCharacter = null;
  }

  /** Keeps the gait phase tied to the active character's real stride. */
  private syncGait(): void {
    if (!this.driver) {
      return;
    }
    this.movement.setGait(
      this.driver.cycleDistance,
      this.driver.preferredSpeed,
      this.driver.adaptiveStride,
    );
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
      mode: this.mode,
      loading: this.loading,
      error: this.loadError,
    };
    const previous = this.lastStatus;
    if (
      previous &&
      previous.currentMarker === status.currentMarker &&
      previous.targetMarker === status.targetMarker &&
      previous.hoveredMarker === status.hoveredMarker &&
      previous.moving === status.moving &&
      previous.continuous === status.continuous &&
      previous.paused === status.paused &&
      previous.mode === status.mode &&
      previous.loading === status.loading &&
      previous.error === status.error
    ) {
      return;
    }
    this.lastStatus = status;
    this.onStatus(status);
  }
}
