import {
  Box3,
  Color,
  DirectionalLight,
  HemisphereLight,
  Material,
  Mesh,
  Object3D,
  Raycaster,
  Scene,
  Vector2,
  Vector3,
  WebGLRenderer,
  type BufferGeometry,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { CameraController } from './camera-controller';
import {
  toVector3,
  type AnchoredMessage,
  type CameraRequest,
  type InteractionAction,
  type NurseryEvents,
  type SelectedItem,
} from './interaction.types';
import { readInventory, sanitiseSelection, type InventoryView } from './inventory';
import { createNurseryBindings } from './model-bindings';
import { NurseryWorld } from './nursery-world';
import { NURSERY_LIGHTS, NURSERY_MODEL_URL, NURSERY_TEXT, NURSERY_VIEW } from './nursery.config';
import { PuzzleState } from './puzzle-state';

/** A tooltip already projected into container pixels. */
export interface TooltipView {
  readonly owner: string;
  readonly title: string;
  readonly actions: readonly InteractionAction[];
  readonly x: number;
  readonly y: number;
}

export interface NurserySnapshot {
  readonly status: string;
  readonly inventory: InventoryView;
  readonly selected: SelectedItem;
  readonly running: boolean;
  readonly completed: boolean;
}

export interface NurserySceneListener {
  snapshot(snapshot: NurserySnapshot): void;
  tooltip(tooltip: TooltipView | null): void;
}

/** Pixels the tooltip is kept away from the container edges. */
const TOOLTIP_MARGIN = { x: 64, top: 56, bottom: 24 } as const;
const TAP_SLOP_PX = 8;

function isVisible(object: Object3D): boolean {
  for (let node: Object3D | null = object; node; node = node.parent) {
    if (!node.visible) return false;
  }
  return true;
}

/**
 * Owns the renderer, the single animation loop and the one raycast per tap,
 * then delegates everything else to the puzzle objects. The Angular component
 * only drives lifecycle, inventory selection and tooltip actions.
 */
export class ChapterTwoScene {
  private readonly scene = new Scene();
  private readonly raycaster = new Raycaster();
  private readonly pointer = new Vector2();
  private readonly bounds = new Box3();
  private readonly projected = new Vector3();
  private readonly state: PuzzleState;

  private renderer: WebGLRenderer | null = null;
  private camera: CameraController | null = null;
  private world: NurseryWorld | null = null;
  private model: Object3D | null = null;
  private observer: ResizeObserver | null = null;
  private pointerDown: { x: number; y: number; id: number } | null = null;
  private message: AnchoredMessage | null = null;
  private lastTooltip: TooltipView | null = null;
  private selected: SelectedItem = null;
  private status: string = NURSERY_TEXT.loading;
  private lastFrameMs = 0;
  private elapsedSeconds = 0;
  private started = false;
  private disposed = false;

  private readonly events: NurseryEvents = {
    messageRequested: (message) => this.setMessage(message),
    cameraRequested: (request) => this.move(request),
    roomViewRequested: () => this.roomView(),
    itemCollected: () => this.emitSnapshot(),
    runningChanged: () => this.emitSnapshot(),
    selectionCleared: () => this.select(null),
    statusChanged: (text) => {
      this.status = text;
      this.emitSnapshot();
    },
  };

  constructor(
    private readonly host: HTMLElement,
    private readonly listener: NurserySceneListener,
  ) {
    this.state = new PuzzleState(() => this.emitSnapshot());
  }

  /** Rejects when WebGL or the model is unavailable so the caller can fall back. */
  async init(): Promise<void> {
    if (this.started || this.disposed) return;
    this.started = true;

    const renderer = new WebGLRenderer({ antialias: true });
    this.renderer = renderer;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(new Color(NURSERY_VIEW.background));
    renderer.domElement.classList.add('nursery-canvas');
    this.host.appendChild(renderer.domElement);

    this.camera = new CameraController(renderer.domElement);
    this.camera.onOrbitStart(() => {
      if (!this.camera?.animating) this.setMessage(null);
    });

    this.scene.add(
      new HemisphereLight(
        NURSERY_LIGHTS.skyColor,
        NURSERY_LIGHTS.groundColor,
        NURSERY_LIGHTS.hemisphereIntensity,
      ),
    );
    const sun = new DirectionalLight(NURSERY_LIGHTS.sunColor, NURSERY_LIGHTS.sunIntensity);
    sun.position.copy(toVector3(NURSERY_LIGHTS.sunPosition));
    this.scene.add(sun);

    const gltf = await new GLTFLoader().loadAsync(NURSERY_MODEL_URL);
    if (this.disposed) {
      disposeObject(gltf.scene);
      return;
    }
    this.model = gltf.scene;
    this.scene.add(this.model);
    this.world = new NurseryWorld(createNurseryBindings(this.model), this.state, this.events);

    renderer.domElement.addEventListener('pointerdown', this.onPointerDown);
    renderer.domElement.addEventListener('pointerup', this.onPointerUp);
    renderer.domElement.addEventListener('pointercancel', this.onPointerCancel);
    renderer.domElement.addEventListener('pointermove', this.onPointerMove);

    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(this.host);
    this.resize();

    this.status = NURSERY_TEXT.explore;
    this.lastFrameMs = performance.now();
    renderer.setAnimationLoop(this.tick);
    this.emitSnapshot();
  }

  /** Picks an inventory item up, or puts it down again. */
  select(item: SelectedItem): void {
    this.selected = sanitiseSelection(this.state, item);
    this.emitSnapshot();
  }

  /** Runs a tooltip action such as TURN or PLAY on the object that offered it. */
  performAction(owner: string, actionId: string): void {
    this.world?.performAction(owner, actionId);
  }

  dismissMessage(): void {
    this.setMessage(null);
  }

  /** Restores the room framing and every object's resting pose. */
  roomView(): void {
    if (!this.world) return;
    this.setMessage(null);
    this.move(this.world.roomView());
    this.status = NURSERY_TEXT.explore;
    this.emitSnapshot();
  }

  /** Clears collected items and completion, and returns everything to its start. */
  resetPuzzle(): void {
    this.setMessage(null);
    this.state.reset();
    this.world?.reset();
    this.world?.syncVisuals();
    this.selected = null;
    this.status = NURSERY_TEXT.explore;
    if (this.world) this.move(this.world.roomView());
    this.emitSnapshot();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.observer?.disconnect();
    this.observer = null;
    const canvas = this.renderer?.domElement;
    canvas?.removeEventListener('pointerdown', this.onPointerDown);
    canvas?.removeEventListener('pointerup', this.onPointerUp);
    canvas?.removeEventListener('pointercancel', this.onPointerCancel);
    canvas?.removeEventListener('pointermove', this.onPointerMove);
    this.renderer?.setAnimationLoop(null);
    this.world?.dispose();
    this.world = null;
    this.camera?.dispose();
    this.camera = null;
    if (this.model) {
      this.scene.remove(this.model);
      disposeObject(this.model);
      this.model = null;
    }
    this.renderer?.dispose();
    canvas?.remove();
    this.renderer = null;
  }

  private move(request: CameraRequest): void {
    this.setMessage(null);
    this.camera?.moveTo(request);
  }

  private setMessage(message: AnchoredMessage | null): void {
    this.message = message;
    if (!message) {
      this.lastTooltip = null;
      this.listener.tooltip(null);
      return;
    }
    this.publishTooltip();
  }

  /** Projects the anchor into container pixels, never window pixels. */
  private publishTooltip(): void {
    const message = this.message;
    const renderer = this.renderer;
    const camera = this.camera;
    if (!message || !renderer || !camera) return;
    const width = this.host.clientWidth || 1;
    const height = this.host.clientHeight || 1;
    this.bounds.setFromObject(message.anchor);
    if (this.bounds.isEmpty()) return;
    this.bounds.getCenter(this.projected);
    this.projected.y = this.bounds.max.y + NURSERY_VIEW.tooltipLift;
    this.projected.project(camera.camera);
    const x = clamp(
      (this.projected.x * 0.5 + 0.5) * width,
      TOOLTIP_MARGIN.x,
      width - TOOLTIP_MARGIN.x,
    );
    const y = clamp(
      (-this.projected.y * 0.5 + 0.5) * height,
      TOOLTIP_MARGIN.top,
      height - TOOLTIP_MARGIN.bottom,
    );
    const previous = this.lastTooltip;
    if (previous && previous.owner === message.owner && previous.title === message.title) {
      if (Math.abs(previous.x - x) < 0.5 && Math.abs(previous.y - y) < 0.5) return;
    }
    this.lastTooltip = {
      owner: message.owner,
      title: message.title,
      actions: message.actions,
      x,
      y,
    };
    this.listener.tooltip(this.lastTooltip);
  }

  private emitSnapshot(): void {
    const sanitised = sanitiseSelection(this.state, this.selected);
    this.selected = sanitised;
    this.listener.snapshot({
      status: this.status,
      inventory: readInventory(this.state),
      selected: sanitised,
      running: this.state.running,
      completed: this.state.puzzleCompleted,
    });
  }

  private resize(): void {
    const renderer = this.renderer;
    if (!renderer) return;
    const width = Math.max(1, this.host.clientWidth);
    const height = Math.max(1, this.host.clientHeight);
    renderer.setSize(width, height, false);
    this.camera?.resize(width, height);
  }

  private readonly tick = (): void => {
    const renderer = this.renderer;
    const camera = this.camera;
    if (!renderer || !camera || this.disposed) return;
    const now = performance.now();
    const delta = Math.min((now - this.lastFrameMs) / 1000, 0.25);
    this.lastFrameMs = now;
    this.elapsedSeconds += delta;
    camera.update(now);
    this.world?.update(delta, this.elapsedSeconds);
    if (this.message) this.publishTooltip();
    renderer.render(this.scene, camera.camera);
  };

  private readonly onPointerDown = (event: PointerEvent): void => {
    this.pointerDown = { x: event.clientX, y: event.clientY, id: event.pointerId };
  };

  private readonly onPointerCancel = (): void => {
    this.pointerDown = null;
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    const canvas = this.renderer?.domElement;
    if (canvas) canvas.style.cursor = this.pick(event) ? 'pointer' : 'grab';
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    const down = this.pointerDown;
    this.pointerDown = null;
    // A drag is an orbit, not a tap.
    if (!down || down.id !== event.pointerId) return;
    if (Math.hypot(event.clientX - down.x, event.clientY - down.y) >= TAP_SLOP_PX) return;
    const target = this.pick(event);
    if (!target) {
      this.setMessage(null);
      return;
    }
    this.world?.handle(target, this.selected);
  };

  /** One raycast, resolved to the object that owns the nearest visible surface. */
  private pick(event: PointerEvent) {
    const renderer = this.renderer;
    const camera = this.camera;
    if (!renderer || !camera || !this.world || !this.model || camera.animating) return null;
    const rect = renderer.domElement.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    this.pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(this.pointer, camera.camera);
    for (const hit of this.raycaster.intersectObject(this.model, true)) {
      if (!isVisible(hit.object)) continue;
      return this.world.resolve(hit.object);
    }
    return null;
  }
}

function clamp(value: number, min: number, max: number): number {
  return max <= min ? (min + max) / 2 : Math.min(max, Math.max(min, value));
}

/** Cheap pre-flight so the chapter can show its fallback instead of throwing. */
export function isWebGLAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(
      window.WebGL2RenderingContext && (canvas.getContext('webgl2') ?? canvas.getContext('webgl')),
    );
  } catch {
    return false;
  }
}

/** Disposes each geometry and material once, even when the GLB shares them. */
function disposeObject(root: Object3D): void {
  const geometries = new Set<BufferGeometry>();
  const materials = new Set<Material>();
  root.traverse((node) => {
    if (!(node instanceof Mesh)) return;
    geometries.add(node.geometry);
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
      materials.add(material);
    }
  });
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) material.dispose();
}
