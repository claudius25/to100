import { MathUtils, Object3D, Vector3 } from 'three';
import { readSide } from './bear';
import {
  BATTERY_SIDES,
  batteryId,
  HIT_PRIORITY,
  isUnder,
  smoothstep,
  toVector3,
  type BatterySide,
  type InteractionAction,
  type InteractionTarget,
  type NurseryEvents,
  type ProgressFn,
  type PuzzleObject,
  type SelectedItem,
} from './interaction.types';
import type { ClockBindings } from './model-bindings';
import { CLOCK_CONFIG, NURSERY_TEXT, NURSERY_TIMINGS } from './nursery.config';
import type { PuzzleState } from './puzzle-state';

const CLOCK_ACTIONS: readonly InteractionAction[] = [
  { id: 'turn', label: 'TURN' },
  { id: 'watch', label: 'WATCH' },
];

/**
 * The alarm clock: its blinking display, the screwdriver-locked battery cover
 * and the two charged batteries the mobile actually needs.
 */
export class Clock implements PuzzleObject {
  readonly id = 'clock';
  private doorOpen = false;
  private blinkMs = 0;

  constructor(
    private readonly bindings: ClockBindings,
    private readonly state: PuzzleState,
    private readonly events: NurseryEvents,
    private readonly config = CLOCK_CONFIG,
  ) {
    this.syncVisuals();
  }

  getActions(): readonly InteractionAction[] {
    return CLOCK_ACTIONS;
  }

  resolveHit(object: Object3D): InteractionTarget | null {
    for (const side of BATTERY_SIDES) {
      if (isUnder(object, this.bindings.batteries[side])) {
        return this.claim(this.doorOpen ? `battery:${side}` : 'door', HIT_PRIORITY.item);
      }
    }
    if (isUnder(object, this.bindings.door)) return this.claim('door', HIT_PRIORITY.panel);
    if (isUnder(object, this.bindings.compartment)) {
      return this.claim(this.doorOpen ? 'compartment' : 'door', HIT_PRIORITY.container);
    }
    if (isUnder(object, this.bindings.snooze)) return this.claim('body', HIT_PRIORITY.control);
    // Claimed above the side table it stands on, so the drawer never steals it.
    if (isUnder(object, this.bindings.root)) return this.claim('body', HIT_PRIORITY.container);
    return null;
  }

  handleHit(target: string, selected: SelectedItem): void {
    if (target === 'body') {
      this.events.messageRequested({
        owner: this.id,
        anchor: this.bindings.root,
        title: NURSERY_TEXT.clockName,
        actions: this.getActions(),
      });
      return;
    }
    if (target === 'door') {
      this.openDoor(selected);
      return;
    }
    this.events.messageRequested(null);
    const side = readSide(target);
    if (side !== null) this.collect(side);
  }

  performAction(actionId: string): void {
    if (actionId === 'turn') this.turn();
    if (actionId === 'watch') this.watch();
  }

  /** Shows the back of the clock and zooms onto the battery cover. */
  turn(): void {
    this.focus(this.config.backYaw, NURSERY_TEXT.clockBack);
  }

  /** Frames the display. It never restores power. */
  watch(): void {
    this.focus(
      this.config.frontYaw,
      this.state.isSourceIntact('clock') ? NURSERY_TEXT.clockBlinking : NURSERY_TEXT.clockDead,
    );
  }

  prepareRoomView(): ProgressFn | null {
    const root = this.bindings.root;
    const fromYaw = root.rotation.y;
    return (_linear, smooth) => {
      root.rotation.y = MathUtils.lerp(fromYaw, this.config.frontYaw, smooth);
    };
  }

  update(deltaSeconds: number, _elapsedSeconds: number): void {
    this.blinkMs += deltaSeconds * 1000;
    // Removing either battery cuts the display immediately and completely.
    const powered = this.state.isSourceIntact('clock');
    for (const digit of this.bindings.digits) digit.visible = powered;
    const lit = powered && Math.floor(this.blinkMs / this.config.colonBlinkMs) % 2 === 0;
    for (const colon of this.bindings.colons) colon.visible = lit;
  }

  reset(): void {
    this.doorOpen = false;
    this.blinkMs = 0;
    this.bindings.door.rotation.y = 0;
    this.bindings.root.rotation.y = this.config.frontYaw;
    this.syncVisuals();
  }

  dispose(): void {}

  syncVisuals(): void {
    this.bindings.compartment.visible = this.doorOpen;
    for (const side of BATTERY_SIDES) {
      this.bindings.batteries[side].visible =
        this.state.locationOf(batteryId('clock', side)) === 'source';
    }
  }

  private focus(yaw: number, status: string): void {
    const root = this.bindings.root;
    root.updateWorldMatrix(true, false);
    const target = root.getWorldPosition(new Vector3());
    target.y += this.config.focusLift;
    const fromYaw = root.rotation.y;
    this.events.cameraRequested({
      target,
      offset: toVector3(this.config.focusOffset),
      zoom: this.config.focusZoom,
      durationMs: NURSERY_TIMINGS.cameraMs,
      onProgress: (linear) => {
        root.rotation.y = MathUtils.lerp(fromYaw, yaw, smoothstep(linear));
      },
    });
    this.events.statusChanged(status);
  }

  private openDoor(selected: SelectedItem): void {
    this.events.messageRequested(null);
    if (this.doorOpen) return;
    if (selected?.kind !== 'screwdriver') {
      this.events.messageRequested({
        owner: this.id,
        anchor: this.bindings.door,
        title: NURSERY_TEXT.clockLocked,
        actions: [],
      });
      return;
    }
    this.doorOpen = true;
    this.bindings.door.rotation.y = this.config.doorOpenRotationY;
    this.syncVisuals();
    // The screwdriver is a tool, not a consumable: it stays in the inventory.
    this.events.selectionCleared();
    this.events.statusChanged(NURSERY_TEXT.clockOpened);
  }

  private collect(side: BatterySide): void {
    if (!this.doorOpen) return;
    const id = batteryId('clock', side);
    if (!this.state.collectBattery(id)) return;
    this.syncVisuals();
    this.events.itemCollected({ kind: 'battery', id });
    this.events.statusChanged(NURSERY_TEXT.clockBatteryTaken);
  }

  private claim(target: string, priority: number): InteractionTarget {
    return { owner: this.id, target, priority };
  }
}
