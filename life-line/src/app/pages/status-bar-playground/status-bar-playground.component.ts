import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import {
  DISPOSITION_NAMES,
  Disposition,
  formatStatusMoney,
  StatusBarComponent,
} from '../../components/status-bar/status-bar.component';

@Component({
  selector: 'app-status-bar-playground',
  imports: [StatusBarComponent],
  templateUrl: './status-bar-playground.component.html',
  styleUrl: './status-bar-playground.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatusBarPlaygroundComponent {
  readonly health = signal(80);
  readonly disposition = signal<Disposition>(4);
  readonly age = signal(50);
  readonly money = signal(1_800_000);
  /** 0 means "auto": the component fills its parent. */
  readonly width = signal(0);
  readonly height = signal(64);
  readonly aspect = computed(() =>
    this.width() > 0 ? `${(this.width() / this.height()).toFixed(1)} : 1` : 'auto width',
  );
  readonly darkBackground = signal(false);
  readonly expressionName = computed(() => DISPOSITION_NAMES[this.disposition()]);
  readonly abbreviatedMoney = computed(() => formatStatusMoney(this.money()));
  readonly rawMoney = computed(() => this.money().toLocaleString('en-US'));
  readonly presets: ReadonlyArray<{
    name: string;
    health: number;
    disposition: Disposition;
    age: number;
    money: number;
  }> = [
    { name: 'Childhood', health: 95, disposition: 4, age: 8, money: 150 },
    { name: 'Young adult', health: 75, disposition: 3, age: 25, money: 12_500 },
    { name: 'Midlife', health: 45, disposition: 2, age: 50, money: 125_000 },
    { name: 'Old age', health: 20, disposition: 1, age: 85, money: 1_800_000 },
  ];

  protected update(
    control: 'health' | 'disposition' | 'age' | 'money' | 'width' | 'height',
    event: Event,
  ): void {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || !Number.isFinite(input.valueAsNumber)) return;
    const value = Math.round(input.valueAsNumber);
    if (control === 'disposition') {
      if (value === 1 || value === 2 || value === 3 || value === 4) this.disposition.set(value);
    } else {
      const [min, max] = CONTROL_RANGES[control];
      this[control].set(Math.max(min, Math.min(max, value)));
    }
  }
}

const CONTROL_RANGES = {
  health: [0, 100],
  age: [0, 100],
  money: [0, 10_000_000],
  width: [0, 1120],
  height: [24, 120],
} as const;
