import type { CharacterConfig } from '../model/character-config';
import type { CharacterDriver } from '../model/character-driver';
import type { CharacterRig } from '../model/character-rig';
import { CharacterAnimator } from './character-animator';
import { createCharacter } from './character-factory';
import type { MovementSnapshot } from './movement-controller';
import { OutlineMaterialSet } from './outline';

const OUTLINE_COLOR = 0x2f3236;

/**
 * Adapts the procedural factory + animator pair to the shared `CharacterDriver`
 * contract, so the scene can hold either this or the imported GLB character.
 * The procedural classes themselves are untouched.
 */
export class ProceduralCharacter implements CharacterDriver {
  readonly adaptiveStride = true;

  private readonly outlines: OutlineMaterialSet;
  private readonly animator = new CharacterAnimator();
  private rig: CharacterRig;

  constructor(config: CharacterConfig, outlineThickness: number) {
    this.outlines = new OutlineMaterialSet(OUTLINE_COLOR, outlineThickness);
    this.rig = createCharacter(config, this.outlines);
    this.animator.setRig(this.rig);
  }

  get root() {
    return this.rig.root;
  }

  get cycleDistance(): number {
    return this.rig.metrics.cycleDistance;
  }

  get preferredSpeed(): number {
    return this.rig.metrics.preferredSpeed;
  }

  /** Rebuilds the geometry for a new appearance, disposing what it replaces. */
  setConfig(config: CharacterConfig): void {
    const previous = this.rig;
    const parent = previous.root.parent;
    this.animator.setRig(null);
    previous.dispose();

    this.rig = createCharacter(config, this.outlines);
    this.animator.setRig(this.rig);
    parent?.add(this.rig.root);
  }

  setOutlineThickness(worldThickness: number): void {
    this.outlines.setThickness(worldThickness);
  }

  update(dt: number, state: MovementSnapshot): void {
    this.animator.update(dt, state);
  }

  dispose(): void {
    this.animator.setRig(null);
    this.rig.dispose();
    this.outlines.dispose();
  }
}
