import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { LandscapeViewport } from './landscape-viewport';

@Component({
  selector: 'app-game-viewport',
  imports: [LandscapeViewport, RouterOutlet],
  template: '<app-landscape-viewport><router-outlet /></app-landscape-viewport>',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GameViewport {}
