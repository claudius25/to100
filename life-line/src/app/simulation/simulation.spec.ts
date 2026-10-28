import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../app.routes';
import { GameEngine } from './model/game-engine';
import { SimulationPage } from './simulation';

describe('SimulationPage', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SimulationPage],
      providers: [provideRouter(routes)],
    }).compileComponents();
  });

  it('is reachable at /simulation in development', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/simulation', SimulationPage);
    expect(harness.routeNativeElement?.textContent).toContain('TO100 simulation');
  });

  it('creates a hero, rolls through the engine, and resets all visible state', async () => {
    const roll = vi.spyOn(GameEngine.prototype, 'rollTurn');
    try {
      const fixture = TestBed.createComponent(SimulationPage);
      await fixture.whenStable();
      const element = fixture.nativeElement as HTMLElement;
      const buttons = element.querySelectorAll('button');
      expect(element.textContent).toContain('Age: 0 years, 0 weeks');
      expect(element.textContent).toContain('No turns yet.');
      expect(element.querySelector('details summary')?.textContent).toContain('Current state JSON');
      buttons[1].click();
      await fixture.whenStable();
      expect(roll).toHaveBeenCalledOnce();
      expect(element.textContent).toContain('Last turn');
      expect(element.querySelectorAll('ol li')).toHaveLength(1);
      buttons[0].click();
      await fixture.whenStable();
      expect(element.textContent).toContain('Age: 0 years, 0 weeks');
      expect(element.textContent).toContain('No turns yet.');
      expect(element.textContent).toContain('Status: playing');
      expect(buttons[1].disabled).toBe(false);
    } finally {
      roll.mockRestore();
    }
  });

  it('disables rolling on completion and re-enables it after a new game', async () => {
    const completed = new GameEngine(() => 0.999999);
    for (let turn = 0; turn < 434; turn++) {
      completed.rollTurn();
    }
    const initial = vi
      .spyOn(GameEngine.prototype, 'getState')
      .mockReturnValue(completed.getState());
    const fixture = TestBed.createComponent(SimulationPage);
    initial.mockRestore();
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const buttons = element.querySelectorAll('button');
    expect(buttons[1].disabled).toBe(true);
    expect(element.textContent).toContain('Status: completed');
    buttons[0].click();
    await fixture.whenStable();
    expect(buttons[1].disabled).toBe(false);
    expect(element.textContent).toContain('No turns yet.');
  });
});
