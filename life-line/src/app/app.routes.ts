import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    title: 'Life Line',
    loadComponent: () => import('./home/home').then((m) => m.Home),
  },
  {
    path: 'character-lab',
    title: 'Life Line — Character Lab',
    loadComponent: () => import('./character-lab/character-lab').then((m) => m.CharacterLab),
  },
  { path: '**', redirectTo: '' },
];
