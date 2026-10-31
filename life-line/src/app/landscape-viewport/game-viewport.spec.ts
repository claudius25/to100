import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../app.routes';
import { LIFE_SAVE_KEY, LifeSaveStore } from '../life-save';

describe('Shared game viewport', () => {
  beforeEach(() => {
    localStorage.removeItem(LIFE_SAVE_KEY);
    TestBed.configureTestingModule({ providers: [provideRouter(routes)] });
  });

  it('keeps the launched viewport mounted through both chapters and the game', async () => {
    const harness = await RouterTestingHarness.create('/chapter-1');
    await harness.fixture.whenStable();
    const viewport = harness.routeNativeElement!.querySelector('app-landscape-viewport')!;
    expect(viewport.querySelector('app-chapter-one')).not.toBeNull();
    viewport.querySelector<HTMLButtonElement>('.fullscreen-toggle')!.click();
    await harness.fixture.whenStable();
    expect(viewport.querySelector('.rotate-prompt')).toBeNull();

    for (const path of ['/chapter-2', '/game']) {
      if (path === '/chapter-2')
        TestBed.inject(LifeSaveStore).write({ version: 1, route: '/chapter-2', origin: null });
      await TestBed.inject(Router).navigateByUrl(path);
      harness.detectChanges();
      await harness.fixture.whenStable();
      expect(harness.routeNativeElement!.querySelector('app-landscape-viewport')).toBe(viewport);
      expect(viewport.isConnected).toBe(true);
      expect(viewport.querySelector('.rotate-prompt')).toBeNull();
      expect(viewport.querySelectorAll('app-landscape-viewport')).toHaveLength(0);
    }
  });

  it('keeps the playground separate and replaces home with the launcher', async () => {
    const harness = await RouterTestingHarness.create('/dev/status-bar');
    expect(harness.routeNativeElement!.querySelector('app-landscape-viewport')).toBeNull();
    expect(harness.routeNativeElement!.querySelector('#health')).not.toBeNull();
    await harness.navigateByUrl('/');
    expect(harness.routeNativeElement!.querySelector('app-landscape-viewport')).not.toBeNull();
    expect(harness.routeNativeElement!.querySelector('.continue-life')).toBeNull();
  });

  it('starts Chapter 1 from Play and replaces saved progress from NEW LIFE', async () => {
    const harness = await RouterTestingHarness.create('/');
    await harness.fixture.whenStable();
    const viewport = harness.routeNativeElement!.querySelector('app-landscape-viewport')!;
    const start = () => viewport.querySelector<HTMLButtonElement>('.fullscreen-toggle')!.click();
    start();
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/chapter-1');
    const store = TestBed.inject(LifeSaveStore);
    store.write({ version: 1, route: '/chapter-2', origin: null });
    await harness.navigateByUrl('/');
    expect(viewport.querySelector('.fullscreen-toggle')!.textContent).toContain('NEW LIFE');
    expect(viewport.querySelector<HTMLButtonElement>('.continue-life')!.disabled).toBe(false);
    start();
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/chapter-1');
    expect(store.savedLife()).toEqual({
      version: 1,
      route: '/chapter-1',
      chapter: { tap: 0, name: '', levels: [], closingText: '' },
    });
  });

  it('continues a saved chapter and protects it against unrelated direct game links', async () => {
    const store = TestBed.inject(LifeSaveStore);
    store.write({
      version: 1,
      route: '/chapter-1',
      chapter: { tap: 1, name: '', levels: [], closingText: '' },
    });
    const harness = await RouterTestingHarness.create('/game');
    expect(TestBed.inject(Router).url).toBe('/');
    harness.routeNativeElement!.querySelector<HTMLButtonElement>('.continue-life')!.click();
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/chapter-1');
    expect(store.savedLife()?.route).toBe('/chapter-1');
    const save = store.savedLife();
    if (save?.route !== '/chapter-1') throw new Error('The chapter must remain saved.');
    expect(save.chapter.tap).toBe(1);
    expect(harness.routeNativeElement!.querySelectorAll('.preview__row')).toHaveLength(1);
  });

  it('redirects old blueprint links and restores legacy Chapter 1 progress', async () => {
    const chapter = { tap: 1, name: '', levels: [], closingText: '' };
    localStorage.setItem(
      LIFE_SAVE_KEY,
      JSON.stringify({ version: 1, route: '/blueprint-water', chapter }),
    );
    const harness = await RouterTestingHarness.create('/blueprint-water');
    await harness.fixture.whenStable();

    expect(TestBed.inject(Router).url).toBe('/chapter-1');
    expect(TestBed.inject(LifeSaveStore).savedLife()).toEqual({
      version: 1,
      route: '/chapter-1',
      chapter,
    });
    expect(JSON.parse(localStorage.getItem(LIFE_SAVE_KEY)!)).toEqual({
      version: 1,
      route: '/chapter-1',
      chapter,
    });
    expect(harness.routeNativeElement!.querySelector('app-chapter-one')).not.toBeNull();
    expect(harness.routeNativeElement!.querySelectorAll('.preview__row')).toHaveLength(1);
  });

  it('does not overwrite a later save when an old blueprint link is opened', async () => {
    const store = TestBed.inject(LifeSaveStore);
    const saved = { version: 1, route: '/chapter-2', origin: null } as const;
    store.write(saved);
    const harness = await RouterTestingHarness.create('/blueprint-water');
    await harness.fixture.whenStable();

    expect(TestBed.inject(Router).url).toBe('/');
    expect(store.savedLife()).toEqual(saved);
    expect(harness.routeNativeElement!.querySelector('.continue-life')).not.toBeNull();
  });
});
