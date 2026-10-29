import {
  AmbientLight,
  Box3,
  BufferGeometry,
  Color,
  DirectionalLight,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  LinearToneMapping,
  Path,
  PCFShadowMap,
  PMREMGenerator,
  OrthographicCamera,
  PerspectiveCamera,
  PlaneGeometry,
  Plane,
  Raycaster,
  Scene,
  Shape,
  ShapeGeometry,
  Vector2,
  Vector3,
  WebGLRenderer,
  type Texture,
} from 'three';
import { FontLoader, type Font, type FontData } from 'three/addons/loaders/FontLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { ChapterVisual, ReliefRow } from './blueprint-chapter';
import { GpuWater, WATER_BOUNDS, WATER_SIZE } from './gpu-water';
import {
  CHAPTER_COLORS,
  CHAPTER_LIQUID,
  CHAPTER_MOUSE,
  CHAPTER_QUALITY,
  CHAPTER_STATS,
  CHAPTER_SCENE,
  CHAPTER_LEVEL_LABELS,
  CHAPTER_TEXT,
  CHAPTER_TRAITS,
  CHAPTER_VIEW,
  CHAPTER_VIEW_SLIDERS,
  CHAPTER_WATER,
  MALE_NAMES,
  type ChapterTimings,
  type ChapterViewSettings,
} from './chapter.constants';
import { chapterRevealPose } from './chapter-animation';

const DEPTH = CHAPTER_SCENE.recessDepth;
const FILL = CHAPTER_LIQUID.targetFill;
const PLATE_HALF_SIZE = CHAPTER_SCENE.plateSize / 2;
const SWELL_K = (2 * Math.PI) / CHAPTER_WATER.swellWavelength;

interface LiquidSurface {
  meshes: Mesh<BufferGeometry, MeshPhysicalMaterial>[];
  material: MeshPhysicalMaterial;
  targetColor: Color;
  uniforms: {
    heightmap: { value: Texture | null };
    fillLevel: { value: number };
    time: { value: number };
    motion: { value: number };
  };
}

function waterGeometry(outline: Shape): BufferGeometry {
  const source = new ShapeGeometry(outline, 12);
  const position = source.attributes['position'];
  const index = source.index;
  if (!index) throw new Error('The glyph geometry must be triangulated.');
  const positions: number[] = [];
  function split(a: Vector3, b: Vector3, c: Vector3, depth: number): void {
    if (depth === 0) {
      positions.push(...a.toArray(), ...b.toArray(), ...c.toArray());
      return;
    }
    const ab = a.clone().add(b).multiplyScalar(0.5);
    const bc = b.clone().add(c).multiplyScalar(0.5);
    const ca = c.clone().add(a).multiplyScalar(0.5);
    split(a, ab, ca, depth - 1);
    split(ab, b, bc, depth - 1);
    split(ca, bc, c, depth - 1);
    split(ab, bc, ca, depth - 1);
  }
  for (let i = 0; i < index.count; i += 3) {
    const vertex = (j: number) => new Vector3().fromBufferAttribute(position, index.getX(i + j));
    split(vertex(0), vertex(1), vertex(2), 3);
  }
  source.dispose();
  const result = new BufferGeometry();
  result.setAttribute('position', new Float32BufferAttribute(positions, 3));
  result.computeVertexNormals();
  return result;
}

export interface ReliefFrameStats {
  fps: number;
  /** Average time between frames. */
  frameMs: number;
  /** Longest time between two frames in the sample window. */
  worstFrameMs: number;
  /** Frames slower than CHAPTER_STATS.slowFrameMs in the sample window. */
  slowFrames: number;
  /** Average CPU time spent simulating and submitting a frame (GPU time is not included). */
  cpuMs: number;
  activity: 'idle' | 'moving';
  pixelRatio: number;
  width: number;
  height: number;
  globalIllumination: 'off' | 'environment only' | 'environment + AO' | 'AO skipped while moving';
  drawCalls: number;
  triangles: number;
}

