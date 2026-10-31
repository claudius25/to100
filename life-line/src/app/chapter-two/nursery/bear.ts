import { Color, MathUtils, MeshStandardMaterial, Object3D, Vector3 } from 'three';
import {
  BATTERY_SIDES,
  batteryId,
  HIT_PRIORITY,
  isUnder,
  phase,
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
import type { BearBindings } from './model-bindings';
import { BEAR_CONFIG, NURSERY_TEXT, NURSERY_TIMINGS } from './nursery.config';
import type { PuzzleState } from './puzzle-state';

const BEAR_ACTIONS: readonly InteractionAction[] = [
  { id: 'turn', label: 'TURN' },
  { id: 'play', label: 'PLAY' },
];

/**
 * The seated teddy: turning it to reach the back pocket, the paw PLAY test and
 * its two depleted batteries. It owns no camera and no loop — only its pose.
 */
export class Bear implements PuzzleObject {
  readonly id = 'bear';
  private readonly eyeMaterials: MeshStandardMaterial[] = [];
  private readonly emissive = new Color(BEAR_CONFIG.eyeEmissive);
  private pocketOpen = false;
  /** Counts the PLAY flicker down with real time, so it is frame independent. */
  private flickerRemainingMs = 0;

  constructor(
    private readonly bindings: BearBindings,
    private readonly state: PuzzleState,
    private readonly events: NurseryEvents,
    private readonly config = BEAR_CONFIG,
  ) {
    // Cloned so animating the glow cannot touch anything else sharing the material.
    for (const eye of this.bindings.eyes) {
      const source = Array.isArray(eye.material) ? eye.material[0] : eye.material;
      if (!(source instanceof MeshStandardMaterial)) continue;
      const clone = source.clone();
      eye.material = clone;
      this.eyeMaterials.push(clone);
    }
    this.syncVisuals();
  }

  getActions(): readonly InteractionAction[] {
    return BEAR_ACTIONS;
  }

  resolveHit(object: Object3D): InteractionTarget | null {
    for (const side of BATTERY_SIDES) {
      if (isUnder(object, this.bindings.batteries[side])) {
        return this.claim(this.pocketOpen ? `battery:${side}` : 'pocket', HIT_PRIORITY.item);
      }
    }
    if (isUnder(object, this.bindings.pawButton)) return this.claim('paw', HIT_PRIORITY.control);
    if (isUnder(object, this.bindings.pocketFlap)) return this.claim('pocket', HIT_PRIORITY.panel);
    if (isUnder(object, this.bindings.compartment)) {
      return this.claim('pocket', HIT_PRIORITY.container);
    }
    if (isUnder(object, this.bindings.root)) return this.claim('body', HIT_PRIORITY.body);
    return null;
  }

  handleHit(target: string, _selected: SelectedItem): void {
    if (target === 'body') {
      this.events.messageRequested({
        owner: this.id,
        anchor: this.bindings.root,
        title: NURSERY_TEXT.bearName,
        actions: this.getActions(),
      });
      return;
    }
    this.events.messageRequested(null);
    if (target === 'paw') {
      this.play();
      return;
    }
    if (target === 'pocket') {
      this.setPocketOpen(!this.pocketOpen);
      return;
    }
    const side = readSide(target);
    if (side !== null) this.collect(side);
  }

  performAction(actionId: string): void {
    if (actionId === 'turn') this.turn();
    if (actionId === 'play') this.play();
  }

  /** Steps clear of the wall, then shows its back and zooms onto the pocket. */
  turn(): void {
    const root = this.bindings.root;
    root.updateWorldMatrix(true, false);
    const target = root.getWorldPosition(new Vector3());
    target.x = this.config.inspectX;
    target.y += this.config.focusLift;
    const fromYaw = root.rotation.y;
    const fromX = root.position.x;
    this.events.cameraRequested({
      target,
      offset: toVector3(this.config.focusOffset),
      zoom: this.config.focusZoom,
      durationMs: NURSERY_TIMINGS.bearMs,
      onProgress: (linear) => {
        root.position.x = MathUtils.lerp(
          fromX,
          this.config.inspectX,
          smoothstep(phase(linear, this.config.turnMovePhase)),
        );
        root.rotation.y = MathUtils.lerp(
          fromYaw,
          this.config.backYaw,
          smoothstep(phase(linear, this.config.turnRotatePhase)),
        );
      },
    });
    this.events.statusChanged(NURSERY_TEXT.bearBack);
  }

  /** The PLAY test. It never moves the bear or the camera. */
  play(): void {
    this.events.messageRequested(null);
    const powered = this.state.isSourceIntact('teddy');
    this.flickerRemainingMs = powered ? this.config.flickerMs : 0;
    this.events.statusChanged(powered ? NURSERY_TEXT.bearFlicker : NURSERY_TEXT.bearDead);
  }

  prepareRoomView(): ProgressFn | null {
    this.setPocketOpen(false, false);
    const root = this.bindings.root;
    const fromYaw = root.rotation.y;
    const fromX = root.position.x;
    return (linear) => {
      root.rotation.y = MathUtils.lerp(
        fromYaw,
        this.config.homeYaw,
        smoothstep(phase(linear, this.config.homeRotatePhase)),
      );
      root.position.x = MathUtils.lerp(
        fromX,
        this.config.restX,
        smoothstep(phase(linear, this.config.homeMovePhase)),
      );
    };
  }

  update(deltaSeconds: number, _elapsedSeconds: number): void {
    if (!this.state.isSourceIntact('teddy')) this.flickerRemainingMs = 0;
    this.flickerRemainingMs = Math.max(0, this.flickerRemainingMs - deltaSeconds * 1000);
    const ageMs = this.config.flickerMs - this.flickerRemainingMs;
    const intensity =
      this.flickerRemainingMs > 0
        ? (this.flickerRemainingMs / this.config.flickerMs) *
          (Math.sin(ageMs * this.config.flickerHz) > 0
            ? this.config.flickerHigh
            : this.config.flickerLow)
        : 0;
    for (const material of this.eyeMaterials) {
      material.emissive.copy(this.emissive);
      material.emissiveIntensity = intensity;
    }
  }

  reset(): void {
    this.flickerRemainingMs = 0;
    this.setPocketOpen(false, false);
    this.bindings.root.rotation.y = this.config.homeYaw;
    this.bindings.root.position.x = this.config.restX;
    this.syncVisuals();
  }

  dispose(): void {
    for (const material of this.eyeMaterials) material.dispose();
    this.eyeMaterials.length = 0;
  }

  /** Mesh visibility only ever mirrors the authoritative state. */
  syncVisuals(): void {
    for (const side of BATTERY_SIDES) {
      this.bindings.batteries[side].visible =
        this.state.locationOf(batteryId('teddy', side)) === 'source';
    }
  }

  private setPocketOpen(open: boolean, announce = true): void {
    this.pocketOpen = open;
    this.bindings.pocketFlap.rotation.x = open ? this.config.pocketOpenRotationX : 0;
    if (announce) {
      this.events.statusChanged(open ? NURSERY_TEXT.pocketOpened : NURSERY_TEXT.pocketClosed);
    }
  }

  private collect(side: BatterySide): void {
    if (!this.pocketOpen) return;
    const id = batteryId('teddy', side);
    if (!this.state.collectBattery(id)) return;
    // A missing battery kills the glow at once, mid-flicker included.
    this.flickerRemainingMs = 0;
    this.syncVisuals();
    this.events.itemCollected({ kind: 'battery', id });
    this.events.statusChanged(NURSERY_TEXT.teddyBatteryTaken);
  }

  private claim(target: string, priority: number): InteractionTarget {
    return { owner: this.id, target, priority };
  }
}

export function readSide(target: string): BatterySide | null {
  const [, value] = target.split(':');
  const side = Number(value);
  return side === -1 || side === 1 ? side : null;
}
