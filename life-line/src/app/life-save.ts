import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { Router, type CanActivateChildFn } from '@angular/router';
import {
  readChapterProgress,
  type ChapterProgress,
  type WaterBlueprintResult,
} from './chapter-one/blueprint-chapter';
import { readBlueprintChapter } from './chapter-one/hero-blueprint';
import { isRecord, isStep, readGameState } from './simulation/model/game-state';
import type { GameState } from './simulation/model/types';
import type { Step } from './simulation/model/step';

export const LIFE_SAVE_KEY = 'to100.life.v1';

export const savedLifeGuard: CanActivateChildFn = (route) => {
  const path = route.routeConfig?.path;
  if (!path) return true;
  const store = inject(LifeSaveStore);
  const router = inject(Router);
  const saved = store.savedLife();
  if (!saved) return store.error() ? router.parseUrl('/') : true;
  if (saved.route === `/${path}`) return true;
  if (
    path === 'game' &&
    (router.url.split(/[?#]/)[0] === '/chapter-2' ||
      readBlueprintChapter(router.currentNavigation()?.extras.state) !== null)
  )
    return true;
  // A bookmark or old history entry must not overwrite a newer life checkpoint.
  return router.parseUrl('/');
};

export type LifeSave = { version: 1 } & (
  | { route: '/chapter-1'; chapter: ChapterProgress }
  | { route: '/chapter-2'; origin: WaterBlueprintResult | null }
  | {
      route: '/game';
      origin: WaterBlueprintResult | null;
      game: GameState;
      pendingEncounter: boolean;
      board: Step[];
    }
);

export function readLifeSave(value: unknown): LifeSave {
  if (!isRecord(value) || value['version'] !== 1) throw new Error('Unsupported life save format.');
  if (value['route'] === '/chapter-1' || value['route'] === '/blueprint-water')
    return { version: 1, route: '/chapter-1', chapter: readChapterProgress(value['chapter']) };
  if (value['route'] !== '/chapter-2' && value['route'] !== '/game')
    throw new Error('Invalid saved life route.');
  const origin =
    value['origin'] === null ? null : readBlueprintChapter({ blueprintChapter: value['origin'] });
  if (value['route'] === '/chapter-2') return { version: 1, route: value['route'], origin };
  const game = readGameState(value['game']);
  if (
    typeof value['pendingEncounter'] !== 'boolean' ||
    !Array.isArray(value['board']) ||
    !value['board'].every(isStep) ||
    value['board'].length !== (value['pendingEncounter'] || game.status === 'playing' ? 12 : 0) ||
    (value['pendingEncounter'] && game.history.length === 0)
  )
    throw new Error('Invalid saved encounter display.');
  return {
    version: 1,
    route: '/game',
    origin,
    game,
    pendingEncounter: value['pendingEncounter'],
    board: structuredClone(value['board']),
  };
}

@Injectable({ providedIn: 'root' })
export class LifeSaveStore {
  private readonly document = inject(DOCUMENT);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly current = signal<LifeSave | null>(null);
  readonly savedLife = this.current.asReadonly();
  readonly error = signal('');

  constructor() {
    if (!this.browser) return;
    try {
      const text = this.document.defaultView!.localStorage.getItem(LIFE_SAVE_KEY);
      if (text !== null) this.current.set(readLifeSave(JSON.parse(text)));
    } catch (error) {
      console.error('Could not load the saved TO100 life.', error);
      this.error.set('Your saved life could not be loaded. New life will replace it.');
    }
  }

  write(save: LifeSave): boolean {
    if (!this.browser) return false;
    const validated = readLifeSave(save);
    try {
      this.document.defaultView!.localStorage.setItem(LIFE_SAVE_KEY, JSON.stringify(validated));
      this.current.set(validated);
      this.error.set('');
      return true;
    } catch (error) {
      console.error('Could not save the TO100 life.', error);
      this.error.set(
        'Progress could not be saved. Check browser storage before leaving this page.',
      );
      return false;
    }
  }

  startNewLife(): boolean {
    return this.write({
      version: 1,
      route: '/chapter-1',
      chapter: { tap: 0, name: '', levels: [], closingText: '' },
    });
  }
}
