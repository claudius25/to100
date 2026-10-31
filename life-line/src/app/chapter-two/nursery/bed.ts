import { Object3D } from 'three';
import {
  BATTERY_SIDES,
  batteryId,
  HIT_PRIORITY,
  isUnder,
  type BatterySide,
  type BatterySource,
  type InteractionAction,
  type InteractionTarget,
  type NurseryEvents,
  type ProgressFn,
  type PuzzleObject,
  type SelectedItem,
} from './interaction.types';
import type { BedBindings } from './model-bindings';
import { BED_CONFIG, NURSERY_TEXT, NURSERY_TIMINGS } from './nursery.config';
import type { PuzzleState } from './puzzle-state';

/** The battery meshes each source owns, used as prototypes for the arm's slots. */
export type BatteryPrototypes = Readonly<
  Record<BatterySource, Readonly<Record<BatterySide, Object3D>>>
>;

/**
 * The cot and the toy arm above it: installing and swapping battery pairs, the
 * red start button and the spinning rotor. Only a charged pair starts it.
 */
export class Bed implements PuzzleObject {
  readonly id = 'bed';
  private readonly installedMeshes: Object3D[] = [];

  constructor(
    private readonly bindings: BedBindings,
    private readonly state: PuzzleState,
    private readonly events: NurseryEvents,
    private readonly prototypes: BatteryPrototypes,
    private readonly config = BED_CONFIG,
  ) {
    // The near rail would hide the cot interior from the room camera.
    this.bindings.frontRail.visible = false;
    this.syncVisuals();
  }

  getActions(): readonly InteractionAction[] {
    return [];
  }

  resolveHit(object: Object3D): InteractionTarget | null {
    if (isUnder(object, this.bindings.startButton)) return this.claim('start', HIT_PRIORITY.item);
    if (isUnder(object, this.bindings.door)) return this.claim('mobile', HIT_PRIORITY.panel);
    if (isUnder(object, this.bindings.switchGroup)) {
      return this.claim('mobile', HIT_PRIORITY.control);
    }
    if (isUnder(object, this.bindings.arm) || isUnder(object, this.bindings.clamp)) {
      return this.claim('mobile', HIT_PRIORITY.container);
    }
    if (isUnder(object, this.bindings.cot)) return this.claim('cot', HIT_PRIORITY.furniture);
    return null;
  }

  handleHit(target: string, selected: SelectedItem): void {
    this.events.messageRequested(null);
    if (target === 'cot') return;
    if (selected?.kind === 'batteries') {
      this.install(selected.source);
      return;
    }
    this.press();
  }

  performAction(_actionId: string): void {}

  /** Puts a pair from the inventory into the arm, returning any pair already in it. */
  install(source: BatterySource): void {
    const result = this.state.installBatteries(source);
    if (result.outcome === 'not-enough') {
      this.events.messageRequested({
        owner: this.id,
        anchor: this.bindings.switchGroup,
        title: NURSERY_TEXT.needBothBatteries,
        actions: [],
      });
      this.events.statusChanged(NURSERY_TEXT.needBothBatteries);
      return;
    }
    this.syncVisuals();
    this.events.selectionCleared();
    this.events.runningChanged(false);
    this.events.statusChanged(NURSERY_TEXT.installed);
  }

  /** The red button. Installing alone never starts anything. */
  press(): void {
    const outcome = this.state.pressStart();
    if (outcome === 'no-power') {
      this.events.messageRequested({
        owner: this.id,
        anchor: this.bindings.startButton,
        title: NURSERY_TEXT.mobileDead,
        actions: [],
      });
      this.events.statusChanged(NURSERY_TEXT.mobileDead);
      this.events.runningChanged(false);
      return;
    }
    this.events.runningChanged(this.state.running);
    this.events.statusChanged(
      outcome === 'started' ? NURSERY_TEXT.mobileRunning : NURSERY_TEXT.mobileStopped,
    );
  }

  prepareRoomView(): ProgressFn | null {
    return null;
  }

  update(deltaSeconds: number, _elapsedSeconds: number): void {
    if (!this.state.running) return;
    // Only the rotor turns; the arm, clamp and cot stay still.
    this.bindings.rotor.rotation.y +=
      Math.min(deltaSeconds, NURSERY_TIMINGS.maxDeltaSeconds) * this.config.rotorSpeed;
  }

  reset(): void {
    this.bindings.rotor.rotation.y = 0;
    this.syncVisuals();
  }

  dispose(): void {
    this.clearInstalledMeshes();
  }

  /** The arm shows exactly the batteries the state says are installed. */
  syncVisuals(): void {
    this.clearInstalledMeshes();
    const source = this.state.installedSource();
    this.bindings.door.rotation.y = source ? this.config.doorOpenRotationY : 0;
    if (!source) return;
    const [x, y, z] = this.config.batterySlotOffset;
    this.bindings.slots.forEach((slot, index) => {
      const side = BATTERY_SIDES[index];
      if (side === undefined) return;
      if (this.state.locationOf(batteryId(source, side)) !== 'mobile') return;
      const battery = this.prototypes[source][side].clone(true);
      battery.traverse((node) => {
        node.visible = true;
      });
      battery.position.set(slot.position.x + x, slot.position.y + y, slot.position.z + z);
      battery.rotation.set(0, 0, 0);
      battery.scale.set(1, 1, 1);
      battery.userData['installedBattery'] = true;
      this.bindings.compartment.add(battery);
      this.installedMeshes.push(battery);
    });
  }

  /** Clones share the prototype's geometry and material, so nothing is disposed. */
  private clearInstalledMeshes(): void {
    for (const mesh of this.installedMeshes) mesh.removeFromParent();
    this.installedMeshes.length = 0;
  }

  private claim(target: string, priority: number): InteractionTarget {
    return { owner: this.id, target, priority };
  }
}
