import { JsonPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { GameEngine } from './model/game-engine';

@Component({
  selector: 'app-simulation',
  imports: [JsonPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './simulation.html',
  styleUrl: './simulation.scss',
})
export class SimulationPage {
  private readonly engine = new GameEngine();
  protected readonly state = signal(this.engine.getState());

  protected newGame(): void {
    this.state.set(this.engine.startNewGame());
  }

  protected rollDice(): void {
    this.engine.rollTurn();
    this.state.set(this.engine.getState());
  }
}
