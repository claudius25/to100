import {
  chapterRevealDuration,
  chapterRevealPose,
  resolveChapterTimings,
} from './chapter-animation';
import { CHAPTER_SCENE, CHAPTER_TIMINGS, CHAPTER_REDUCED_MOTION_MS } from './chapter.constants';

describe('Chapter raised-button animation', () => {
  const timings = resolveChapterTimings();

  it('starts the next label flush, the pressed label raised, and the value flush', () => {
    const pose = chapterRevealPose(0, timings);
    expect(pose.raisedZ).toBe(0);
    expect(pose.labelZ).toBe(CHAPTER_SCENE.raisedHeight);
    expect(pose.valueZ).toBeCloseTo(0);
    expect(pose.completed).toBe(false);
  });

  it('continuously raises the next button while recessing the current label and value', () => {
    const poses = [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1].map((fraction) =>
      chapterRevealPose(timings.pressMs * fraction, timings),
    );
    expect(poses[3].raisedZ).toBeCloseTo(CHAPTER_SCENE.raisedHeight * 0.875);
    expect(poses[3].labelZ).toBeCloseTo(
      CHAPTER_SCENE.raisedHeight - (CHAPTER_SCENE.raisedHeight + CHAPTER_SCENE.recessDepth) * 0.875,
    );
    expect(poses[3].valueZ).toBeCloseTo(-CHAPTER_SCENE.recessDepth * 0.875);
    for (let i = 1; i < poses.length; i++) {
      expect(poses[i].raisedZ).toBeGreaterThan(poses[i - 1].raisedZ);
      expect(poses[i].labelZ).toBeLessThan(poses[i - 1].labelZ);
      expect(poses[i].valueZ).toBeLessThan(poses[i - 1].valueZ);
    }
    const end = chapterRevealPose(chapterRevealDuration(timings), timings);
    expect(end.raisedZ).toBeCloseTo(CHAPTER_SCENE.raisedHeight);
    expect(end.labelZ).toBeCloseTo(-CHAPTER_SCENE.recessDepth);
    expect(end.valueZ).toBeCloseTo(-CHAPTER_SCENE.recessDepth);
    expect(end.completed).toBe(true);
    expect(poses.at(-1)?.completed).toBe(false);
    expect(chapterRevealPose(100000, timings)).toEqual(end);
  });

  it('uses a quick key travel with a soft stop and a short settling pause', () => {
    expect(chapterRevealDuration(timings)).toBe(280);
    const positions = [0, 0.25, 0.5, 0.75, 1].map(
      (fraction) => chapterRevealPose(timings.pressMs * fraction, timings).raisedZ,
    );
    const travel = positions.slice(1).map((position, index) => position - positions[index]);
    for (let i = 1; i < travel.length; i++) {
      expect(travel[i]).toBeLessThan(travel[i - 1]);
    }
    expect(chapterRevealPose(-100, timings)).toEqual(chapterRevealPose(0, timings));
  });

  it('honors editable timings, shortens reduced motion, and supports instant motion', () => {
    expect(timings).toEqual(CHAPTER_TIMINGS);
    expect(resolveChapterTimings({ pressMs: 2000 }).pressMs).toBe(2000);
    const reduced = resolveChapterTimings({}, true);
    expect(chapterRevealDuration(reduced)).toBe(CHAPTER_REDUCED_MOTION_MS);
    expect(chapterRevealPose(CHAPTER_REDUCED_MOTION_MS, reduced).completed).toBe(true);
    const instant = resolveChapterTimings({ pressMs: 0, settleMs: 0 });
    expect(chapterRevealPose(0, instant)).toEqual({
      raisedZ: CHAPTER_SCENE.raisedHeight,
      labelZ: -CHAPTER_SCENE.recessDepth,
      valueZ: -CHAPTER_SCENE.recessDepth,
      completed: true,
    });
    for (const invalid of [-1, NaN, Infinity]) {
      expect(() => resolveChapterTimings({ pressMs: invalid })).toThrow('pressMs');
      expect(() => resolveChapterTimings({ settleMs: invalid })).toThrow('settleMs');
    }
  });
});
