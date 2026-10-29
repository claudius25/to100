import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { BlueprintTower } from './blueprint-tower/blueprint-tower';
import {
  BLUEPRINT_TRAITS,
  rollLevel,
  toBlueprintResult,
  traitResult,
  type BlueprintResult,
} from './model/starting-blueprint';
import { StartingBlueprintPage } from './starting-blueprint';

describe('starting blueprint model', () => {
  it('samples levels 1-4 with equal-width buckets', () => {
    expect([0, 0.2499, 0.25, 0.5, 0.75, 0.9999].map((value) => rollLevel(() => value))).toEqual([
      1, 1, 2, 3, 4, 4,
    ]);
    expect(rollLevel(() => 1)).toBe(4);
  });

  it('produces every level from the default random source', () => {
    const seen = new Set(Array.from({ length: 400 }, () => rollLevel()));
    expect([...seen].sort()).toEqual([1, 2, 3, 4]);
  });

  it('builds a blueprint only from one result per trait', () => {
    const results = BLUEPRINT_TRAITS.map((_, index) => traitResult(index, 2));
    expect(toBlueprintResult(results)).toEqual({
      healthBlueprint: 2,
      familyFinances: 2,
      emotionalResilience: 2,
      socialSkills: 2,
    });
    expect(toBlueprintResult(results.slice(0, 3))).toBeNull();
  });
});

describe('StartingBlueprintPage', () => {
  const blueprint: BlueprintResult = {
    healthBlueprint: 3,
    familyFinances: 1,
    emotionalResilience: 4,
    socialSkills: 2,
  };

  it('receives the completed tower result and begins life once', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(StartingBlueprintPage);
    const begun: BlueprintResult[] = [];
    fixture.componentInstance.beginLife.subscribe((result) => begun.push(result));
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const tower = fixture.debugElement.query(By.directive(BlueprintTower))
      .componentInstance as BlueprintTower;

    expect(element.querySelector('h1')?.textContent).toContain('Your blueprint.');
    expect(element.querySelector('.blueprint__begin')).toBeNull();

    tower.blueprintCompleted.emit(blueprint);
    await fixture.whenStable();
    const begin = element.querySelector<HTMLButtonElement>('.blueprint__begin')!;
    begin.click();
    begin.click();
    await fixture.whenStable();

    expect(begun).toEqual([blueprint]);
    expect(element.textContent).toContain('Blueprint locked in');

    tower.restarted.emit();
    await fixture.whenStable();
    expect(element.querySelector('.blueprint__begin')).toBeNull();
  });
});
