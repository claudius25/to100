import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  NgZone,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  CHARACTER_PRESETS,
  CHARACTER_SLIDERS,
  DEFAULT_CHARACTER_CONFIG,
  type CharacterConfig,
  type CharacterPreset,
  type SliderSpec,
} from './model/character-config';import { isWebGLAvailable, MARKER_COUNT, SceneController, type LabStatus } from './three/scene-controller';

const IDLE_STATUS: LabStatus = {
  currentMarker: 0,
  targetMarker: null,
  hoveredMarker: null,
  moving: false,
  continuous: false,
  paused: false,
};

@Component({
  selector: 'app-character-lab',
  imports: [RouterLink],
  templateUrl: './character-lab.html',
  styleUrl: './character-lab.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CharacterLab {
  private readonly zone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);
  private scene: SceneController | null = null;

  protected readonly stage = viewChild.required<ElementRef<HTMLDivElement>>('stage');

  protected readonly sliders: readonly SliderSpec[] = CHARACTER_SLIDERS;
  protected readonly presets: readonly CharacterPreset[] = CHARACTER_PRESETS;
  protected readonly markerIndexes = Array.from({ length: MARKER_COUNT }, (_, index) => index);

  protected readonly config = signal<CharacterConfig>({ ...DEFAULT_CHARACTER_CONFIG });
  protected readonly status = signal<LabStatus>(IDLE_STATUS);
  protected readonly speed = signal(1.1);
  protected readonly outlineThickness = signal(0.011);
  protected readonly webglSupported = signal(true);
  protected readonly activePreset = signal<string | null>(null);

  protected readonly statusLabel = computed(() => {
    const state = this.status();
    if (state.paused) {
      return 'Paused';
    }
    if (state.targetMarker !== null) {
      return `Walking to marker ${state.targetMarker + 1}`;
    }
    if (state.currentMarker !== null) {
      return `Idle at marker ${state.currentMarker + 1}`;
    }
    return 'Idle';
  });

  constructor() {
    afterNextRender(() => this.initialiseScene());
    this.destroyRef.onDestroy(() => {
      this.scene?.dispose();
      this.scene = null;
    });
  }

  private initialiseScene(): void {
    if (this.scene) {
      return;
    }
    if (!isWebGLAvailable()) {
      this.webglSupported.set(false);
      return;
    }
    const host = this.stage().nativeElement;
    // Three.js owns its own render loop; keeping it outside Angular guarantees no
    // change detection runs per frame. Angular state only moves via `status`.
    this.zone.runOutsideAngular(() => {
      try {
        const controller = new SceneController(host, (next) => this.status.set(next));
        controller.init(this.config());
        controller.setSpeed(this.speed());
        controller.setOutlineThickness(this.outlineThickness());
        this.scene = controller;
      } catch {
        this.webglSupported.set(false);
      }
    });
  }

  protected onSliderInput(key: keyof CharacterConfig, event: Event): void {
    const value = (event.target as HTMLInputElement).valueAsNumber;
    if (!Number.isFinite(value)) {
      return;
    }
    const next: CharacterConfig = { ...this.config(), [key]: value };
    this.config.set(next);
    this.activePreset.set(null);
    this.scene?.setConfig(next);
  }

  protected applyPreset(preset: CharacterPreset): void {
    const next = { ...preset.config };
    this.config.set(next);
    this.activePreset.set(preset.id);
    this.scene?.setConfig(next);
  }

  protected onSpeedInput(event: Event): void {
    const value = (event.target as HTMLInputElement).valueAsNumber;
    if (!Number.isFinite(value)) {
      return;
    }
    this.speed.set(value);
    this.scene?.setSpeed(value);
  }

  protected onOutlineInput(event: Event): void {
    const value = (event.target as HTMLInputElement).valueAsNumber;
    if (!Number.isFinite(value)) {
      return;
    }
    this.outlineThickness.set(value);
    this.scene?.setOutlineThickness(value);
  }

  protected onContinuousChange(event: Event): void {
    this.scene?.setContinuous((event.target as HTMLInputElement).checked);
  }

  protected selectMarker(index: number): void {
    this.scene?.selectMarker(index);
  }

  protected togglePause(): void {
    this.scene?.togglePause();
  }

  protected reset(): void {
    this.scene?.reset();
  }

  protected configValue(key: keyof CharacterConfig): number {
    return this.config()[key];
  }
}