/** Recessed glyphs cut into a plate, with GPU waves confined to the value glyphs. */
export class ReliefScene implements ChapterVisual {
  private readonly scene = new Scene();
  private readonly group = new Group();
  private readonly framingBounds = new Box3();
  private readonly perspective = new PerspectiveCamera(32, 1, 0.1, 100);
  private readonly orthographic = new OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  private view: ChapterViewSettings = { ...CHAPTER_VIEW };
  private readonly plateMaterial = new MeshStandardMaterial({
    color: CHAPTER_COLORS.surface,
    roughness: 0.92,
  });
  private readonly clearLiquid = new Color(CHAPTER_COLORS.clearLiquid);
  private readonly key = new DirectionalLight(0xffffff, 3.2);
  private readonly edge = new DirectionalLight(0xffffff, 1);
  private readonly ambient = new AmbientLight(0xffffff, 1);
  private composer: EffectComposer | null = null;
  private gtao: GTAOPass | null = null;
  private composerCamera: PerspectiveCamera | OrthographicCamera | null = null;
  private environment: Texture | null = null;
  private lastMotionAt = 0;
  private readonly raycaster = new Raycaster();
  private readonly observer: ResizeObserver;
  private readonly abort = new AbortController();
  private renderer: WebGLRenderer | null = null;
  private font: Font | null = null;
  private water: GpuWater | null = null;
  private liquids: LiquidSurface[] = [];
  private done: (() => void) | null = null;
  private disposed = false;
  private fillStartedAt = 0;
  private lastTime = 0;
  private active: LiquidSurface | null = null;
  private pressed: Mesh<ShapeGeometry, MeshStandardMaterial> | null = null;
  private rows: readonly ReliefRow[] = [];
  private mouseViewChanged: ((settings: ChapterViewSettings) => void) | null = null;
  private drag: { pointerId: number; x: number; y: number; pan: boolean } | null = null;
  private statsListener: ((stats: ReliefFrameStats) => void) | null = null;
  private statsWindow = { start: 0, frames: 0, worst: 0, slow: 0, cpu: 0, previous: 0 };

  constructor(
    private readonly host: HTMLElement,
    private readonly timings: ChapterTimings,
    private readonly reducedMotion: boolean,
    private readonly failed: (error: unknown) => void,
  ) {
    this.observer = new ResizeObserver(() => this.resize());
    this.scene.add(this.group, this.ambient, this.key, this.edge);
    this.setView(this.view);
    this.key.castShadow = true;
    this.edge.castShadow = true;
    for (const light of [this.key, this.edge]) {
      light.shadow.mapSize.set(CHAPTER_QUALITY.shadowMapSize, CHAPTER_QUALITY.shadowMapSize);
      Object.assign(light.shadow.camera, {
        left: -9,
        right: 9,
        top: 7,
        bottom: -7,
        near: 0.1,
        far: 30,
      });
      light.shadow.bias = -0.00015;
      light.shadow.normalBias = 0.002;
    }
  }

  get camera(): PerspectiveCamera | OrthographicCamera {
    return this.view.orthographic ? this.orthographic : this.perspective;
  }

  setView(settings: ChapterViewSettings): void {
    const lightsChanged =
      settings.keyX !== this.view.keyX ||
      settings.keyY !== this.view.keyY ||
      settings.keyZ !== this.view.keyZ ||
      settings.keyEnabled !== this.view.keyEnabled ||
      settings.edgeX !== this.view.edgeX ||
      settings.edgeY !== this.view.edgeY ||
      settings.edgeZ !== this.view.edgeZ ||
      settings.edgeEnabled !== this.view.edgeEnabled ||
      settings.planeRotationZ !== this.view.planeRotationZ;
    this.view = { ...settings };
    this.lastMotionAt = performance.now();
    this.ambient.intensity = settings.ambientIntensity;
    this.ambient.visible = settings.ambientEnabled;
    this.group.rotation.z = (settings.planeRotationZ * Math.PI) / 180;
    this.group.updateMatrixWorld();
    this.key.position.set(settings.keyX, settings.keyY, settings.keyZ);
    this.edge.position.set(settings.edgeX, settings.edgeY, settings.edgeZ);
    this.key.visible = settings.keyEnabled;
    this.edge.visible = settings.edgeEnabled;
    if (this.renderer && lightsChanged) this.renderer.shadowMap.needsUpdate = true;
    this.resize();
    this.updateGlobalIllumination();
  }

