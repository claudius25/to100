import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

export const ACTION_BUTTON_ICONS = ['restart', 'play', 'next'] as const;

export type ActionButtonIcon = (typeof ACTION_BUTTON_ICONS)[number];

export const ACTION_BUTTON_LABELS: Record<ActionButtonIcon, string> = {
  restart: 'Restart',
  play: 'Play',
  next: 'Next',
};

function positivePx(value: number | null): string | null {
  return value !== null && Number.isFinite(value) && value > 0 ? `${value}px` : null;
}

/**
 * The round, softly glowing control used over the launcher artwork. It renders
 * a single glyph and reports presses; what a press means is the caller's.
 */
@Component({
  selector: 'app-action-button',
  templateUrl: './action-button.component.html',
  styleUrl: './action-button.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[style.--action-button-size]': 'sizeStyle()' },
})
export class ActionButtonComponent {
  readonly icon = input.required<ActionButtonIcon>();
  /** Overrides the default accessible name, for example "Start a new life". */
  readonly label = input<string>('');
  readonly disabled = input<boolean>(false);
  /** Optional diameter in px; null leaves the stylesheet default in place. */
  readonly size = input<number | null>(null);
  readonly pressed = output<ActionButtonIcon>();

  readonly sizeStyle = computed(() => positivePx(this.size()));
  readonly accessibleLabel = computed(
    () => this.label().trim() || ACTION_BUTTON_LABELS[this.icon()],
  );

  protected press(): void {
    if (!this.disabled()) this.pressed.emit(this.icon());
  }
}
