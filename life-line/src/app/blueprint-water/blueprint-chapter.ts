import {
  rollLevel,
  secureRandom,
  toBlueprintResult,
  type BlueprintResult,
  type RandomSource,
  type TraitResult,
} from '../starting-blueprint/model/starting-blueprint';
import {
  CHAPTER_LEVEL_LABELS,
  CHAPTER_CLOSING_TEXTS,
  CHAPTER_TEXT,
  CHAPTER_TRAITS,
  MALE_NAMES,
} from './chapter.constants';

export interface WaterBlueprintResult {
  name: string;
  blueprint: BlueprintResult;
}

export interface ReliefRow {
  label: string;
  value: string;
  raised: boolean;
}

export interface ChapterVisual {
  present(rows: readonly ReliefRow[], done: () => void, closingText?: string): void;
  reset(): void;
}

export type ChapterStage = 'ready' | 'animating' | 'completed';

/** Six accepted taps; visual callbacks cannot survive a reset or route disposal. */
export class BlueprintChapter {
  private generation = 0;
  private destroyed = false;
  private tap = 0;
  private name = '';
  private traits: TraitResult[] = [];
  private rows: ReliefRow[] = [];
  private closingText = '';
  stage: ChapterStage = 'ready';

  constructor(
    private readonly visual: ChapterVisual,
    private readonly changed: () => void,
    private readonly completed: (result: WaterBlueprintResult) => void,
    private readonly random: RandomSource = secureRandom,
  ) {}

  get snapshot(): { stage: ChapterStage; rows: ReliefRow[]; tap: number; closingText: string } {
    return {
      stage: this.stage,
      rows: structuredClone(this.rows),
      tap: this.tap,
      closingText: this.closingText,
    };
  }

  advance(): boolean {
    if (this.destroyed || this.stage !== 'ready') return false;
    if (this.tap === 0) {
      this.rows.push({ label: CHAPTER_TEXT.nameLabel, value: '', raised: true });
    } else if (this.tap === 1) {
      this.name = MALE_NAMES[this.sampleIndex(MALE_NAMES.length)].toUpperCase();
      this.rows[0].value = this.name;
      this.rows[0].raised = false;
    } else {
      const index = this.tap - 2;
      const trait = CHAPTER_TRAITS[index];
      const level = rollLevel(this.random);
      const result: TraitResult = {
        trait: trait.key,
        level,
        label: CHAPTER_LEVEL_LABELS[trait.key][level - 1],
      };
      if (this.tap === 5) {
        this.closingText = CHAPTER_CLOSING_TEXTS[this.sampleIndex(CHAPTER_CLOSING_TEXTS.length)];
      }
      this.traits.push(result);
      this.rows[index + 1].value = `${result.level}${CHAPTER_TEXT.valueSeparator}${result.label}`;
      this.rows[index + 1].raised = false;
    }
    if (this.tap >= 1 && this.tap <= CHAPTER_TRAITS.length) {
      this.rows.push({
        label: CHAPTER_TRAITS[this.tap - 1].label,
        value: '',
        raised: true,
      });
    }
    this.tap++;
    this.stage = 'animating';
    const generation = this.generation;
    const tap = this.tap;
    this.changed();
    this.visual.present(
      structuredClone(this.rows),
      () => {
        if (
          this.destroyed ||
          generation !== this.generation ||
          tap !== this.tap ||
          this.stage !== 'animating'
        )
          return;
        this.stage = this.tap === 6 ? 'completed' : 'ready';
        this.changed();
        if (this.stage === 'completed') {
          const blueprint = toBlueprintResult(this.traits);
          if (!blueprint) throw new Error('The completed chapter must contain all four traits.');
          this.completed({ name: this.name, blueprint });
        }
      },
      this.closingText,
    );
    return true;
  }

  reset(): void {
    if (this.destroyed) return;
    this.generation++;
    this.tap = 0;
    this.name = '';
    this.traits = [];
    this.rows = [];
    this.closingText = '';
    this.stage = 'ready';
    this.visual.reset();
    this.changed();
  }

  destroy(): void {
    this.destroyed = true;
    this.generation++;
    this.visual.reset();
  }

  private sampleIndex(length: number): number {
    const sample = this.random();
    if (!Number.isFinite(sample) || sample < 0 || sample >= 1) {
      throw new Error('Random source must return a finite number in [0, 1).');
    }
    return Math.floor(sample * length);
  }
}
