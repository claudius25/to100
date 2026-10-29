import { Vector3 } from 'three';
import { CHAPTER_TIMINGS, CHAPTER_VIEW } from './chapter.constants';
import { ReliefScene } from './relief-scene';

describe('Chapter camera controls', () => {
  let scene: ReliefScene;
  let host: HTMLDivElement;

  beforeEach(() => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        disconnect() {}
      },
    );
    host = document.createElement('div');
    Object.defineProperties(host, {
      clientWidth: { configurable: true, value: 1200 },
      clientHeight: { configurable: true, value: 600 },
    });
    scene = new ReliefScene(host, { ...CHAPTER_TIMINGS }, vi.fn());
  });

  afterEach(() => {
    scene.dispose();
    vi.unstubAllGlobals();
  });

  it('switches projections without changing framing at the target plane', () => {
    scene.setView({ ...CHAPTER_VIEW, orthographic: false });
    const target = new Vector3(CHAPTER_VIEW.panX, CHAPTER_VIEW.panY, -0.05);
    const point = target.clone().add(new Vector3(1, 0, 0));
    const perspectivePoint = point.clone().project(scene.camera);
    expect(scene.camera.type).toBe('PerspectiveCamera');
    scene.setView({ ...CHAPTER_VIEW, orthographic: true });
    expect(scene.camera.type).toBe('OrthographicCamera');
    const orthographicPoint = point.clone().project(scene.camera);
    expect(orthographicPoint.x).toBeCloseTo(perspectivePoint.x);
    expect(orthographicPoint.y).toBeCloseTo(perspectivePoint.y);
    expect(target.clone().project(scene.camera).x).toBeCloseTo(0);
    expect(target.clone().project(scene.camera).y).toBeCloseTo(0);
  });

  it('applies zoom, pan, orbit and roll for either projection and preserves them on resize', () => {
    for (const orthographic of [false, true]) {
      const settings = {
        ...CHAPTER_VIEW,
        orthographic,
        zoom: 2,
        panX: 2,
        panY: -1,
        yaw: 35,
        pitch: 30,
        roll: 20,
      };
      scene.setView(settings);
      const target = new Vector3(settings.panX, settings.panY, -0.05);
      const direction = target.clone().sub(scene.camera.position).normalize();
      expect(scene.camera.getWorldDirection(new Vector3()).distanceTo(direction)).toBeLessThan(
        1e-10,
      );
      expect(scene.camera.zoom).toBe(2);
      expect(scene.camera.position.x).toBeGreaterThan(target.x);
      expect(scene.camera.position.y).toBeLessThan(target.y);
      const centered = target.clone().project(scene.camera);
      expect(centered.x).toBeCloseTo(0);
      expect(centered.y).toBeCloseTo(0);
      const horizontal = target
        .clone()
        .add(new Vector3(1, 0, 0))
        .project(scene.camera);
      scene.setView({ ...settings, roll: 0 });
      expect(
        target
          .clone()
          .add(new Vector3(1, 0, 0))
          .project(scene.camera).y,
      ).not.toBeCloseTo(horizontal.y);
      Object.defineProperty(host, 'clientWidth', { configurable: true, value: 600 });
      scene.setView(settings);
      expect(scene.camera.zoom).toBe(2);
      expect(target.clone().project(scene.camera).x).toBeCloseTo(0);
      scene.reset();
      expect(scene.camera.zoom).toBe(2);
    }
  });
});
