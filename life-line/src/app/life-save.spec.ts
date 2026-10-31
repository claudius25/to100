import { TestBed } from '@angular/core/testing';
import { GameEngine } from './simulation/model/game-engine';
import { MALE_NAMES } from './chapter-one/chapter.constants';
import { LIFE_SAVE_KEY, LifeSaveStore, readLifeSave, type LifeSave } from './life-save';

describe('LifeSaveStore', () => {
  beforeEach(() => {
    localStorage.removeItem(LIFE_SAVE_KEY);
    TestBed.configureTestingModule({});
  });

  afterEach(() => vi.restoreAllMocks());

  it('starts a new life and loads it from localStorage in a fresh store', () => {
    const store = TestBed.inject(LifeSaveStore);
    expect(store.savedLife()).toBeNull();
    expect(store.startNewLife()).toBe(true);
    const fresh = TestBed.runInInjectionContext(() => new LifeSaveStore());
    expect(fresh.savedLife()).toEqual(store.savedLife());
    expect(fresh.savedLife()?.route).toBe('/chapter-1');
  });

  it('loads legacy blueprint saves as Chapter 1 without losing progress', () => {
    const chapter = {
      tap: 3,
      name: MALE_NAMES[0].toUpperCase(),
      levels: [2],
      closingText: '',
    };
    localStorage.setItem(
      LIFE_SAVE_KEY,
      JSON.stringify({ version: 1, route: '/blueprint-water', chapter }),
    );
    const store = TestBed.inject(LifeSaveStore);
    const migrated = { version: 1, route: '/chapter-1', chapter };
    expect(store.savedLife()).toEqual(migrated);
    expect(store.error()).toBe('');
    expect(store.write(store.savedLife()!)).toBe(true);
    expect(JSON.parse(localStorage.getItem(LIFE_SAVE_KEY)!)).toEqual(migrated);
  });

  it('saves and reloads an unresolved game encounter', () => {
    const engine = new GameEngine(() => 0);
    const board = engine.getState().upcomingSteps;
    engine.rollTurn();
    const save: LifeSave = {
      version: 1,
      route: '/game',
      origin: null,
      game: engine.getState(),
      pendingEncounter: true,
      board,
    };
    const store = TestBed.inject(LifeSaveStore);
    expect(store.write(save)).toBe(true);
    const fresh = TestBed.runInInjectionContext(() => new LifeSaveStore());
    expect(fresh.savedLife()).toEqual(save);
    save.game.hero.resources.money = 999;
    expect(fresh.savedLife()).not.toEqual(save);
  });

  it('reports malformed or unsupported saves instead of crashing the launcher', () => {
    localStorage.setItem(LIFE_SAVE_KEY, '{"version":99}');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const store = TestBed.inject(LifeSaveStore);
    expect(store.savedLife()).toBeNull();
    expect(store.error()).toContain('could not be loaded');
    expect(store.startNewLife()).toBe(true);
    expect(store.error()).toBe('');
  });

  it('reports storage failures and retains the last successfully saved life', () => {
    const store = TestBed.inject(LifeSaveStore);
    store.startNewLife();
    const before = store.savedLife();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(store.write({ version: 1, route: '/chapter-2', origin: null })).toBe(false);
    expect(store.error()).toContain('could not be saved');
    expect(store.savedLife()).toEqual(before);
  });

  it('rejects invalid routes, blueprint data, and encounter data', () => {
    expect(() => readLifeSave({ version: 1, route: '/elsewhere' })).toThrow();
    expect(() => readLifeSave({ version: 1, route: '/chapter-1', chapter: { tap: 7 } })).toThrow();
    expect(() =>
      readLifeSave({ version: 1, route: '/blueprint-water', chapter: { tap: 7 } }),
    ).toThrow();
    expect(() =>
      readLifeSave({
        version: 1,
        route: '/game',
        origin: null,
        game: new GameEngine(() => 0).getState(),
        board: [],
        pendingEncounter: true,
      }),
    ).toThrow();
  });
});