  /** Builds the GI passes lazily and tears them down when disabled to keep the default path cheap. */
  private updateGlobalIllumination(): void {
    const renderer = this.renderer;
    if (!renderer) return;
    if (!this.view.giEnabled) {
      this.disposeGlobalIllumination();
      return;
    }
    if (!this.environment) {
      const pmrem = new PMREMGenerator(renderer);
      const room = new RoomEnvironment();
      this.environment = pmrem.fromScene(room, 0.04).texture;
      room.dispose();
      pmrem.dispose();
    }
    this.scene.environment = this.environment;
    this.scene.environmentIntensity = this.view.giEnvironment;
    if (this.view.giAoIntensity <= 0) {
      this.disposeComposer();
      return;
    }
    // GTAO compiles camera-type specific shaders, so rebuild when the projection changes.
    if (this.composerCamera !== this.camera) this.disposeComposer();
    if (!this.composer) {
      const width = Math.max(1, this.host.clientWidth);
      const height = Math.max(1, this.host.clientHeight);
      this.composer = new EffectComposer(renderer);
      this.composer.setPixelRatio(renderer.getPixelRatio());
      this.composer.setSize(width, height);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      this.gtao = new GTAOPass(this.scene, this.camera, width, height);
      this.composer.addPass(this.gtao);
      this.composer.addPass(new OutputPass());
      this.composerCamera = this.camera;
    }
    this.gtao!.blendIntensity = this.view.giAoIntensity;
    this.gtao!.updateGtaoMaterial({ radius: this.view.giAoRadius });
  }

  private disposeComposer(): void {
    if (!this.composer) return;
    for (const pass of this.composer.passes) pass.dispose();
    this.composer.dispose();
    this.composer = null;
    this.gtao = null;
    this.composerCamera = null;
  }

  private disposeGlobalIllumination(): void {
    this.disposeComposer();
    this.scene.environment = null;
    this.environment?.dispose();
    this.environment = null;
  }

  /** Reports averaged frame statistics every CHAPTER_STATS.sampleMs; pass null to stop. */
  setStatsListener(listener: ((stats: ReliefFrameStats) => void) | null): void {
    this.statsListener = listener;
    this.statsWindow = { start: 0, frames: 0, worst: 0, slow: 0, cpu: 0, previous: 0 };
  }

  setMouseCamera(onChange: ((settings: ChapterViewSettings) => void) | null): void {
    this.endDrag();
    this.host.removeEventListener('pointerdown', this.cameraPointerDown);
    this.host.removeEventListener('pointerup', this.cameraPointerUp);
    this.host.removeEventListener('pointercancel', this.cameraPointerUp);
    this.host.removeEventListener('lostpointercapture', this.cameraPointerUp);
    this.host.removeEventListener('wheel', this.cameraWheel);
    this.host.removeEventListener('contextmenu', this.cameraContextMenu);
    this.mouseViewChanged = onChange;
    if (!onChange) return;
    this.host.addEventListener('pointerdown', this.cameraPointerDown);
    this.host.addEventListener('pointerup', this.cameraPointerUp);
    this.host.addEventListener('pointercancel', this.cameraPointerUp);
    this.host.addEventListener('lostpointercapture', this.cameraPointerUp);
    this.host.addEventListener('wheel', this.cameraWheel, { passive: false });
    this.host.addEventListener('contextmenu', this.cameraContextMenu);
  }

