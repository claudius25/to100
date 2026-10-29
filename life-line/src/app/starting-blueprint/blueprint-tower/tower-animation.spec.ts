import { BLUEPRINT_TRAITS, traitResult, type BlueprintLevel } from '../model/starting-blueprint';
import { drawFace } from './face-textures';
import {
  cubeRestY,
  cubeSize,
  DEFAULT_TOWER_TIMINGS,
  facingLevel,
  FLAP_OPEN_ANGLE,
  flapTipHeight,
  REDUCED_MOTION_TOWER_TIMINGS,
  restingAngle,
  revealDuration,
  revealPose,
  SIDE_FACES,
  spinPose,
  spinTarget,
  type RevealPath,
  type TowerTimings,
} from './tower-animation';
import { VIEW_AZIMUTH } from './tower-scene';

const LEVELS: BlueprintLevel[] = [1, 2, 3, 4];
const TIMING_SETS: [string, TowerTimings][] = [
  ['default', DEFAULT_TOWER_TIMINGS],
  ['reduced motion', REDUCED_MOTION_TOWER_TIMINGS],
];

function pathFor(index: number, parentAngle = 0.4): RevealPath {
  return {
    from: cubeRestY(index - 1),
    to: cubeRestY(index),
    size: cubeSize(index),
    alignedAngle: parentAngle,
    restingAngle: restingAngle(index, parentAngle),
  };
}

/**
 * Highest point of a parent flap that lies under the child's footprint.
 * Distances are measured outward from the parent's wall; the centred child
 * reaches `childHalf * (|cos| + |sin|)` from the centre when rotated.
 */
function flapHeightUnderChild(
  parentSize: number,
  childSize: number,
  open: number,
  relativeAngle: number,
): number {
  const half = parentSize / 2;
  const reach =
    (childSize / 2) * (Math.abs(Math.cos(relativeAngle)) + Math.abs(Math.sin(relativeAngle)));
  const angle = open * FLAP_OPEN_ANGLE;
  let highest = 0;
  for (let i = 0; i <= 200; i++) {
    const r = (half * i) / 200;
    const outward = -r * Math.cos(angle);
    if (outward <= reach - half) {
      highest = Math.max(highest, r * Math.sin(angle));
    }
  }
  return highest;
}

function samples(timings: TowerTimings, step = 0.002): number[] {
  const total = revealDuration(timings);
  return Array.from({ length: Math.ceil(total / step) + 1 }, (_, i) => i * step);
}

describe('tower geometry', () => {
  it('sizes cubes as 2 * 0.87^index and stacks them without gaps', () => {
    expect(cubeSize(0)).toBe(2);
    expect(cubeSize(3)).toBeCloseTo(2 * 0.87 ** 3);
    for (let i = 1; i < 4; i++) {
      expect(cubeRestY(i) - cubeSize(i) / 2).toBeCloseTo(cubeRestY(i - 1) + cubeSize(i - 1) / 2);
    }
  });

  it('maps every level to a unique side face', () => {
    expect(new Set(SIDE_FACES.map((face) => face.level)).size).toBe(4);
    expect(new Set(SIDE_FACES.map((face) => face.materialIndex)).size).toBe(4);
    expect(SIDE_FACES.some((face) => face.materialIndex === 2 || face.materialIndex === 3)).toBe(
      false,
    );
  });
});

describe('spin', () => {
  it('settles with the face showing the sampled level toward the viewer', () => {
    for (const level of LEVELS) {
      for (const from of [-0.3, 0.9, 7.4]) {
        for (const timings of [DEFAULT_TOWER_TIMINGS, REDUCED_MOTION_TOWER_TIMINGS]) {
          const to = spinTarget(from, level, VIEW_AZIMUTH, timings.spinTurns);
          expect(to).toBeGreaterThanOrEqual(from);
          expect(facingLevel(to, VIEW_AZIMUTH)).toBe(level);
          expect(spinPose(1, from, to, timings).rotationY).toBeCloseTo(to);
        }
      }
    }
  });

  it('prints the same label and level on each face texture as the emitted result', () => {
    BLUEPRINT_TRAITS.forEach((trait, traitIndex) => {
      for (const level of LEVELS) {
        const text: string[] = [];
        const context = new Proxy(
          {},
          {
            get: (_target, key) =>
              key === 'fillText' ? (value: string) => text.push(value) : () => undefined,
            set: () => true,
          },
        ) as CanvasRenderingContext2D;
        drawFace(context, traitIndex, level - 1);
        const result = traitResult(traitIndex, level);

        expect(result.trait).toBe(trait.key);
        expect(text).toEqual([trait.name.toUpperCase(), `${result.label}  ·  ${level}/4`]);
      }
    });
  });

  it('does not wobble or bob with reduced motion', () => {
    const pose = spinPose(0.3, 0, 1, REDUCED_MOTION_TOWER_TIMINGS);
    expect(pose.rotationZ).toBe(0);
    expect(pose.lift).toBe(0);
  });
});

