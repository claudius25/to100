import {
  BackSide,
  Color,
  LinearSRGBColorSpace,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  SkinnedMesh,
  type IUniform,
  type Material,
} from 'three';

/**
 * Inverted-hull outline for *skinned* meshes.
 *
 * The procedural rig's outline (see `outline.ts`) expands the hull in view space
 * with a bespoke `ShaderMaterial`, which cannot follow a skeleton. Here the
 * expansion is injected into a stock `MeshBasicMaterial` right after
 * `begin_vertex`, i.e. *before* three's skinning chunk transforms `transformed`.
 * The offset is therefore skinned along with the vertex and the stroke sticks to
 * the deforming body. Expansion is in object space, so the thickness uniform is
 * divided by the model scale to stay constant in world units.
 */
export class SkinnedOutline {
  private readonly uniform: IUniform<number> = { value: 0.01 };
  private readonly material: MeshBasicMaterial;
  private readonly clones: Object3D[] = [];
  private modelScale = 1;
  private worldThickness = 0.01;

  constructor(color: number) {
    const material = new MeshBasicMaterial({
      color: new Color().setHex(color, LinearSRGBColorSpace),
      side: BackSide,
    });
    material.onBeforeCompile = (shader) => {
      shader.uniforms['uOutlineThickness'] = this.uniform;
      shader.vertexShader = `uniform float uOutlineThickness;\n${shader.vertexShader}`.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         transformed += normal * uOutlineThickness;`,
      );
    };
    // Keeps this variant out of the cache bucket of plain MeshBasicMaterials.
    material.customProgramCacheKey = () => 'skinned-outline';
    this.material = material;
  }

  /** Model-space expansion must shrink as the model is scaled up. */
  setModelScale(scale: number): void {
    this.modelScale = scale > 1e-6 ? scale : 1;
    this.uniform.value = this.worldThickness / this.modelScale;
  }

  setThickness(worldThickness: number): void {
    this.worldThickness = worldThickness;
    this.uniform.value = worldThickness / this.modelScale;
    // A zero-width hull would z-fight with the body, so hide it instead.
    const visible = worldThickness > 1e-5;
    for (const clone of this.clones) {
      clone.visible = visible;
    }
  }

  /** Duplicates every mesh under `root` as a back-faced hull sharing its skeleton. */
  attachTo(root: Object3D): void {
    const sources: Mesh[] = [];
    root.traverse((child) => {
      if ((child as Mesh).isMesh) {
        sources.push(child as Mesh);
      }
    });

    for (const source of sources) {
      const parent = source.parent;
      if (!parent) {
        continue;
      }
      let clone: Mesh;
      if ((source as SkinnedMesh).isSkinnedMesh) {
        const skinnedSource = source as SkinnedMesh;
        const skinnedClone = new SkinnedMesh(skinnedSource.geometry, this.material);
        skinnedClone.bindMode = skinnedSource.bindMode;
        skinnedClone.bind(skinnedSource.skeleton, skinnedSource.bindMatrix);
        clone = skinnedClone;
      } else {
        clone = new Mesh(source.geometry, this.material);
      }
      clone.name = `${source.name}-outline`;
      clone.position.copy(source.position);
      clone.quaternion.copy(source.quaternion);
      clone.scale.copy(source.scale);
      clone.renderOrder = -1;
      clone.frustumCulled = false;
      clone.castShadow = false;
      clone.receiveShadow = false;
      parent.add(clone);
      this.clones.push(clone);
    }
  }

  dispose(): void {
    for (const clone of this.clones) {
      clone.removeFromParent();
    }
    this.clones.length = 0;
    (this.material as Material).dispose();
  }
}