  async init(): Promise<void> {
    const response = await fetch('blueprint-water/font.json', { signal: this.abort.signal });
    if (!response.ok) throw new Error(`Could not load the relief typeface (${response.status}).`);
    const data: FontData = await response.json();
    if (this.disposed) return;
    this.font = new FontLoader().parse(data);
    this.prepareFramingBounds();
    this.renderer = new WebGLRenderer({ antialias: true });
    if (!this.renderer.extensions.has('EXT_color_buffer_float')) {
      throw new Error('GPU water requires floating-point render targets.');
    }
    this.renderer.setClearColor(CHAPTER_COLORS.surface);
    this.renderer.toneMapping = LinearToneMapping;
    this.renderer.toneMappingExposure = 0.55;
    this.renderer.setPixelRatio(
      Math.min(window.devicePixelRatio || 1, CHAPTER_QUALITY.maxPixelRatio),
    );
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFShadowMap;
    this.renderer.shadowMap.autoUpdate = false;
    // Counted per frame (including every post-processing pass) for the dev stats overlay.
    this.renderer.info.autoReset = false;
    this.renderer.domElement.setAttribute('aria-hidden', 'true');
    this.renderer.domElement.style.display = 'block';
    this.host.appendChild(this.renderer.domElement);
    // Probe floating-point render targets before the first user interaction.
    const probe = new GpuWater(this.renderer, []);
    probe.dispose();
    this.reset();
    this.observer.observe(this.host);
    this.host.addEventListener('pointermove', this.pointerMove);
    this.host.addEventListener('webglcontextlost', this.contextLost, true);
    this.resize();
    this.updateGlobalIllumination();
    this.renderer.setAnimationLoop(this.frame);
  }

  present(rows: readonly ReliefRow[], done: () => void): void {
    if (this.disposed || !this.font || !this.renderer) return;
    const previousRows = this.rows;
    this.clear();
    this.rows = structuredClone([...rows]);
    const all: Shape[] = [];
    const valueShapes: Shape[] = [];
    const newShapes: Shape[] = [];
    for (const [index, row] of rows.entries()) {
      const y = CHAPTER_SCENE.rowTop - index * CHAPTER_SCENE.rowGap;
      const labels = this.glyphs(row.label, y, true);
      all.push(...labels);
      if (previousRows[index]?.label !== row.label) newShapes.push(...labels);
      const values = this.glyphs(row.value, y, false);
      all.push(...values);
      valueShapes.push(...values);
      if (previousRows[index]?.value !== row.value) newShapes.push(...values);
      if (values.length) {
        const surface = this.liquid(row.color, values);
        const fresh = previousRows[index]?.value !== row.value;
        surface.uniforms.fillLevel.value = fresh ? 0 : FILL;
        surface.material.opacity = fresh ? 0 : CHAPTER_LIQUID.opacity;
        if (!fresh) surface.material.color.copy(surface.targetColor);
        this.setFill(surface);
        this.liquids.push(surface);
        if (fresh) this.active = surface;
      }
    }
    this.buildPlate(all);
    // Flush caps initially hide the new cavities, then descend to expose their walls.
    this.pressed = new Mesh(new ShapeGeometry(newShapes, 12), this.plateMaterial);
    this.pressed.receiveShadow = true;
    this.group.add(this.pressed);
    if (valueShapes.length) {
      this.water = new GpuWater(this.renderer, valueShapes);
      for (const surface of this.liquids) surface.uniforms.heightmap.value = this.water.texture;
    }
    // Warm the new shader while the glyph floors are still flush, not during the rise.
    for (const mesh of this.active?.meshes ?? []) mesh.visible = true;
    this.renderer.compile(this.scene, this.camera);
    this.renderer.render(this.scene, this.camera);
    if (this.active) this.setFill(this.active);
    this.fillStartedAt = performance.now();
    this.done = done;
  }

  reset(): void {
    this.clear();
    this.rows = [];
    this.buildPlate([]);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.setMouseCamera(null);
    this.statsListener = null;
    this.abort.abort();
    this.observer.disconnect();
    this.host.removeEventListener('pointermove', this.pointerMove);
    this.host.removeEventListener('webglcontextlost', this.contextLost, true);
    this.renderer?.setAnimationLoop(null);
    this.clear();
    this.disposeGlobalIllumination();
    this.plateMaterial.dispose();
    for (const light of [this.key, this.edge]) light.dispose();
    this.renderer?.dispose();
    this.renderer?.domElement.remove();
    this.renderer = null;
  }

