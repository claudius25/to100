import {
  BackSide,
  Color,
  LinearSRGBColorSpace,
  Mesh,
  ShaderMaterial,
  type BufferGeometry,
  type Material,
} from 'three';

/**
 * Inverted-hull outline.
 *
 * Chosen over `OutlinePass`/`EffectComposer` because it needs no post-processing
 * render targets (so the canvas can stay transparent over the CSS gradient),
 * it is cheap, and it draws a clean silhouette per body part instead of tracing
 * every polygon edge like a wireframe or an edge-detection filter would.
 *
 * The hull is expanded in *view space* along the transformed normal, which keeps
 * the stroke optically even on thin limbs and on capsule caps, where a naive
 * uniform `scale.multiplyScalar()` hull would wobble.
 */
const OUTLINE_VERTEX_SHADER = /* glsl */ `
  uniform float uThickness;
  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vec3 viewNormal = normalize(normalMatrix * normal);
    mvPosition.xyz += viewNormal * uThickness;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const OUTLINE_FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 uColor;
  void main() {
    gl_FragColor = vec4(uColor, 1.0);
  }
`;

export class OutlineMaterialSet {
  private readonly materials = new Map<number, ShaderMaterial>();
  private thickness: number;

  constructor(
    private readonly color: number,
    initialThickness: number,
  ) {
    this.thickness = initialThickness;
  }

  /**
   * One cached material per stroke weight, shared by every body part and reused
   * across rebuilds. Facial details use a thinner weight so the eye and nose
   * stay readable instead of collapsing into a dark blob.
   */
  create(scale = 1): ShaderMaterial {
    const cached = this.materials.get(scale);
    if (cached) {
      return cached;
    }
    const material = new ShaderMaterial({
      uniforms: {
        uThickness: { value: this.thickness * scale },
        // Written straight to the drawing buffer, so keep the hex in output space.
        uColor: { value: new Color().setHex(this.color, LinearSRGBColorSpace) },
      },
      vertexShader: OUTLINE_VERTEX_SHADER,
      fragmentShader: OUTLINE_FRAGMENT_SHADER,
      side: BackSide,
    });
    this.materials.set(scale, material);
    return material;
  }

  setThickness(thickness: number): void {
    this.thickness = thickness;
    for (const [scale, material] of this.materials) {
      material.uniforms['uThickness'].value = thickness * scale;
    }
  }

  getThickness(): number {
    return this.thickness;
  }

  dispose(): void {
    for (const material of this.materials.values()) {
      material.dispose();
    }
    this.materials.clear();
  }
}

/**
 * Adds the back-facing hull as a child of the mesh so it inherits every joint
 * transform for free and never desynchronises from the body part.
 */
export function attachOutline(mesh: Mesh<BufferGeometry, Material>, material: ShaderMaterial): Mesh {
  const outline = new Mesh(mesh.geometry, material);
  outline.renderOrder = -1;
  mesh.add(outline);
  return outline;
}
