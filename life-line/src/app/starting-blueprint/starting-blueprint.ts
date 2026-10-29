import { ChangeDetectionStrategy, Component, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BlueprintTower } from './blueprint-tower/blueprint-tower';
import type { BlueprintResult } from './model/starting-blueprint';

@Component({
  selector: 'app-starting-blueprint',
  imports: [RouterLink, BlueprintTower],
  templateUrl: './starting-blueprint.html',
  styleUrl: './starting-blueprint.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StartingBlueprintPage {
  /**
   * There is no game-state store yet, so the completed 1-4 blueprint is passed
   * on as a typed event. It is intentionally not converted to the simulation
   * Hero's 0-100 blueprint scale; that adapter has not been designed.
   */
  readonly beginLife = output<BlueprintResult>();

  protected readonly result = signal<BlueprintResult | null>(null);
  protected readonly started = signal(false);

  /** Parent receives the completed tower result here. */
  protected onBlueprintCompleted(result: BlueprintResult): void {
    this.result.set({ ...result });
    this.started.set(false);
  }

  protected onRestarted(): void {
    this.result.set(null);
    this.started.set(false);
  }

  protected begin(): void {
    const result = this.result();
    if (!result || this.started()) {
      return;
    }
    this.started.set(true);
    this.beginLife.emit({ ...result });
  }
}
