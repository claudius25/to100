import {
  DataTexture,
  HalfFloatType,
  RGBAFormat,
  Vector2,
  type Shape,
  type WebGLRenderer,
} from 'three';
import { GPUComputationRenderer } from 'three/addons/misc/GPUComputationRenderer.js';
import { CHAPTER_WATER } from './chapter.constants';

// Adapted from the supplied relief scene / Three.js GPU water example (MIT).
export const WATER_SIZE = CHAPTER_WATER.resolution;
export const WATER_BOUNDS = CHAPTER_WATER.bounds;
const COMPUTE_SHADER = `
uniform sampler2D cavityMask;
uniform vec2 mousePos;
uniform float impulse;
float neighbor(vec2 uv, float center) {
  return texture2D(cavityMask, uv).r > .5 ? texture2D(heightmap, uv).x : center;
}
void main() {
  vec2 cell = 1.0 / resolution.xy, uv = gl_FragCoord.xy * cell;
  if (texture2D(cavityMask, uv).r < .5) { gl_FragColor = vec4(0.0); return; }
  vec4 h = texture2D(heightmap, uv);
  float n = neighbor(uv + vec2(0, cell.y), h.x);
  float s = neighbor(uv - vec2(0, cell.y), h.x);
  float e = neighbor(uv + vec2(cell.x, 0), h.x);
  float w = neighbor(uv - vec2(cell.x, 0), h.x);
  float next = ((n + s + e + w) * .5 - h.y) * ${CHAPTER_WATER.damping};
  float phase = clamp(length((uv - .5) * ${WATER_BOUNDS.toFixed(1)} - mousePos) * 3.14159265 / ${CHAPTER_WATER.rippleRadius},
    0.0, 3.14159265);
  next += (cos(phase) + 1.0) * impulse;
  gl_FragColor = vec4(clamp(next, -1.0, 1.0), h.x, 0, 1);
}`;

export class GpuWater {
  private readonly gpu: GPUComputationRenderer;
  private readonly mask: DataTexture;
  private readonly pixels: Uint8Array;
  private readonly cells: number[] = [];
  private readonly variable;
  private pending: Vector2 | null = null;
  private queued: Vector2[] = [];
  private accumulator = 0;
  private elapsed = 0;
  private drop = 0;

  constructor(renderer: WebGLRenderer, outlines: readonly Shape[]) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = WATER_SIZE;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('Cannot create the glyph mask for GPU water.');
    context.fillStyle = 'white';
    for (const shape of outlines) {
      context.beginPath();
      for (const contour of [shape, ...shape.holes]) {
        contour.getPoints(18).forEach((point, index) => {
          const x = (point.x / WATER_BOUNDS + 0.5) * WATER_SIZE;
          const y = (point.y / WATER_BOUNDS + 0.5) * WATER_SIZE;
          if (index) context.lineTo(x, y);
          else context.moveTo(x, y);
        });
        context.closePath();
      }
      context.fill('evenodd');
    }
    const image = context.getImageData(0, 0, WATER_SIZE, WATER_SIZE).data;
    this.pixels = new Uint8Array(WATER_SIZE * WATER_SIZE * 4);
    for (let i = 0; i < WATER_SIZE * WATER_SIZE; i++) {
      const wet = image[i * 4 + 3] > 127;
      this.pixels[i * 4] = wet ? 255 : 0;
      this.pixels[i * 4 + 3] = 255;
      if (wet) this.cells.push(i);
    }
    this.mask = new DataTexture(this.pixels, WATER_SIZE, WATER_SIZE, RGBAFormat);
    this.mask.needsUpdate = true;
    this.gpu = new GPUComputationRenderer(WATER_SIZE, WATER_SIZE, renderer);
    this.gpu.setDataType(HalfFloatType);
    this.variable = this.gpu.addVariable('heightmap', COMPUTE_SHADER, this.gpu.createTexture());
    this.gpu.setVariableDependencies(this.variable, [this.variable]);
    Object.assign(this.variable.material.uniforms, {
      cavityMask: { value: this.mask },
      mousePos: { value: new Vector2(100, 100) },
      impulse: { value: 0 },
    });
    try {
      const error = this.gpu.init();
      if (error) throw new Error(`GPU water initialization failed: ${error}`);
    } catch (error) {
      this.dispose();
      throw error;
    }
  }

  get texture() {
    return this.gpu.getCurrentRenderTarget(this.variable).texture;
  }

  disturb(x: number, y: number): void {
    const ix = Math.floor((x / WATER_BOUNDS + 0.5) * WATER_SIZE);
    const iy = Math.floor((y / WATER_BOUNDS + 0.5) * WATER_SIZE);
    if (
      ix >= 0 &&
      ix < WATER_SIZE &&
      iy >= 0 &&
      iy < WATER_SIZE &&
      this.pixels[(iy * WATER_SIZE + ix) * 4]
    ) {
      this.pending = new Vector2(x, y);
    }
  }

  step(dt: number): void {
    this.accumulator += Math.min(dt, 0.1);
    while (this.accumulator >= 1 / 60) {
      this.elapsed += 1 / 60;
      // Deterministic background ripples never consume the gameplay random source.
      if (this.elapsed * 1000 > CHAPTER_WATER.rippleIntervalMs && this.cells.length) {
        for (let i = 0; i < CHAPTER_WATER.dropsPerRipple; i++) {
          const cell = this.cells[(this.drop++ * 997) % this.cells.length];
          this.queued.push(
            new Vector2(
              (((cell % WATER_SIZE) + 0.5) / WATER_SIZE - 0.5) * WATER_BOUNDS,
              ((Math.floor(cell / WATER_SIZE) + 0.5) / WATER_SIZE - 0.5) * WATER_BOUNDS,
            ),
          );
        }
        this.elapsed = 0;
      }
      if (!this.pending) this.pending = this.queued.shift() ?? null;
      this.variable.material.uniforms['impulse'].value = this.pending ? CHAPTER_WATER.impulse : 0;
      this.variable.material.uniforms['mousePos'].value.copy(this.pending ?? new Vector2(100, 100));
      this.pending = null;
      this.gpu.compute();
      this.accumulator -= 1 / 60;
    }
  }

  dispose(): void {
    this.gpu.dispose();
    this.mask.dispose();
  }
}
