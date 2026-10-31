import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../app.routes';

describe('Shared game viewport', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter(routes)] });
  });

  it('keeps the launched viewport mounted through both chapters and the game', async () => {
    const harness = await RouterTestingHarness.create('/blueprint-water');
    await harness.fixture.whenStable();
    const viewport = harness.routeNativeElement!.querySelector('app-landscape-viewport')!;
    viewport.querySelector<HTMLButtonElement>('.fullscreen-toggle')!.click();
    await harness.fixture.whenStable();
    expect(viewport.querySelector('.rotate-prompt')).toBeNull();

    for (const path of ['/chapter-2', '/game', '/blueprint-water']) {
      await TestBed.inject(Router).navigateByUrl(path);
      harness.detectChanges();
      await harness.fixture.whenStable();
      expect(harness.routeNativeElement!.querySelector('app-landscape-viewport')).toBe(viewport);
      expect(viewport.isConnected).toBe(true);
      expect(viewport.querySelector('.rotate-prompt')).toBeNull();
      expect(viewport.querySelectorAll('app-landscape-viewport')).toHaveLength(0);
    }
  });

  it('does not wrap the playground or home in the launcher', async () => {
    const harness = await RouterTestingHarness.create('/dev/status-bar');
    expect(harness.routeNativeElement!.querySelector('app-landscape-viewport')).toBeNull();
    expect(harness.routeNativeElement!.querySelector('#health')).not.toBeNull();
    await harness.navigateByUrl('/');
    expect(harness.routeNativeElement!.querySelector('app-landscape-viewport')).toBeNull();
  });
});
