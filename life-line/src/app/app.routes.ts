import { isDevMode } from '@angular/core';
import { Routes } from '@angular/router';
import { savedLifeGuard } from './life-save';

export const routes: Routes = [
  {
    path: 'character-lab',
    title: 'Life Line — Character Lab',
    loadComponent: () => import('./character-lab/character-lab').then((m) => m.CharacterLab),
  },
  {
    path: '',
    loadComponent: () => import('./landscape-viewport/game-viewport').then((m) => m.GameViewport),
    canActivateChild: [savedLifeGuard],
    children: [
      {
        path: '',
        pathMatch: 'full',
        title: 'TO100',
        loadComponent: () =>
          import('./landscape-viewport/game-viewport').then((m) => m.LifeLauncher),
      },
      {
        path: 'blueprint-water',
        pathMatch: 'full',
        redirectTo: 'chapter-1',
      },
      {
        path: 'chapter-1',
        title: 'TO100 — Chapter 1',
        loadComponent: () => import('./chapter-one/chapter-one').then((m) => m.ChapterOnePage),
      },
      {
        path: 'chapter-2',
        title: 'TO100 — Chapter 2',
        loadComponent: () => import('./chapter-two/chapter-two').then((m) => m.ChapterTwoPage),
      },
      {
        path: 'game',
        title: 'TO100 - Game',
        loadComponent: () => import('./game/game').then((m) => m.GamePage),
      },
    ],
  },
  {
    path: 'starting-blueprint',
    title: 'Life Line — Your Starting Blueprint',
    loadComponent: () =>
      import('./starting-blueprint/starting-blueprint').then((m) => m.StartingBlueprintPage),
  },
  {
    path: 'dev/status-bar',
    title: 'TO100 - Status Bar Playground',
    loadComponent: () =>
      import('./pages/status-bar-playground/status-bar-playground.component').then(
        (m) => m.StatusBarPlaygroundComponent,
      ),
  },
  ...(isDevMode()
    ? [
        {
          path: 'simulation',
          title: 'TO100 - Simulation',
          loadComponent: () => import('./simulation/simulation').then((m) => m.SimulationPage),
        },
      ]
    : []),
  { path: '**', redirectTo: '' },
];
