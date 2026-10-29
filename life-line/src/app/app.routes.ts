import { isDevMode } from '@angular/core';
import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    title: 'Life Line',
    loadComponent: () => import('./home/home').then((m) => m.Home),
  },
  {
    path: 'game',
    title: 'TO100 - Game',
    loadComponent: () => import('./game/game').then((m) => m.GamePage),
  },
  {
    path: 'character-lab',
    title: 'Life Line — Character Lab',
    loadComponent: () => import('./character-lab/character-lab').then((m) => m.CharacterLab),
  },
  {
    path: 'blueprint-water',
    title: 'TO100 — Chapter 1',
    loadComponent: () => import('./blueprint-water/blueprint-water').then((m) => m.BlueprintWater),
  },
  {
    path: 'starting-blueprint',
    title: 'Life Line — Your Starting Blueprint',
    loadComponent: () =>
      import('./starting-blueprint/starting-blueprint').then((m) => m.StartingBlueprintPage),
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
