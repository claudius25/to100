import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DIE_FACES, describeTrait, type TraitCardConfig } from '../model/starting-blueprint';

@Component({
  selector: 'app-trait-card',
  templateUrl: './trait-card.html',
  styleUrl: './trait-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'trait-card-host',
    '[style.--accent]': 'config().accent',
  },
})
export class TraitCard {
  readonly config = input.required<TraitCardConfig>();
  /** Final result, a tumbling value while rolling, or null when unrolled. */
  readonly value = input<number | null>(null);
  /** True while this card is still tumbling, so the value is not final. */
  readonly tumbling = input(false);

  protected readonly pips = Array.from({ length: DIE_FACES }, (_, index) => index);
  protected readonly faces = DIE_FACES;

  protected readonly displayValue = computed(() => this.value() ?? '—');

  /** Pips only light up for a settled result, never mid-animation. */
  protected readonly filled = computed(() => (this.tumbling() ? 0 : (this.value() ?? 0)));

  protected readonly accessibleResult = computed(() =>
    this.tumbling()
      ? `${this.config().label}: rolling`
      : describeTrait(this.config().label, this.value()),
  );
}
