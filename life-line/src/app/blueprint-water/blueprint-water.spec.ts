import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../app.routes';
import { BlueprintWater } from './blueprint-water';
import type { GameState } from '../simulation/model/types';
import {
  CHAPTER_TEXT,
  CHAPTER_TRAITS,
  CHAPTER_VIEW,
  CHAPTER_VIEW_SLIDERS,
  MALE_NAMES,
  type ChapterTimings,
} from './chapter.constants';
import { ReliefScene } from './relief-scene';

async function waitReady(fixture: ComponentFixture<BlueprintWater>): Promise<void> {
  for (let i = 0; i < 100; i++) {
    await fixture.whenStable();
    if (!fixture.nativeElement.querySelector('.scene--busy')) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error('Chapter did not finish animating.');
}

async function createChapter(timings: Partial<ChapterTimings> = {}, debug = false) {
  const fixture = TestBed.createComponent(BlueprintWater);
  fixture.componentRef.setInput('random', () => 0);
  fixture.componentRef.setInput('timings', {
    pressMs: 5,
    settleMs: 0,
    ...timings,
  });
  await fixture.whenStable();
  if (debug) {
    fixture.nativeElement.querySelector('.dev-toggle').click();
    await fixture.whenStable();
  }
  return fixture;
}

describe('BlueprintWater', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter(routes)] });
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('requires pressing the raised label and recesses its value while the next label rises', async () => {
    const fixture = await createChapter({ pressMs: 50 });
    const root = fixture.nativeElement as HTMLElement;
    const scene = root.querySelector<HTMLButtonElement>('.scene')!;
    scene.click();
    await waitReady(fixture);
    expect(root.querySelector('.preview__raised')?.textContent?.trim()).toBe(
      CHAPTER_TEXT.nameLabel,
    );
    expect(root.querySelector('.preview__liquid')).toBeNull();
    for (const [index, label] of [
      CHAPTER_TEXT.nameLabel,
      ...CHAPTER_TRAITS.map((t) => t.label),
    ].entries()) {
      // Pointer taps elsewhere must not activate a raised button.
      scene.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
      await fixture.whenStable();
      expect(scene.disabled).toBe(false);
      const raised = root.querySelector<HTMLElement>('[data-pressable="true"]')!;
      expect(raised.textContent?.trim()).toBe(label);
      raised.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
      await fixture.whenStable();
      const row = root.querySelectorAll('.preview__row')[index];
      expect(row.querySelector('.preview__label--pressing')).not.toBeNull();
      expect(row.querySelector('.preview__value')?.textContent?.trim()).not.toBe('');
      expect(scene.disabled).toBe(true);
      expect(root.querySelector('[data-pressable="true"]')?.textContent?.trim() ?? null).toBe(
        CHAPTER_TRAITS[index]?.label ?? null,
      );
      await waitReady(fixture);
    }
    expect(root.querySelector('.begin')).not.toBeNull();
    expect(root.querySelectorAll('.preview__raised')).toHaveLength(5);
    expect(root.querySelector('.preview__closing textPath')?.textContent?.trim()).not.toBe('');
    expect(root.querySelectorAll('.preview__closing')).toHaveLength(1);
    expect(root.querySelector('#chapter-closing-path')?.getAttribute('d')).toContain(' A ');
    expect(root.querySelector('.chapter')?.getAttribute('style')).toContain(
      '--appearance-duration',
    );
  });

  it('cancels an active reveal on reset and destruction', async () => {
    const fixture = await createChapter({ pressMs: 100 }, true);
    const root = fixture.nativeElement as HTMLElement;
    const scene = root.querySelector<HTMLButtonElement>('.scene')!;
    scene.click();
    await new Promise((resolve) => setTimeout(resolve, 30));
    root.querySelector<HTMLButtonElement>('.reset')!.click();
    await new Promise((resolve) => setTimeout(resolve, 130));
    await fixture.whenStable();
    expect(root.querySelectorAll('.preview__row')).toHaveLength(0);
    expect(scene.disabled).toBe(false);
    scene.click();
    await new Promise((resolve) => setTimeout(resolve, 30));
    const cancelTimer = vi.spyOn(globalThis, 'clearTimeout');
    fixture.destroy();
    expect(cancelTimer).toHaveBeenCalled();
    await new Promise((resolve) => setTimeout(resolve, 130));
  });

  it('wires development sliders and projection/reset buttons to the 3D scene', async () => {
    vi.stubGlobal('WebGL2RenderingContext', class {});
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        disconnect() {}
      },
    );
    vi.spyOn(ReliefScene.prototype, 'init').mockResolvedValue();
    vi.spyOn(ReliefScene.prototype, 'dispose').mockImplementation(() => {});
    const setView = vi.spyOn(ReliefScene.prototype, 'setView');
    const fixture = await createChapter({}, true);
    const root = fixture.nativeElement as HTMLElement;
    const panel = root.querySelector<HTMLDetailsElement>('.scene-controls')!;
    expect(panel).not.toBeNull();
    expect(panel.querySelectorAll('input[type="range"]')).toHaveLength(CHAPTER_VIEW_SLIDERS.length);
    const projection = panel.querySelector<HTMLButtonElement>('button[aria-pressed]')!;
    projection.click();
    await fixture.whenStable();
    expect(projection.getAttribute('aria-pressed')).toBe(String(!CHAPTER_VIEW.orthographic));
    expect(setView).toHaveBeenLastCalledWith({
      ...CHAPTER_VIEW,
      orthographic: !CHAPTER_VIEW.orthographic,
    });
    for (const slider of panel.querySelectorAll<HTMLInputElement>('input[type="range"]')) {
      slider.value = slider.dataset['setting'] === 'zoom' ? '2' : '1';
      slider.dispatchEvent(new Event('input'));
      expect(
        setView.mock.lastCall?.[0][slider.dataset['setting'] as keyof typeof CHAPTER_VIEW],
      ).toBe(Number(slider.value));
    }
    [...panel.querySelectorAll<HTMLButtonElement>('button')]
      .find((button) => button.textContent?.includes('Reset camera'))!
      .click();
    expect(setView).toHaveBeenLastCalledWith(CHAPTER_VIEW);
    fixture.destroy();
  });

  it('starts blank and supports the full six-tap flow using the accessible scene button', async () => {
    const fixture = await createChapter();
    const root = fixture.nativeElement as HTMLElement;
    const scene = root.querySelector<HTMLButtonElement>('.scene')!;
    const completed = vi.fn();
    fixture.componentInstance.blueprintCompleted.subscribe(completed);
    expect(root.querySelectorAll('.preview__row')).toHaveLength(0);
    expect(
      root.querySelector('header, .hint, .reset, .scene-controls, .frame-stats, .debug'),
    ).toBeNull();
    expect(root.querySelector('.begin')).toBeNull();
    expect(root.querySelector('[role="status"]:last-child')?.textContent).toContain('2D preview');
    expect(scene.getAttribute('aria-label')).toBe(CHAPTER_TEXT.hints[0]);
    scene.click();
    scene.click();
    await waitReady(fixture);
    expect(root.querySelectorAll('.preview__row')).toHaveLength(1);
    expect(root.querySelector('.preview__value')?.textContent?.trim()).toBe('');
    expect(completed).not.toHaveBeenCalled();
    for (let i = 0; i < 5; i++) {
      scene.click();
      await waitReady(fixture);
    }
    expect(root.querySelectorAll('.preview__row')).toHaveLength(5);
    expect(scene.disabled).toBe(true);
    expect(root.querySelector('[role="status"]')?.textContent).toContain(
      `${CHAPTER_TEXT.nameLabel} ${MALE_NAMES[0].toUpperCase()}`,
    );
    expect(root.querySelector('.begin')).not.toBeNull();
    expect(completed).toHaveBeenCalledTimes(1);
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    root.querySelector<HTMLButtonElement>('.begin')!.click();
    await fixture.whenStable();
    expect(navigate).toHaveBeenCalledWith('/game', {
      state: {
        blueprintChapter: {
          name: MALE_NAMES[0].toUpperCase(),
          blueprint: {
            healthBlueprint: 1,
            familyFinances: 1,
            emotionalResilience: 1,
            socialSkills: 1,
          },
        },
      },
    });
  });

  it('resets mid-animation and cancels work when destroyed', async () => {
    const fixture = await createChapter({}, true);
    const root = fixture.nativeElement as HTMLElement;
    const completed = vi.fn();
    fixture.componentInstance.blueprintCompleted.subscribe(completed);
    root.querySelector<HTMLButtonElement>('.scene')!.click();
    root.querySelector<HTMLButtonElement>('.reset')!.click();
    await waitReady(fixture);
    expect(root.querySelectorAll('.preview__row')).toHaveLength(0);
    expect(root.querySelector('.scene')?.getAttribute('aria-label')).toBe(CHAPTER_TEXT.hints[0]);
    root.querySelector<HTMLButtonElement>('.scene')!.click();
    fixture.destroy();
    await new Promise((resolve) => setTimeout(resolve, 15));
    expect(completed).not.toHaveBeenCalled();
  });

  it('navigates to the new route, hands the blueprint to GameEngine, and preserves it on reset', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/blueprint-water', BlueprintWater);
    expect(harness.routeNativeElement?.querySelector('.scene')).not.toBeNull();
    expect(harness.routeNativeElement?.querySelector('header')).toBeNull();
    await TestBed.inject(Router).navigateByUrl('/game', {
      state: {
        blueprintChapter: {
          name: 'Max',
          blueprint: {
            healthBlueprint: 4,
            familyFinances: 3,
            emotionalResilience: 2,
            socialSkills: 1,
          },
        },
      },
    });
    harness.detectChanges();
    const root = harness.routeNativeElement!;
    const state = () => JSON.parse(root.querySelector('.debug pre')!.textContent!) as GameState;
    expect(state().hero.name).toBe('Max');
    expect(state().hero.blueprint).toEqual({
      physicalResilience: 100,
      familyFinances: 75,
      emotionalResilience: 50,
      socialSkills: 25,
    });
    expect(state().hero.chapters[0].number).toBe(1);
    // This test does not open a dialog; jsdom still needs close() for the reset handler.
    const dialog = root.querySelector('dialog')!;
    dialog.close = vi.fn();
    root.querySelector<HTMLButtonElement>('.scene-footer button')!.click();
    harness.detectChanges();
    expect(state().hero.name).toBe('Max');
    expect(state().hero.blueprint.physicalResilience).toBe(100);
    expect(state().history).toEqual([]);
    expect(state().hero.chapters).toHaveLength(1);
  });
});
