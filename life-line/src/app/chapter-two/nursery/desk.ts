import { Object3D, Vector3 } from 'three';
import {
  HIT_PRIORITY,
  isUnder,
  toVector3,
  type InteractionAction,
  type InteractionTarget,
  type NurseryEvents,
  type ProgressFn,
  type PuzzleObject,
  type SelectedItem,
} from './interaction.types';
import type { DeskBindings } from './model-bindings';
import { DESK_CONFIG, NURSERY_TEXT, NURSERY_TIMINGS } from './nursery.config';
import type { PuzzleState } from './puzzle-state';

/**
 * The side table and its drawer. Tapping the drawer opens and frames it
 * directly, without a tooltip; the clock standing on the table owns its own
 * hits. Loose items other than the screwdriver stay decorative.
 */
export class Desk implements PuzzleObject {
  readonly id = 'desk';
  private drawerOpen = false;

  constructor(
    private readonly bindings: DeskBindings,
    private readonly state: PuzzleState,
    private readonly events: NurseryEvents,
    private readonly config = DESK_CONFIG,
  ) {
    this.bindings.drawer.position.z = this.config.drawerClosedZ;
    this.syncVisuals();
  }

  getActions(): readonly InteractionAction[] {
    return [];
  }

  resolveHit(object: Object3D): InteractionTarget | null {
    if (this.drawerOpen && isUnder(object, this.bindings.screwdriver)) {
      return this.claim('screwdriver', HIT_PRIORITY.item);
    }
    if (isUnder(object, this.bindings.drawer)) return this.claim('drawer', HIT_PRIORITY.panel);
    if (isUnder(object, this.bindings.root)) return this.claim('drawer', HIT_PRIORITY.furniture);
    return null;
  }

  handleHit(target: string, _selected: SelectedItem): void {
    this.events.messageRequested(null);
    if (target === 'screwdriver') {
      this.collectScrewdriver();
      return;
    }
    this.setDrawerOpen(!this.drawerOpen);
  }

  performAction(_actionId: string): void {}

  prepareRoomView(): ProgressFn | null {
    this.drawerOpen = false;
    this.bindings.drawer.position.z = this.config.drawerClosedZ;
    return null;
  }

  update(_deltaSeconds: number, _elapsedSeconds: number): void {}

  reset(): void {
    this.drawerOpen = false;
    this.bindings.drawer.position.z = this.config.drawerClosedZ;
    this.syncVisuals();
  }

  dispose(): void {}

  syncVisuals(): void {
    this.bindings.screwdriver.visible = !this.state.screwdriverCollected;
  }

  private setDrawerOpen(open: boolean): void {
    this.drawerOpen = open;
    this.bindings.drawer.position.z = open ? this.config.drawerOpenZ : this.config.drawerClosedZ;
    if (!open) {
      this.events.roomViewRequested();
      return;
    }
    const drawer = this.bindings.drawer;
    drawer.updateWorldMatrix(true, false);
    const target = drawer.getWorldPosition(new Vector3());
    target.y += this.config.focusLift;
    this.events.cameraRequested({
      target,
      offset: toVector3(this.config.focusOffset),
      zoom: this.config.focusZoom,
      durationMs: NURSERY_TIMINGS.cameraMs,
    });
    this.events.statusChanged(NURSERY_TEXT.drawerOpened);
  }

  private collectScrewdriver(): void {
    // Nothing hidden inside a closed drawer can be picked up.
    if (!this.drawerOpen || !this.state.collectScrewdriver()) return;
    this.syncVisuals();
    this.events.itemCollected({ kind: 'screwdriver' });
    this.events.statusChanged(NURSERY_TEXT.screwdriverTaken);
  }

  private claim(target: string, priority: number): InteractionTarget {
    return { owner: this.id, target, priority };
  }
}
