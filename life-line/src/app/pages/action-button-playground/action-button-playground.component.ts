import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import {
  ACTION_BUTTON_ICONS,
  ACTION_BUTTON_LABELS,
  ActionButtonComponent,
  type ActionButtonIcon,
} from '../../components/action-button/action-button.component';

const SIZE_RANGE = [32, 112] as const;

@Component({
  selector: 'app-action-button-playground',
  imports: [ActionButtonComponent],
  templateUrl: './action-button-playground.component.html',
  styleUrl: './action-button-playground.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActionButtonPlaygroundComponent {
  readonly icons = ACTION_BUTTON_ICONS;
  readonly labels = ACTION_BUTTON_LABELS;
  readonly size = signal(56);
  readonly gap = signal(14);
  readonly disabled = signal(false);
  readonly darkBackground = signal(false);
  readonly lastPressed = signal<ActionButtonIcon | null>(null);
  readonly lastPressedLabel = computed(() => {
    const icon = this.lastPressed();
    return icon ? `${this.labels[icon]} (${icon})` : 'Nothing pressed yet';
  });

  protected press(icon: ActionButtonIcon): void {
    this.lastPressed.set(icon);
  }

  protected update(control: 'size' | 'gap', event: Event): void {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || !Number.isFinite(input.valueAsNumber)) return;
    const value = Math.round(input.valueAsNumber);
    const [min, max] = control === 'size' ? SIZE_RANGE : ([0, 48] as const);
    this[control].set(Math.max(min, Math.min(max, value)));
  }
}
