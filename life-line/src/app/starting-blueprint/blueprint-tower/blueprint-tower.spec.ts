import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { BlueprintResult, TraitResult } from '../model/starting-blueprint';
import { BlueprintTower } from './blueprint-tower';
import type { TowerTimings } from './tower-animation';

const FAST: Partial<TowerTimings> = {
  spinMs: 5,
  settleDelayMs: 5,
  opening: 0.002,
  launch: 0.002,
  flight: 0.002,
  landing: 0.002,
};

async function waitFor(fixture: ComponentFixture<unknown>, check: () => boolean): Promise<void> {
  for (let i = 0; i < 200; i++) {
    await fixture.whenStable();
    if (check()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error('Timed out waiting for tower state');
}

async function createTower(values = [0.9, 0.1, 0.6, 0.3]) {
  const queue = [...values];
  const random = vi.fn(() => queue.shift() ?? 0);
  const fixture = TestBed.createComponent(BlueprintTower);
  const traits: TraitResult[] = [];
  const completed: BlueprintResult[] = [];
  fixture.componentRef.setInput('timings', FAST);
  fixture.componentRef.setInput('random', random);
  fixture.componentInstance.traitDetermined.subscribe((result) => traits.push(result));
  fixture.componentInstance.blueprintCompleted.subscribe((result) => completed.push(result));
  await fixture.whenStable();
  const element = fixture.nativeElement as HTMLElement;
  const button = () => element.querySelector<HTMLButtonElement>('.tower__roll')!;
  const ready = () => !button().disabled;
  return { fixture, element, button, ready, traits, completed, random };
}

describe('BlueprintTower', () => {
  it('uses an accessible fallback when WebGL is unavailable', async () => {
    const { element, button } = await createTower();

    expect(element.querySelector('canvas')).toBeNull();
    expect(element.querySelector('.tower__notice')?.textContent).toContain('3D view unavailable');
    expect(element.querySelectorAll('.fallback__cube')).toHaveLength(1);
    expect(button().textContent?.trim()).toBe('Reveal health blueprint');
  });

  it('completes the blueprint through the button and direct cube presses', async () => {
    const ctx = await createTower();
    const { fixture, element, button } = ctx;

    button().click();
    button().click();
    await fixture.whenStable();
    expect(button().disabled).toBe(true);
    expect(ctx.random).toHaveBeenCalledTimes(1);

    await waitFor(fixture, () => ctx.traits.length === 1 && ctx.ready());
    expect(element.querySelector('[role="status"]')?.textContent).toContain(
      'Health blueprint: Robust, level 4 of 4',
    );
    expect(button().textContent?.trim()).toBe('Reveal family finances');

    element.querySelector<HTMLElement>('[data-cube="0"]')!.click();
    expect(ctx.random).toHaveBeenCalledTimes(1);
    element.querySelector<HTMLElement>('[data-cube="1"]')!.click();
    await waitFor(fixture, () => ctx.traits.length === 2 && ctx.ready());

    button().click();
    await waitFor(fixture, () => ctx.traits.length === 3 && ctx.ready());
    button().click();
    await waitFor(fixture, () => ctx.completed.length === 1);
    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(ctx.traits.map((trait) => trait.level)).toEqual([4, 1, 3, 2]);
    expect(ctx.completed).toEqual([
      { healthBlueprint: 4, familyFinances: 1, emotionalResilience: 3, socialSkills: 2 },
    ]);
    expect(button().textContent?.trim()).toBe('Build a new blueprint');
    expect(element.querySelector('.tower__results')?.textContent).toContain('Warming up');
  });

  it('cancels pending work on reset without emitting stale results', async () => {
    const ctx = await createTower();
    const restarted = vi.fn();
    ctx.fixture.componentInstance.restarted.subscribe(restarted);

    ctx.button().click();
    ctx.element.querySelector<HTMLButtonElement>('.tower__reset')!.click();
    await new Promise((resolve) => setTimeout(resolve, 40));
    await ctx.fixture.whenStable();

    expect(ctx.traits).toHaveLength(0);
    expect(restarted).toHaveBeenCalledTimes(1);
    expect(ctx.button().disabled).toBe(false);
    expect(ctx.element.querySelectorAll('.fallback__cube')).toHaveLength(1);
  });

  it('emits nothing after it is destroyed', async () => {
    const ctx = await createTower();
    ctx.button().click();
    ctx.fixture.destroy();
    await new Promise((resolve) => setTimeout(resolve, 40));

    expect(ctx.traits).toHaveLength(0);
    expect(ctx.completed).toHaveLength(0);
  });
});