describe.each(TIMING_SETS)('reveal (%s)', (_name, timings) => {
  for (const index of [1, 2, 3]) {
    const path = pathFor(index);
    const parentTop = cubeRestY(index - 1) + cubeSize(index - 1) / 2;
    const parentSize = cubeSize(index - 1);

    it(`keeps cube ${index} aligned and full scale until it clears the rim`, () => {
      for (const t of samples(timings)) {
        const pose = revealPose(t, path, timings);
        const bottom = pose.y - (path.size * pose.scaleY) / 2;
        if (bottom < parentTop - 1e-9) {
          expect(pose.rotationY).toBe(path.alignedAngle);
          expect(pose.scaleXZ).toBe(1);
          expect(pose.scaleY).toBe(1);
        }
      }
    });

    it(`keeps cube ${index} above the flaps throughout the sweep`, () => {
      let sawFlight = false;
      for (const t of samples(timings)) {
        const pose = revealPose(t, path, timings);
        if (pose.phase !== 'flight') {
          continue;
        }
        sawFlight = true;
        const bottom = pose.y - path.size / 2;
        const flap = flapHeightUnderChild(
          parentSize,
          path.size,
          pose.flapOpen,
          pose.rotationY - path.alignedAngle,
        );
        expect(bottom).toBeGreaterThan(parentTop + flap);
        // A closing flap passes upright inside the opening; the child must already be above it.
        if (pose.flapOpen > 0 && pose.flapOpen * FLAP_OPEN_ANGLE <= Math.PI / 2) {
          expect(bottom).toBeGreaterThan(parentTop + flapTipHeight(parentSize, pose.flapOpen));
        }
      }
      expect(sawFlight).toBe(true);
    });

    it(`closes the flaps and finishes rotating before cube ${index} lands`, () => {
      const contact = timings.opening + timings.launch + timings.flight;
      const before = revealPose(contact - 1e-4, path, timings);
      expect(before.flapOpen).toBe(0);
      expect(before.rotationY).toBeCloseTo(path.restingAngle);
      expect(Math.abs(path.restingAngle - path.alignedAngle)).toBeCloseTo(Math.PI / 6);
    });

    it(`never sinks cube ${index} into its parent while landing`, () => {
      for (const t of samples(timings)) {
        const pose = revealPose(t, path, timings);
        if (pose.phase === 'landing' || pose.phase === 'settled') {
          expect(pose.y - (path.size * pose.scaleY) / 2).toBeGreaterThanOrEqual(parentTop - 1e-9);
        }
      }
      expect(revealPose(revealDuration(timings) + 0.01, path, timings)).toMatchObject({
        phase: 'settled',
        y: path.to,
        scaleY: 1,
      });
    });
  }

  it('starts hidden inside the parent while the flaps open', () => {
    const pose = revealPose(timings.opening / 2, pathFor(1), timings);
    expect(pose.visible).toBe(false);
    expect(pose.y).toBe(cubeRestY(0));
    expect(pose.flapOpen).toBeGreaterThan(0);
  });
});

it('uses a shorter reveal without a bounce for reduced motion', () => {
  expect(revealDuration(REDUCED_MOTION_TOWER_TIMINGS)).toBeLessThan(
    revealDuration(DEFAULT_TOWER_TIMINGS) / 2,
  );
  const landed = DEFAULT_TOWER_TIMINGS.opening + DEFAULT_TOWER_TIMINGS.launch;
  expect(revealDuration(DEFAULT_TOWER_TIMINGS)).toBeCloseTo(landed + 0.85 + 0.48);
  expect(REDUCED_MOTION_TOWER_TIMINGS.bounce).toBe(false);
});
