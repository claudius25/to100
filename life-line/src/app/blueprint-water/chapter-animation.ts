import {
  CHAPTER_LIQUID,
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
    ? {
        pressMs: Math.min(CHAPTER_REDUCED_MOTION_MS, timings.pressMs),
        labelValueDelayMs: 0,
        fillDelayMs: 0,
        fillMs: Math.min(CHAPTER_REDUCED_MOTION_MS, timings.fillMs),
        settleMs: 0,
      }
    : timings;
}

export function chapterRevealDuration(timings: ChapterTimings, hasValue: boolean): number {
  return timings.pressMs + timings.settleMs + (hasValue ? timings.fillDelayMs + timings.fillMs : 0);
}

function smoothProgress(elapsed: number, start: number, duration: number): number {
  const t =
    elapsed < start
      ? 0
      : duration === 0
        ? 1
        : Math.min(1, Math.max(0, (elapsed - start) / duration));
  return t * t * (3 - 2 * t);
}

/** A flush glyph floor sinks continuously, then clear liquid rises and develops its tint. */
export function chapterRevealPose(elapsedMs: number, timings: ChapterTimings, hasValue: boolean) {
  const pressed = smoothProgress(elapsedMs, 0, timings.pressMs);
  const fillStart = timings.pressMs + timings.fillDelayMs;
  const rise = hasValue ? smoothProgress(elapsedMs, fillStart, timings.fillMs) : 0;
  const colorDelay = timings.fillMs * CHAPTER_LIQUID.colorDelayFraction;
  const tint = hasValue
    ? smoothProgress(elapsedMs, fillStart + colorDelay, timings.fillMs - colorDelay)
    : 0;
  return {
    floorZ: -CHAPTER_SCENE.recessDepth * pressed,
    fillLevel: CHAPTER_LIQUID.targetFill * rise,
    tint,
    opacity:
      rise > 0
        ? CHAPTER_LIQUID.clearOpacity +
          (CHAPTER_LIQUID.opacity - CHAPTER_LIQUID.clearOpacity) * tint
        : 0,
    completed: elapsedMs >= chapterRevealDuration(timings, hasValue),
  };
}
