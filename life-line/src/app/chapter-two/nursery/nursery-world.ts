import { Object3D } from 'three';
import { Bear } from './bear';
import { Bed, type BatteryPrototypes } from './bed';
import { Clock } from './clock';
import { Desk } from './desk';
import {
  type CameraRequest,
  type InteractionTarget,
  type NurseryEvents,
  type ProgressFn,
  type PuzzleObject,
  type SelectedItem,
} from './interaction.types';
import type { NurseryBindings } from './model-bindings';
import type { PuzzleState } from './puzzle-state';
import { Room } from './room';

/**
 * Holds the five replaceable objects and routes one raycast hit to whichever
 * of them owns it. It contains no puzzle rules of its own.
 */
export class NurseryWorld {
  readonly room: Room;
  readonly bear: Bear;
  readonly desk: Desk;
  readonly clock: Clock;
  readonly bed: Bed;
  private readonly objects: readonly PuzzleObject[];

  constructor(bindings: NurseryBindings, state: PuzzleState, events: NurseryEvents) {
    const prototypes: BatteryPrototypes = {
      teddy: bindings.bear.batteries,
      clock: bindings.clock.batteries,
    };
    this.room = new Room(bindings.room);
    this.bear = new Bear(bindings.bear, state, events);
    this.desk = new Desk(bindings.desk, state, events);
    this.clock = new Clock(bindings.clock, state, events);
    this.bed = new Bed(bindings.bed, state, events, prototypes);
    // Order is irrelevant: the highest priority claim wins, not the first one.
    this.objects = [this.bear, this.clock, this.desk, this.bed, this.room];
  }

  /** The most specific claim on a hit: a battery beats the furniture holding it. */
  resolve(object: Object3D): InteractionTarget | null {
    let best: InteractionTarget | null = null;
    for (const puzzleObject of this.objects) {
      const claim = puzzleObject.resolveHit(object);
      if (claim && (!best || claim.priority > best.priority)) best = claim;
    }
    return best;
  }

  handle(target: InteractionTarget, selected: SelectedItem): void {
    this.find(target.owner)?.handleHit(target.target, selected);
  }

  performAction(owner: string, actionId: string): void {
    this.find(owner)?.performAction(actionId);
  }

  /** Restores every object's resting pose together with the room framing. */
  roomView(): CameraRequest {
    const restores = this.objects
      .map((puzzleObject) => puzzleObject.prepareRoomView())
      .filter((restore): restore is ProgressFn => restore !== null);
    if (restores.length === 0) return this.room.view();
    return this.room.view((linear, smooth) => {
      for (const restore of restores) restore(linear, smooth);
    });
  }

  update(deltaSeconds: number, elapsedSeconds: number): void {
    for (const puzzleObject of this.objects) puzzleObject.update(deltaSeconds, elapsedSeconds);
  }

  /** Re-reads every mesh from the authoritative state. */
  syncVisuals(): void {
    this.bear.syncVisuals();
    this.clock.syncVisuals();
    this.desk.syncVisuals();
    this.bed.syncVisuals();
  }

  reset(): void {
    for (const puzzleObject of this.objects) puzzleObject.reset();
  }

  dispose(): void {
    for (const puzzleObject of this.objects) puzzleObject.dispose();
  }

  private find(owner: string): PuzzleObject | undefined {
    return this.objects.find((puzzleObject) => puzzleObject.id === owner);
  }
}
