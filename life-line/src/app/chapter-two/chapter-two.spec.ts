import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { MALE_NAMES } from '../blueprint-water/chapter.constants';
import { routes } from '../app.routes';
import { CHAPTER_TWO_STATUS_BAR, ChapterTwoPage, moodToDisposition } from './chapter-two';

describe('moodToDisposition', () => {
  it.each([
    [0, 1],
    [24, 1],
    [25, 2],
    [50, 3],
    [75, 4],
    [100, 4],
  ])('maps mood %s to %s', (mood, expected) => {
    expect(moodToDisposition(mood)).toBe(expected);
  });
});

describe('ChapterTwoPage', () => {
  const chapter = {
    name: MALE_NAMES[0].toUpperCase(),
    blueprint: { healthBlueprint: 2, familyFinances: 3, emotionalResilience: 4, socialSkills: 1 },
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter(routes)] });
  });

  it('shows the configured hero status bar and passes the blueprint on to the game', async () => {
    const harness = await RouterTestingHarness.create();
    await TestBed.inject(Router).navigateByUrl('/chapter-2', {
      state: { blueprintChapter: chapter },
    });
    harness.detectChanges();
    const root = harness.routeNativeElement!;
    expect(
      harness.routeDebugElement?.query(By.directive(ChapterTwoPage)).componentInstance,
    ).toBeInstanceOf(ChapterTwoPage);
    const bar = root.querySelector<HTMLElement>('app-status-bar')!;
    expect(bar.style.width).toBe(`${CHAPTER_TWO_STATUS_BAR.width}px`);
    expect(bar.style.getPropertyValue('--status-bar-track-height')).toBe(
      `${CHAPTER_TWO_STATUS_BAR.height}px`,
    );
    expect(root.querySelector('h1')?.textContent?.trim()).toBe(chapter.name);
    expect(root.querySelector('.status-bar')?.getAttribute('aria-label')).toBe(
      'Health 100 of 100. Happy. Age 0 years. Money 0.',
    );

    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    root.querySelector<HTMLButtonElement>('.continue')!.click();
    await harness.fixture.whenStable();
    expect(navigate).toHaveBeenCalledWith('/game', { state: { blueprintChapter: chapter } });
  });
});