  private glyphs(text: string, y: number, label: boolean): Shape[] {
    const shapes = this.font!.generateShapes(text, CHAPTER_SCENE.fontSize);
    if (!shapes.length) return [];
    const geometry = new ShapeGeometry(shapes);
    geometry.computeBoundingBox();
    const box: Box3 = geometry.boundingBox!;
    const x = label ? CHAPTER_SCENE.labelEdge - box.max.x : CHAPTER_SCENE.valueEdge - box.min.x;
    geometry.dispose();
    return shapes.map((shape) => {
      const points = (path: Path) =>
        path.getPoints(CHAPTER_QUALITY.curveSegments).map((p) => new Vector2(p.x + x, p.y + y));
      const result = new Shape(points(shape));
      result.holes = shape.holes.map((hole) => new Path(points(hole)));
      return result;
    });
  }

  private prepareFramingBounds(): void {
    // Reserve every possible row before the first reveal, so new text never shifts the camera.
    const candidates = [
      { label: CHAPTER_TEXT.nameLabel, values: MALE_NAMES.map((name) => name.toUpperCase()) },
      ...CHAPTER_TRAITS.map((trait) => ({
        label: trait.label,
        values: CHAPTER_LEVEL_LABELS[trait.key].map(
          (label, index) => `${index + 1}${CHAPTER_TEXT.valueSeparator}${label}`,
        ),
      })),
    ];
    this.framingBounds.makeEmpty();
    for (const [index, row] of candidates.entries()) {
      const y = CHAPTER_SCENE.rowTop - index * CHAPTER_SCENE.rowGap;
      const outlines = [
        ...this.glyphs(row.label, y, true),
        ...row.values.flatMap((value) => this.glyphs(value, y, false)),
      ];
      for (const outline of outlines) {
        for (const point of outline.getPoints()) {
          this.framingBounds.expandByPoint(new Vector3(point.x, point.y, 0));
        }
      }
    }
    this.framingBounds.min.z = -DEPTH - 0.002;
  }

  private buildPlate(outlines: readonly Shape[]): void {
    const plate = new Shape([
      new Vector2(-PLATE_HALF_SIZE, -PLATE_HALF_SIZE),
      new Vector2(PLATE_HALF_SIZE, -PLATE_HALF_SIZE),
      new Vector2(PLATE_HALF_SIZE, PLATE_HALF_SIZE),
      new Vector2(-PLATE_HALF_SIZE, PLATE_HALF_SIZE),
    ]);
    const islands: Shape[] = [];
    for (const shape of outlines) {
      plate.holes.push(new Path(shape.getPoints()));
      for (const hole of shape.holes) islands.push(new Shape(hole.getPoints()));
    }
    const top = new Mesh(
      new ExtrudeGeometry([plate, ...islands], {
        depth: DEPTH,
        bevelEnabled: false,
        curveSegments: 12,
      }),
      this.plateMaterial,
    );
    top.position.z = -DEPTH;
    top.castShadow = true;
    top.receiveShadow = true;
    const floor = new Mesh(
      new PlaneGeometry(PLATE_HALF_SIZE * 2, PLATE_HALF_SIZE * 2),
      this.plateMaterial,
    );
    floor.position.z = -DEPTH - 0.002;
    floor.receiveShadow = true;
    this.group.add(top, floor);
    if (this.renderer) this.renderer.shadowMap.needsUpdate = true;
  }

