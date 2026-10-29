import {
  CHAPTER_REDUCED_MOTION_MS,
  CHAPTER_SCENE,
  CHAPTER_TIMINGS,
  type ChapterTimings,
} from './chapter.constants';

export function resolveChapterTimings(
  overrides: Partial<ChapterTimings> = {},
  reducedMotion = false,
): ChapterTimings {
  const timings = { ...CHAPTER_TIMINGS, ...overrides };
  for (const [name, value] of Object.entries(timings)) {
    if (!Number.isFinite(value) || value < 0) {
      throw new Error(`Chapter timing ${name} must be a finite, non-negative number.`);
    }
  }
  return reducedMotion
    ? { pressMs: Math.min(CHAPTER_REDUCED_MOTION_MS, timings.pressMs), settleMs: 0 }
    : timings;
}

export function chapterRevealDuration(timings: ChapterTimings): number {
  return timings.pressMs + timings.settleMs;
}

/** The current label and value sink while the next button rises from the same surface. */
export function chapterRevealPose(elapsedMs: number, timings: ChapterTimings) {
  const t = timings.pressMs === 0 ? 1 : Math.min(1, Math.max(0, elapsedMs / timings.pressMs));
  // Cubic ease-out: immediate key travel followed by a soft mechanical stop.
  const progress = 1 - (1 - t) ** 3;
  return {
    raisedZ: CHAPTER_SCENE.raisedHeight * progress,
    labelZ:
      CHAPTER_SCENE.raisedHeight -
      (CHAPTER_SCENE.raisedHeight + CHAPTER_SCENE.recessDepth) * progress,
    valueZ: -CHAPTER_SCENE.recessDepth * progress,
    completed: elapsedMs >= chapterRevealDuration(timings),
  };
}
