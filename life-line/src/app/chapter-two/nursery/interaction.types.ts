import { Object3D, Vector3 } from 'three';

export type BatterySource = 'teddy' | 'clock';
export type BatterySide = -1 | 1;
export type BatteryCharge = 'depleted' | 'charged';
/** A battery is at exactly one of these at any time. */
export type BatteryLocation = 'source' | 'inventory' | 'mobile';
export type BatteryId = `${BatterySource}:${BatterySide}`;

export const BATTERY_SOURCES: readonly BatterySource[] = ['teddy', 'clock'];
export const BATTERY_SIDES: readonly BatterySide[] = [-1, 1];

export function batteryId(source: BatterySource, side: BatterySide): BatteryId {
  return `${source}:${side}`;
}

/** What the player currently holds from the inventory row. */
export type SelectedItem =
  | { readonly kind: 'screwdriver' }
  | { readonly kind: 'batteries'; readonly source: BatterySource }
  | null;

export interface InteractionAction {
  readonly id: string;
  readonly label: string;
}

/**
 * A raycast hit resolved to the object that owns it. `priority` decides who
 * wins when several objects recognise the same ancestor chain, so a battery or
 * a cover always beats the furniture it sits in.
 */
export interface InteractionTarget {
  readonly owner: string;
  readonly target: string;
  readonly priority: number;
}

export const HIT_PRIORITY = {
  item: 50,
  control: 40,
  panel: 30,
  container: 20,
  body: 10,
  furniture: 5,
} as const;

/**
 * A camera move. `onProgress` lets the requesting object animate its own pose
 * along exactly the same curve without owning a loop of its own.
 */
export interface CameraRequest {
  readonly target: Vector3;
  readonly offset: Vector3;
  readonly zoom: number;
  readonly durationMs: number;
  readonly onProgress?: ProgressFn;
}

/** Receives the linear and smoothstepped progress of the active transition. */
export type ProgressFn = (linear: number, smooth: number) => void;

/** A tooltip or one-line notice pinned above a model node. */
export interface AnchoredMessage {
  readonly owner: string;
  readonly anchor: Object3D;
  readonly title: string;
  readonly actions: readonly InteractionAction[];
}

export type CollectedItem =
  { readonly kind: 'screwdriver' } | { readonly kind: 'battery'; readonly id: BatteryId };

/** The narrow service the object classes receive; nothing DOM-shaped. */
export interface NurseryEvents {
  messageRequested(message: AnchoredMessage | null): void;
  cameraRequested(request: CameraRequest): void;
  roomViewRequested(): void;
  itemCollected(item: CollectedItem): void;
  runningChanged(running: boolean): void;
  selectionCleared(): void;
  statusChanged(text: string): void;
}

/**
 * One replaceable puzzle object. It never owns a renderer, a loop or a DOM
 * query; the scene raycasts once and delegates here.
 */
export interface PuzzleObject {
  readonly id: string;
  /** Tooltip actions this object offers, empty when it has none. */
  getActions(): readonly InteractionAction[];
  /** Claims a hit object, or returns null when the hit is not ours. */
  resolveHit(object: Object3D): InteractionTarget | null;
  handleHit(target: string, selected: SelectedItem): void;
  performAction(actionId: string): void;
  /**
   * Restores this object's resting pose for the room view. Returns a progress
   * function when the restore should be animated with the camera.
   */
  prepareRoomView(): ProgressFn | null;
  update(deltaSeconds: number, elapsedSeconds: number): void;
  reset(): void;
  dispose(): void;
}

export function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

/** Maps a global 0..1 progress onto a `[from, to]` sub-phase of it. */
export function phase(t: number, span: readonly [number, number] | readonly number[]): number {
  const [from, to] = span;
  if (to <= from) return t >= to ? 1 : 0;
  return Math.min(1, Math.max(0, (t - from) / (to - from)));
}

/** True when `object` is `name` or sits anywhere below it. */
export function isUnder(object: Object3D, ancestor: Object3D | null | undefined): boolean {
  if (!ancestor) return false;
  for (let node: Object3D | null = object; node; node = node.parent) {
    if (node === ancestor) return true;
  }
  return false;
}

export function toVector3(values: readonly number[]): Vector3 {
  return new Vector3(values[0], values[1], values[2]);
}