  private liquid(color: string, outlines: readonly Shape[]): LiquidSurface {
    const material = new MeshPhysicalMaterial({
      color: CHAPTER_COLORS.clearLiquid,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      roughness: CHAPTER_LIQUID.roughness,
      metalness: CHAPTER_LIQUID.metalness,
      clearcoat: CHAPTER_LIQUID.clearcoat,
      clearcoatRoughness: 0.08,
    });
    const uniforms = {
      heightmap: { value: null as Texture | null },
      fillLevel: { value: 0 },
      motion: { value: this.reducedMotion ? 0 : 1 },
      time: { value: 0 },
    };
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader =
        `
        uniform sampler2D heightmap;
        uniform float fillLevel, motion, time;
        float waterHeight(vec2 p) { return texture2D(heightmap, p / ${WATER_BOUNDS.toFixed(1)} + .5).r; }
        // Two crossing travelling waves keep the surface moving without any input.
        float swell(vec2 p) {
          float k = ${SWELL_K.toFixed(4)}, w = ${CHAPTER_WATER.swellSpeed.toFixed(4)};
          return sin(p.x * k + time * w) * .6 + sin((p.x * .55 - p.y * .85) * k * 1.3 - time * w * 1.2) * .4;
        }
      ` + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        '#include <beginnormal_vertex>',
        `
        #include <beginnormal_vertex>
        float headroom = ${DEPTH} * min(fillLevel, 1.0 - fillLevel) * .8;
        float amp = motion * min(${CHAPTER_WATER.maxAmplitude.toFixed(4)}, headroom);
        float swellAmp = motion * min(${CHAPTER_WATER.swellAmplitude.toFixed(4)}, headroom * .5);
        float cell = ${WATER_BOUNDS.toFixed(1)} / ${WATER_SIZE.toFixed(1)};
        float dx = (waterHeight(position.xy + vec2(cell, 0)) - waterHeight(position.xy - vec2(cell, 0))) * amp / (2.0 * cell)
          + (swell(position.xy + vec2(cell, 0)) - swell(position.xy - vec2(cell, 0))) * swellAmp / (2.0 * cell);
        float dy = (waterHeight(position.xy + vec2(0, cell)) - waterHeight(position.xy - vec2(0, cell))) * amp / (2.0 * cell)
          + (swell(position.xy + vec2(0, cell)) - swell(position.xy - vec2(0, cell))) * swellAmp / (2.0 * cell);
        objectNormal = normalize(vec3(-dx, -dy, 1.0));
      `,
      );
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `
        #include <begin_vertex>
        transformed.z += amp * waterHeight(position.xy) + swellAmp * swell(position.xy);
      `,
      );
    };
    const parts = outlines.map(waterGeometry);
    const geometry = mergeGeometries(parts);
    parts.forEach((part) => part.dispose());
    if (!geometry) {
      material.dispose();
      throw new Error('Could not combine the liquid glyph surfaces.');
    }
    const mesh = new Mesh(geometry, material);
    mesh.receiveShadow = true;
    this.group.add(mesh);
    const meshes = [mesh];
    return { meshes, material, uniforms, targetColor: new Color(color) };
  }

  private setFill(surface: LiquidSurface): void {
    for (const mesh of surface.meshes) {
      mesh.position.z = -DEPTH * (1 - surface.uniforms.fillLevel.value);
      mesh.visible = surface.uniforms.fillLevel.value > 0;
    }
  }

  private readonly frame = (ms: number): void => {
    if (this.disposed || !this.renderer) return;
    const started = performance.now();
    try {
      const dt = this.lastTime ? Math.min((ms - this.lastTime) / 1000, 0.1) : 0;
      this.lastTime = ms;
      if (this.water) {
        if (!this.reducedMotion) this.water.step(dt);
        for (const surface of this.liquids) {
          surface.uniforms.heightmap.value = this.water.texture;
          surface.uniforms.time.value = ms / 1000;
        }
      }
      if (this.done) {
        const elapsed = Math.max(0, ms - this.fillStartedAt);
        const pose = chapterRevealPose(elapsed, this.timings, this.active !== null);
        if (this.pressed) this.pressed.position.z = pose.floorZ;
        if (this.active) {
          this.active.uniforms.fillLevel.value = pose.fillLevel;
          this.active.material.opacity = pose.opacity;
          this.active.material.color.lerpColors(
            this.clearLiquid,
            this.active.targetColor,
            pose.tint,
          );
          this.setFill(this.active);
        }
        if (pose.completed) {
          const done = this.done;
          this.done = null;
          done();
        }
      }
      const now = performance.now();
      if (this.done || this.drag) this.lastMotionAt = now;
      const idle = now - this.lastMotionAt >= CHAPTER_QUALITY.idleDelayMs;
      const useComposer = this.composer !== null && (idle || !CHAPTER_QUALITY.giOnlyWhenIdle);
      this.renderer.info.reset();
      if (useComposer) this.composer?.render(dt);
      else this.renderer.render(this.scene, this.camera);
      if (this.statsListener) this.recordStats(ms, started, idle, useComposer);
    } catch (error) {
      this.failed(error);
    }
  };

  private recordStats(ms: number, started: number, idle: boolean, composed: boolean): void {
    const sample = this.statsWindow;
    if (sample.previous) {
      const interval = ms - sample.previous;
      sample.frames += 1;
      sample.worst = Math.max(sample.worst, interval);
      if (interval > CHAPTER_STATS.slowFrameMs) sample.slow += 1;
      sample.cpu += performance.now() - started;
    } else {
      sample.start = ms;
    }
    sample.previous = ms;
    const elapsed = ms - sample.start;
    if (elapsed < CHAPTER_STATS.sampleMs || sample.frames === 0 || !this.renderer) return;
    const canvas = this.renderer.domElement;
    const info = this.renderer.info.render;
    this.statsListener?.({
      fps: Math.round((sample.frames * 1000) / elapsed),
      frameMs: elapsed / sample.frames,
      worstFrameMs: sample.worst,
      slowFrames: sample.slow,
      cpuMs: sample.cpu / sample.frames,
      activity: idle ? 'idle' : 'moving',
      pixelRatio: this.renderer.getPixelRatio(),
      width: canvas.width,
      height: canvas.height,
      globalIllumination: !this.view.giEnabled
        ? 'off'
        : !this.composer
          ? 'environment only'
          : composed
            ? 'environment + AO'
            : 'AO skipped while moving',
      drawCalls: info.calls,
      triangles: info.triangles,
    });
    this.statsWindow = { start: ms, frames: 0, worst: 0, slow: 0, cpu: 0, previous: ms };
  }

  private clear(): void {
    this.done = null;
    this.active = null;
    this.pressed = null;
    this.water?.dispose();
    this.water = null;
    for (const child of [...this.group.children]) {
      if (child instanceof Mesh) child.geometry.dispose();
      this.group.remove(child);
    }
    for (const surface of this.liquids) surface.material.dispose();
    this.liquids = [];
  }

  private resize(): void {
    const width = Math.max(1, this.host.clientWidth);
    const height = Math.max(1, this.host.clientHeight);
    const aspect = width / height;
    const viewHeight = Math.max(7.5, 12.5 / aspect);
    const distance = viewHeight / (2 * Math.tan((32 * Math.PI) / 360));
    const yaw = (this.view.yaw * Math.PI) / 180;
    const pitch = (this.view.pitch * Math.PI) / 180;
    const target = new Vector3(this.view.panX, this.view.panY, -0.05);
    this.perspective.aspect = aspect;
    this.orthographic.left = (-viewHeight * aspect) / 2;
    this.orthographic.right = (viewHeight * aspect) / 2;
    this.orthographic.top = viewHeight / 2;
    this.orthographic.bottom = -viewHeight / 2;
    for (const camera of [this.perspective, this.orthographic]) {
      camera.position
        .copy(target)
        .add(
          new Vector3(
            Math.sin(yaw) * Math.cos(pitch) * distance,
            -Math.sin(pitch) * distance,
            Math.cos(yaw) * Math.cos(pitch) * distance,
          ),
        );
      camera.up.set(0, 1, 0);
      camera.lookAt(target);
      camera.rotateZ((this.view.roll * Math.PI) / 180);
      camera.zoom = 1;
      camera.far = Math.max(100, distance + this.framingBounds.getSize(new Vector3()).length());
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld();
      let projectedExtent = 0;
      if (!this.framingBounds.isEmpty()) {
        for (const x of [this.framingBounds.min.x, this.framingBounds.max.x]) {
          for (const y of [this.framingBounds.min.y, this.framingBounds.max.y]) {
            for (const z of [this.framingBounds.min.z, this.framingBounds.max.z]) {
              const point = this.group.localToWorld(new Vector3(x, y, z)).project(camera);
              projectedExtent = Math.max(projectedExtent, Math.abs(point.x), Math.abs(point.y));
            }
          }
        }
      }
      camera.zoom =
        projectedExtent > 0
          ? Math.min(this.view.zoom, (1 - CHAPTER_SCENE.framingPadding) / projectedExtent)
          : this.view.zoom;
      camera.updateProjectionMatrix();
    }
    if (this.renderer) {
      const ratio = this.renderer.getPixelRatio();
      const canvas = this.renderer.domElement;
      if (
        canvas.width !== Math.floor(width * ratio) ||
        canvas.height !== Math.floor(height * ratio)
      ) {
        this.renderer.setSize(width, height);
        this.composer?.setSize(width, height);
      }
    }
  }

  private readonly pointerMove = (event: PointerEvent): void => {
    if (this.mouseViewChanged) {
      this.moveCamera(event);
      return;
    }
    if (!this.water || this.reducedMotion) return;
    const rect = this.host.getBoundingClientRect();
    this.raycaster.setFromCamera(
      new Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
      ),
      this.camera,
    );
    const ray = this.raycaster.ray;
    const hit = ray.at((-DEPTH * (1 - FILL) - ray.origin.z) / ray.direction.z, new Vector3());
    // Water coordinates are in the plane's local space, which may be rotated.
    const local = this.group.worldToLocal(hit);
    this.water.disturb(local.x, local.y);
  };

  private readonly cameraPointerDown = (event: PointerEvent): void => {
    if (this.drag || event.button > 2) return;
    event.preventDefault();
    this.drag = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      pan: event.button !== 0 || event.shiftKey,
    };
    this.host.setPointerCapture(event.pointerId);
  };

  private readonly cameraPointerUp = (event: PointerEvent): void => {
    if (this.drag?.pointerId === event.pointerId) this.endDrag();
  };

  private endDrag(): void {
    const pointerId = this.drag?.pointerId;
    this.drag = null;
    if (pointerId !== undefined && this.host.hasPointerCapture(pointerId)) {
      this.host.releasePointerCapture(pointerId);
    }
  }

  private moveCamera(event: PointerEvent): void {
    const drag = this.drag;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (drag.pan) {
      const rect = this.host.getBoundingClientRect();
      const plane = new Plane(new Vector3(0, 0, 1), 0.05);
      const hit = (x: number, y: number) => {
        this.raycaster.setFromCamera(
          new Vector2(
            ((x - rect.left) / rect.width) * 2 - 1,
            -((y - rect.top) / rect.height) * 2 + 1,
          ),
          this.camera,
        );
        return this.raycaster.ray.intersectPlane(plane, new Vector3());
      };
      const before = hit(drag.x, drag.y);
      const after = hit(event.clientX, event.clientY);
      if (before && after) {
        this.updateMouseView({
          panX: this.view.panX + before.x - after.x,
          panY: this.view.panY + before.y - after.y,
        });
      }
    } else {
      this.updateMouseView({
        yaw: this.view.yaw - (event.clientX - drag.x) * CHAPTER_MOUSE.rotationDegreesPerPixel,
        pitch: this.view.pitch + (event.clientY - drag.y) * CHAPTER_MOUSE.rotationDegreesPerPixel,
      });
    }
    drag.x = event.clientX;
    drag.y = event.clientY;
  }

  private readonly cameraWheel = (event: WheelEvent): void => {
    event.preventDefault();
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? this.host.clientHeight : 1;
    this.updateMouseView({
      zoom: this.view.zoom * Math.exp(-event.deltaY * unit * CHAPTER_MOUSE.zoomPerPixel),
    });
  };

  private readonly cameraContextMenu = (event: Event): void => event.preventDefault();

  private updateMouseView(
    update: Partial<Pick<ChapterViewSettings, 'panX' | 'panY' | 'yaw' | 'pitch' | 'zoom'>>,
  ): void {
    const settings = { ...this.view, ...update };
    for (const { key, min, max } of CHAPTER_VIEW_SLIDERS) {
      if (key in update) settings[key] = Math.max(min, Math.min(max, settings[key]));
    }
    this.setView(settings);
    this.mouseViewChanged?.({ ...settings });
  }

  private readonly contextLost = (event: Event): void => {
    event.preventDefault();
    this.failed(new Error('The GPU water scene lost its WebGL context.'));
  };
}
