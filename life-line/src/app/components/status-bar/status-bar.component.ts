import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type Disposition = 1 | 2 | 3 | 4;

export const DISPOSITION_NAMES: Record<Disposition, string> = {
  1: 'Very sad',
  2: 'Sad',
  3: 'Neutral',
  4: 'Happy',
};

const MOUTHS: Record<Disposition, string> = {
  1: 'M 23 40 Q 32 22 41 40',
  2: 'M 24 38 Q 32 29 40 38',
  3: 'M 24 35 H 40',
  4: 'M 23 33 Q 32 47 41 33',
};

const HEALTH_COLORS = [
  [196, 121, 126],
  [230, 155, 140],
  [236, 205, 148],
  [174, 214, 162],
  [102, 199, 162],
] as const;

function percentage(value: number): number {
  return Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0;
}

function positivePx(value: number | null): string | null {
  return value !== null && Number.isFinite(value) && value > 0 ? `${value}px` : null;
}

export function formatStatusMoney(value: number): string {
  const amount = Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
  if (amount < 1_000) return String(amount);
  const thousands = Math.round(amount / 100) / 10;
  if (thousands < 1_000) return `${thousands}k`;
  return `${Math.round(amount / 100_000) / 10}m`;
}

@Component({
  selector: 'app-status-bar',
  templateUrl: './status-bar.component.html',
  styleUrl: './status-bar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[style.width]': 'widthStyle()',
    '[style.--status-bar-track-height]': 'heightStyle()',
  },
})
export class StatusBarComponent {
  readonly health = input<number>(100);
  readonly disposition = input<Disposition>(4);
  readonly age = input<number>(0);
  readonly money = input<number>(0);
  /** Optional total width in px; null lets the parent control it. */
  readonly width = input<number | null>(null);
  /** Optional health-track height in px; padding, face and money text scale with it. */
  readonly height = input<number | null>(null);

  readonly widthStyle = computed(() => positivePx(this.width()));
  readonly heightStyle = computed(() => positivePx(this.height()));

  readonly renderedHealth = computed(() => percentage(this.health()));
  readonly renderedAge = computed(() => percentage(this.age()));
  readonly formattedMoney = computed(() => formatStatusMoney(this.money()));
  readonly expression = computed<Disposition>(() => {
    const value = this.disposition();
    return value === 1 || value === 2 || value === 3 || value === 4 ? value : 4;
  });
  readonly mouth = computed(() => MOUTHS[this.expression()]);
  readonly accessibleLabel = computed(
    () =>
      `Health ${this.renderedHealth()} of 100. ${DISPOSITION_NAMES[this.expression()]}. ` +
      `Age ${this.renderedAge()} years. Money ${this.formattedMoney()}.`,
  );
  readonly fillColors = computed(() => {
    const position = this.renderedHealth() / 25;
    const index = Math.min(3, Math.floor(position));
    const blend = position - index;
    const channels = HEALTH_COLORS[index].map((channel, channelIndex) =>
      Math.round(channel + (HEALTH_COLORS[index + 1][channelIndex] - channel) * blend),
    );
    return {
      start: `rgb(${channels.join(', ')})`,
      end: `rgb(${channels.map((channel) => Math.round(channel + (255 - channel) * 0.45)).join(', ')})`,
    };
  });
}
