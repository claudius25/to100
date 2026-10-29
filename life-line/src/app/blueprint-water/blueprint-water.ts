import { DecimalPipe, isPlatformBrowser, JsonPipe } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  NgZone,
  output,
  PLATFORM_ID,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import type { RandomSource } from '../starting-blueprint/model/starting-blueprint';
import {
  BlueprintChapter,
  type ChapterVisual,
  type ReliefRow,
  type WaterBlueprintResult,
} from './blueprint-chapter';
import { ReliefScene, type ReliefFrameStats } from './relief-scene';
import {
  CHAPTER_COLORS,
  CHAPTER_DEBUG,
  CHAPTER_DEV_BUTTON,
  CHAPTER_LIQUID,
  CHAPTER_SCENE,
  CHAPTER_STATS,
  CHAPTER_TEXT,
  CHAPTER_VIEW,
  CHAPTER_VIEW_SLIDERS,
  type ChapterTimings,
  type ChapterViewSettings,
} from './chapter.constants';
import { chapterRevealDuration, resolveChapterTimings } from './chapter-animation';

type LightToggle = 'keyEnabled' | 'edgeEnabled' | 'ambientEnabled' | 'giEnabled';

@Component({
  selector: 'app-blueprint-water',
  imports: [JsonPipe, DecimalPipe],
  templateUrl: './blueprint-water.html',
  styleUrl: './blueprint-water.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BlueprintWater {
  readonly random = input<RandomSource | undefined>();
  readonly timings = input<Partial<ChapterTimings>>({});
  readonly blueprintCompleted = output<WaterBlueprintResult>();
  private readonly zone = inject(NgZone);
  private readonly router = inject(Router);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly host = viewChild.required<ElementRef<HTMLDivElement>>('stage');
  private scene: ReliefScene | null = null;
  private chapter: BlueprintChapter | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private pendingDone: (() => void) | null = null;
  private disposed = false;
  private visualGeneration = 0;
  private readonly reducedMotion = signal(false);

  protected readonly text = CHAPTER_TEXT;
  protected readonly colors = CHAPTER_COLORS;
  protected readonly liquid = CHAPTER_LIQUID;
  protected readonly fontScale = CHAPTER_SCENE.fontSize / 0.62;
  protected readonly devButton = CHAPTER_DEV_BUTTON;
  protected readonly debugEnabled = signal<boolean>(CHAPTER_DEBUG);
  protected readonly mouseCamera = signal(false);
  protected readonly showStats = signal<boolean>(CHAPTER_STATS.visible);
  protected readonly frameStats = signal<ReliefFrameStats | null>(null);
  protected readonly viewSettings = signal<ChapterViewSettings>({ ...CHAPTER_VIEW });
  protected readonly viewSliders = CHAPTER_VIEW_SLIDERS;
  protected readonly viewGroups = [
    'Camera',
    'Plane',
    'Key light',
    'Fill light',
    'Ambient light',
    'Global illumination',
  ];
  protected readonly lightToggles: Readonly<Record<string, LightToggle>> = {
    'Key light': 'keyEnabled',
    'Fill light': 'edgeEnabled',
    'Ambient light': 'ambientEnabled',
    'Global illumination': 'giEnabled',
  };
  protected readonly visualRows = signal<readonly ReliefRow[]>([]);
  private readonly pressingLabel = signal(false);
  protected readonly animationTimings = computed(() =>
    resolveChapterTimings(this.timings(), this.reducedMotion()),
  );
  protected readonly mode = signal<'loading' | 'webgl' | 'fallback'>('loading');
  protected readonly notice = signal('');
  protected readonly snapshot = signal<BlueprintChapter['snapshot']>({
    stage: 'ready',
    rows: [],
    tap: 0,
  });
  protected readonly result = signal<WaterBlueprintResult | null>(null);
  protected readonly navigationError = signal('');
  protected readonly navigating = signal(false);
  protected readonly busy = computed(
    () => this.mode() === 'loading' || this.snapshot().stage === 'filling',
  );
  protected readonly hint = computed(() => {
    if (this.mode() === 'loading') return CHAPTER_TEXT.loading;
    if (this.mouseCamera()) {
      return 'Camera mode: drag to rotate, right-drag to pan, scroll to zoom. Disable mouse controls to continue.';
    }
    if (this.snapshot().stage === 'completed') return CHAPTER_TEXT.completed;
    if (this.snapshot().stage === 'filling') return CHAPTER_TEXT.animating;
    return CHAPTER_TEXT.hints[this.snapshot().tap];
  });
  protected readonly announcement = computed(() =>
    this.visualRows()
      .map((row) => `${row.label} ${row.value}`)
      .join(' '),
  );

  constructor() {
    afterNextRender(() => {
      void this.initialise();
    });
    inject(DestroyRef).onDestroy(() => {
      this.disposed = true;
      this.chapter?.destroy();
      this.scene?.dispose();
      this.clearTimer();
    });
  }

  protected advance(): void {
    if (!this.mouseCamera() && !this.busy()) this.chapter?.advance();
  }

  protected restart(): void {
    this.result.set(null);
    this.navigationError.set('');
    this.chapter?.reset();
  }

  protected newLabel(index: number): boolean {
    return (
      this.snapshot().stage === 'filling' &&
      index === this.visualRows().length - 1 &&
      this.pressingLabel()
    );
  }

  protected changeView(key: (typeof CHAPTER_VIEW_SLIDERS)[number]['key'], event: Event): void {
    if (!this.debugEnabled() || !(event.target instanceof HTMLInputElement)) return;
    const slider = this.viewSliders.find((entry) => entry.key === key);
    const value = event.target.valueAsNumber;
    if (!slider || !Number.isFinite(value) || value < slider.min || value > slider.max) {
      console.error('Invalid chapter scene slider value.', key, value);
      return;
    }
    this.applyView({ ...this.viewSettings(), [key]: value });
  }

  protected toggleProjection(): void {
    if (this.debugEnabled()) {
      this.applyView({ ...this.viewSettings(), orthographic: !this.viewSettings().orthographic });
    }
  }

  protected resetView(): void {
    if (this.debugEnabled()) this.applyView({ ...CHAPTER_VIEW });
  }

  protected toggleMouseCamera(): void {
    if (!this.debugEnabled() || this.mode() !== 'webgl') return;
    this.mouseCamera.update((enabled) => !enabled);
    this.syncMouseCamera();
  }

  protected toggleLight(key: LightToggle): void {
    if (this.debugEnabled()) {
      this.applyView({ ...this.viewSettings(), [key]: !this.viewSettings()[key] });
    }
  }

  protected toggleDevTools(): void {
    if (!this.devButton) return;
    this.debugEnabled.update((enabled) => !enabled);
    if (!this.debugEnabled() && this.mouseCamera()) {
      this.mouseCamera.set(false);
      this.syncMouseCamera();
    }
    this.syncStats();
  }

  protected toggleStats(): void {
    if (!this.debugEnabled()) return;
    this.showStats.update((visible) => !visible);
    this.syncStats();
  }

  private syncStats(): void {
    const listen = this.debugEnabled() && this.showStats() && this.mode() === 'webgl';
    if (!listen) this.frameStats.set(null);
    this.zone.runOutsideAngular(() =>
      this.scene?.setStatsListener(
        listen ? (stats) => this.zone.run(() => this.frameStats.set(stats)) : null,
      ),
    );
  }

  private syncMouseCamera(): void {
    this.zone.runOutsideAngular(() =>
      this.scene?.setMouseCamera(
        this.mouseCamera()
          ? (settings) => this.zone.run(() => this.viewSettings.set(settings))
          : null,
      ),
    );
  }

  private applyView(settings: ChapterViewSettings): void {
    this.viewSettings.set(settings);
    this.zone.runOutsideAngular(() => this.scene?.setView(settings));
  }

  protected async beginLife(): Promise<void> {
    const result = this.result();
    if (!result || this.navigating()) return;
    this.navigating.set(true);
    this.navigationError.set('');
    try {
      const navigated = await this.router.navigateByUrl('/game', {
        state: { blueprintChapter: structuredClone(result) },
      });
      if (!navigated) this.navigationError.set(CHAPTER_TEXT.navigationFailed);
    } catch (error) {
      console.error('Could not begin the life journey.', error);
      this.navigationError.set(CHAPTER_TEXT.navigationFailed);
    } finally {
      this.navigating.set(false);
    }
  }

  private async initialise(): Promise<void> {
    if (!this.browser || this.disposed) return;
    this.reducedMotion.set(
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
    );
    if (typeof WebGL2RenderingContext !== 'undefined') {
      const scene = new ReliefScene(
        this.host().nativeElement,
        this.animationTimings(),
        this.reducedMotion(),
        (error) => this.zone.run(() => this.useFallback(error)),
      );
      this.scene = scene;
      try {
        await this.zone.runOutsideAngular(() => scene.init());
        if (this.disposed) return;
        scene.setView(this.viewSettings());
        this.mode.set('webgl');
        this.syncMouseCamera();
        this.syncStats();
      } catch (error) {
        if (this.disposed) return;
        this.useFallback(error);
      }
    } else {
      this.mode.set('fallback');
      this.notice.set(CHAPTER_TEXT.noGpu);
    }
    if (this.disposed) return;
    const visual: ChapterVisual = {
      present: (rows, done) => {
        const generation = ++this.visualGeneration;
        if (rows.length > 1) {
          const labelRows = rows.map((row, index) =>
            index === rows.length - 1 ? { ...row, value: '' } : row,
          );
          this.presentRows(
            labelRows,
            () => {
              if (this.disposed || generation !== this.visualGeneration) return;
              this.timer = setTimeout(() => {
                this.timer = null;
                if (!this.disposed && generation === this.visualGeneration) {
                  this.presentRows(rows, done, false);
                }
              }, this.animationTimings().labelValueDelayMs);
            },
            true,
          );
        } else {
          this.presentRows(rows, done, !rows[0]?.value);
        }
      },
      reset: () => {
        this.visualGeneration++;
        this.clearTimer();
        this.pendingDone = null;
        this.visualRows.set([]);
        this.scene?.reset();
      },
    };
    this.chapter = new BlueprintChapter(
      visual,
      () => this.snapshot.set(this.chapter!.snapshot),
      (result) => {
        this.result.set(structuredClone(result));
        this.blueprintCompleted.emit(structuredClone(result));
      },
      this.random(),
    );
  }

  private presentRows(rows: readonly ReliefRow[], done: () => void, label: boolean): void {
    this.visualRows.set(rows);
    this.pressingLabel.set(label);
    const complete = () =>
      this.zone.run(() => {
        this.pendingDone = null;
        done();
      });
    this.pendingDone = complete;
    if (this.scene) {
      try {
        this.zone.runOutsideAngular(() => this.scene!.present(rows, complete));
      } catch (error) {
        this.useFallback(error);
      }
    } else {
      this.preview(rows, complete);
    }
  }

  private preview(rows: readonly ReliefRow[], done: () => void): void {
    this.clearTimer();
    this.timer = setTimeout(
      () => {
        this.timer = null;
        this.pendingDone = null;
        done();
      },
      chapterRevealDuration(this.animationTimings(), !!rows.at(-1)?.value),
    );
  }

  private useFallback(error: unknown): void {
    console.error('The recessed-text GPU water scene is unavailable.', error);
    this.scene?.dispose();
    this.scene = null;
    this.mouseCamera.set(false);
    this.frameStats.set(null);
    this.mode.set('fallback');
    this.notice.set(CHAPTER_TEXT.gpuFailed);
    const done = this.pendingDone;
    if (done) this.preview(this.visualRows(), done);
  }

  private clearTimer(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }
}
