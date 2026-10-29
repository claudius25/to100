import {
  chapterRevealDuration,
  chapterRevealPose,
  resolveChapterTimings,
} from './chapter-animation';
import { CHAPTER_LIQUID, CHAPTER_SCENE, CHAPTER_TIMINGS } from './chapter.constants';

describe('Chapter press-in and liquid animation', () => {
  const timings = resolveChapterTimings();
  const fillStart = timings.pressMs + timings.fillDelayMs;

  it('starts flush and transparent, then continuously pushes the floor downward', () => {
    const start = chapterRevealPose(0, timings, true);
    expect(start.floorZ).toBeCloseTo(0);
    expect(start.fillLevel).toBe(0);
    expect(start.opacity).toBe(0);
    expect(start.tint).toBe(0);
    const depths = [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1].map(
      (fraction) => chapterRevealPose(timings.pressMs * fraction, timings, true).floorZ,
    );
    expect(depths[3]).toBeCloseTo(-CHAPTER_SCENE.recessDepth / 2);
    for (let i = 1; i < depths.length; i++) expect(depths[i]).toBeLessThan(depths[i - 1]);
    expect(depths.at(-1)).toBeCloseTo(-CHAPTER_SCENE.recessDepth);
    const beforeEnd = chapterRevealPose(timings.pressMs - 1, timings, true);
    expect(Math.abs(beforeEnd.floorZ + CHAPTER_SCENE.recessDepth)).toBeLessThan(0.00001);
    expect(beforeEnd.fillLevel).toBe(0);
    expect(chapterRevealPose(fillStart, timings, true).fillLevel).toBe(0);
  });

  it('lets the liquid rise clear before gradually developing opacity and color', () => {
    const early = chapterRevealPose(fillStart + timings.fillMs * 0.05, timings, true);
    expect(early.fillLevel).toBeGreaterThan(0);
    expect(early.tint).toBe(0);
    expect(early.opacity).toBe(CHAPTER_LIQUID.clearOpacity);
    const fractions = [0.2, 0.4, 0.6, 0.8, 1];
    let previous = early;
    for (const fraction of fractions) {
      const pose = chapterRevealPose(fillStart + timings.fillMs * fraction, timings, true);
      expect(pose.floorZ).toBeCloseTo(-CHAPTER_SCENE.recessDepth);
      expect(pose.fillLevel).toBeGreaterThan(previous.fillLevel);
      expect(pose.opacity).toBeGreaterThan(previous.opacity);
      expect(pose.tint).toBeGreaterThan(previous.tint);
      expect(pose.completed).toBe(false);
      previous = pose;
    }
    expect(previous.fillLevel).toBe(CHAPTER_LIQUID.targetFill);
    expect(previous.opacity).toBe(CHAPTER_LIQUID.opacity);
    expect(previous.tint).toBe(1);
    const end = chapterRevealPose(chapterRevealDuration(timings, true), timings, true);
    expect(end.completed).toBe(true);
    expect(chapterRevealPose(100000, timings, true)).toEqual(end);
  });

  it('presses Name alone without waiting for or showing any liquid', () => {
    const duration = chapterRevealDuration(timings, false);
    expect(duration).toBe(timings.pressMs + timings.settleMs);
    const halfway = chapterRevealPose(timings.pressMs / 2, timings, false);
    expect(halfway.floorZ).toBeCloseTo(-CHAPTER_SCENE.recessDepth / 2);
    const end = chapterRevealPose(duration, timings, false);
    expect(end.completed).toBe(true);
    expect(end.fillLevel).toBe(0);
    expect(end.tint).toBe(0);
    expect(end.opacity).toBe(0);
  });

  it('honors editable timings, shortens reduced motion, and rejects invalid durations', () => {
    expect(timings).toEqual(CHAPTER_TIMINGS);
    expect(resolveChapterTimings({ pressMs: 2000, fillMs: 3000 }).pressMs).toBe(2000);
    const reduced = resolveChapterTimings({}, true);
    expect(reduced.labelValueDelayMs).toBe(0);
    expect(chapterRevealDuration(reduced, true)).toBe(240);
    expect(chapterRevealPose(240, reduced, true).completed).toBe(true);
    const instant = resolveChapterTimings({ pressMs: 0, fillDelayMs: 0, fillMs: 0, settleMs: 0 });
    expect(chapterRevealPose(0, instant, true)).toEqual({
      floorZ: -CHAPTER_SCENE.recessDepth,
      fillLevel: CHAPTER_LIQUID.targetFill,
      opacity: CHAPTER_LIQUID.opacity,
      tint: 1,
      completed: true,
    });
    for (const invalid of [-1, NaN, Infinity]) {
      expect(() => resolveChapterTimings({ pressMs: invalid })).toThrow('pressMs');
      expect(() => resolveChapterTimings({ labelValueDelayMs: invalid })).toThrow(
        'labelValueDelayMs',
      );
    }
  });
});
