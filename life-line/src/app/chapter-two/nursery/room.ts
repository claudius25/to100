import { Object3D } from 'three';
import {
  HIT_PRIORITY,
  isUnder,
  toVector3,
  type CameraRequest,
  type InteractionAction,
  type InteractionTarget,
  type ProgressFn,
  type PuzzleObject,
  type SelectedItem,
} from './interaction.types';
import type { RoomBindings } from './model-bindings';
import { NURSERY_TIMINGS, NURSERY_VIEW } from './nursery.config';

/**
 * The shell of the scene: floor, walls, rug and window, plus the framing every
 * inspection returns to. It deliberately knows nothing about the puzzle.
 */
export class Room implements PuzzleObject {
  readonly id = 'room';

  constructor(private readonly bindings: RoomBindings) {}

  /** The default framing of the whole room. */
  view(onProgress: ProgressFn | null = null): CameraRequest {
    return {
      target: toVector3(NURSERY_VIEW.roomTarget),
      offset: toVector3(NURSERY_VIEW.roomOffset),
      zoom: NURSERY_VIEW.roomZoom,
      durationMs: onProgress ? NURSERY_TIMINGS.bearMs : NURSERY_TIMINGS.cameraMs,
      ...(onProgress ? { onProgress } : {}),
    };
  }

  getActions(): readonly InteractionAction[] {
    return [];
  }

  /** Scenery only: tapping the floor or walls dismisses whatever is open. */
  resolveHit(object: Object3D): InteractionTarget | null {
    const scenery = [this.bindings.floor, this.bindings.rug, this.bindings.window];
    if (scenery.some((node) => isUnder(object, node))) {
      return { owner: this.id, target: 'scenery', priority: HIT_PRIORITY.furniture };
    }
    return null;
  }

  handleHit(_target: string, _selected: SelectedItem): void {}

  performAction(_actionId: string): void {}

  prepareRoomView(): ProgressFn | null {
    return null;
  }

  update(_deltaSeconds: number, _elapsedSeconds: number): void {}

  reset(): void {}

  dispose(): void {}
}
