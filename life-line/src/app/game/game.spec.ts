import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../app.routes';
import { GameEngine } from '../simulation/model/game-engine';
import { Home } from '../home/home';
import { GamePage } from './game';

function finishSlide(element: HTMLElement): void {
  const event = new Event('animationend');
  Object.defineProperty(event, 'animationName', { value: 'hero-slide' });
  element.querySelector('.hero')!.dispatchEvent(event);
}

function finishScroll(element: HTMLElement): void {
  const event = new Event('animationend');
  Object.defineProperty(event, 'animationName', { value: 'world-scroll' });
  element.querySelector('.world')!.dispatchEvent(event);
}

function expectRollNumbers(element: HTMLElement): void {
  expect(
    Array.from(element.querySelectorAll('.step-number'), (label) => label.textContent?.trim()),
  ).toEqual(['2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']);
  expect(element.querySelector('.encounter')?.querySelector('.step-number')).toBeNull();
}

describe('GamePage', () => {
  // jsdom does not implement native dialog methods; browser checks cover modal behavior.
  beforeAll(() => {
    Object.defineProperties(HTMLDialogElement.prototype, {
      showModal: {
        configurable: true,
        value: function (this: HTMLDialogElement) {
          this.open = true;
        },
      },
      close: {
        configurable: true,
        value: function (this: HTMLDialogElement) {
          this.open = false;
        },
      },
    });
  });

  afterAll(() => {
    Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
    Reflect.deleteProperty(HTMLDialogElement.prototype, 'close');
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GamePage, Home],
      providers: [provideRouter(routes)],
    }).compileComponents();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('is linked from home and reachable at /game', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/', Home);
    expect(harness.routeNativeElement?.querySelector('a[href="/game"]')?.textContent).toContain(
      'Play TO100',
    );
    await harness.navigateByUrl('/game', GamePage);
    expect(harness.routeNativeElement?.textContent).toContain('TO100');
    const details = harness.routeNativeElement!.querySelector<HTMLDetailsElement>('.game-details')!;
    expect(details.open).toBe(false);
    harness
      .routeNativeElement!.querySelector<HTMLButtonElement>('.scene-footer button:last-child')!
      .click();
    harness.detectChanges();
    expect(details.open).toBe(true);
  });

  it('renders the model, delegates rolls, and keeps JSON and upcoming encounters synchronized', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const roll = vi.spyOn(GameEngine.prototype, 'rollTurn');
    const fixture = TestBed.createComponent(GamePage);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const readState = () => {
      const pre = element.querySelector('.debug pre');
      if (!pre?.textContent) {
        throw new Error('Current state JSON is missing.');
      }
      return JSON.parse(pre.textContent) as ReturnType<GameEngine['getState']>;
    };
    const initial = readState();
    expect(initial.hero.blueprint.familyFinances).toBe(50);
    expect(initial.hero.blueprint.socialSkills).toBe(50);
    expect(initial.hero.resources.money).toBe(0);
    expect(element.querySelectorAll('.encounter')).toHaveLength(12);
    expect(element.querySelector('.encounter--unreachable')?.textContent).toContain('unreachable');
    expect(element.querySelector('.age')?.textContent).toContain('0 years, 0 weeks');
    expectRollNumbers(element);

    const oldBoardId = element.querySelector('.encounter');
    const rollButton = element.querySelector<HTMLButtonElement>('.roll-button')!;
    rollButton.click();
    await fixture.whenStable();
    const next = readState();
    expect(roll).toHaveBeenCalledOnce();
    expect(next.turnNumber).toBe(1);
    expect(next.hero.ageWeeks).toBe(2);
    expect(element.querySelector('.age')?.textContent).toContain('0 years, 2 weeks');
    expect(element.querySelector('.dice')?.textContent).toContain('1 + 1 = 2');
    expect(element.querySelector('.turn')?.textContent).toContain(
      next.history[0].resolvedStep!.title,
    );
    expect(rollButton.disabled).toBe(true);
    rollButton.click();
    expect(roll).toHaveBeenCalledOnce();
    expect(element.querySelector('.hero--sliding')).not.toBeNull();
    expect(
      element.querySelector<HTMLElement>('.hero')!.style.getPropertyValue('--landing-position'),
    ).toBe('21%');
    expect(element.querySelector('.encounter')).toBe(oldBoardId);
    finishSlide(element);
    await fixture.whenStable();
    expect(rollButton.disabled).toBe(true);
    expect(element.querySelector('.hero--sliding')).toBeNull();
    expect(element.querySelector('.hero--landed')).not.toBeNull();
    const dialog = element.querySelector<HTMLDialogElement>('dialog')!;
    expect(dialog.open).toBe(true);
    expect(dialog.textContent).toContain(next.history[0].resolvedStep!.title);
    expect(element.querySelector('.encounter')).toBe(oldBoardId);
    dialog.querySelector('button')!.click();
    await fixture.whenStable();
    expect(dialog.open).toBe(false);
    expect(element.querySelector('.world--scrolling')).not.toBeNull();
    expect(element.querySelectorAll('.encounter')).toHaveLength(14);
    expect(rollButton.disabled).toBe(true);
    finishScroll(element);
    await fixture.whenStable();
    expect(rollButton.disabled).toBe(false);
    expect(element.querySelector('.world--scrolling')).toBeNull();
    expect(element.querySelectorAll('.encounter')).toHaveLength(12);
    expectRollNumbers(element);
    expect(element.querySelector('.encounter')?.getAttribute('data-step-id')).toBe(
      initial.upcomingSteps[2].id,
    );
    expect(next.upcomingSteps.slice(0, 10)).toEqual(initial.upcomingSteps.slice(2));
    expect(element.querySelectorAll('.history li')).toHaveLength(1);
    expect(next.upcomingSteps[0].id).not.toBe(initial.upcomingSteps[0].id);
    expect(element.querySelector('progress')?.value).toBe(2);

    element.querySelector<HTMLButtonElement>('.scene-footer button')!.click();
    await fixture.whenStable();
    const reset = readState();
    expect(reset.hero.ageWeeks).toBe(0);
    expect(reset.turnNumber).toBe(0);
    expect(reset.history).toEqual([]);
    expect(reset.hero.id).not.toBe(initial.hero.id);
    expect(reset.upcomingSteps[0].id).not.toBe(next.upcomingSteps[0].id);
    expect(element.querySelector('.dice')).toBeNull();
    expect(element.querySelector('.history')?.textContent).toContain('No turns yet.');
    expectRollNumbers(element);
  });

  it('renders collectible inventory and inactive blueprint traits from the engine snapshot', async () => {
    const engine = new GameEngine(
      () => 0,
      [
        {
          id: 'memento',
          kind: 'item',
          itemBehavior: 'collectible',
          title: 'A small memento',
          description: 'Kept for later.',
          minAgeWeeks: 0,
          maxAgeWeeks: null,
          weight: 1,
          effects: [{ target: 'money', amount: 25 }],
        },
      ],
    );
    engine.rollTurn();
    vi.spyOn(GameEngine.prototype, 'getState').mockReturnValue(engine.getState());
    const fixture = TestBed.createComponent(GamePage);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('.inventory')?.textContent).toContain('A small memento');
    expect(element.querySelector('.turn')?.textContent).toContain('effects have not been applied');
    expect(element.querySelector('#blueprint-heading')?.parentElement?.textContent).toContain(
      'Family finances',
    );
    expect(element.querySelector('#blueprint-heading')?.parentElement?.textContent).toContain(
      'Social skills',
    );
  });

  it('disables rolling and hides upcoming encounters on completion, then resets', async () => {
    const engine = new GameEngine(() => 0.999999);
    for (let turn = 0; turn < 434; turn++) {
      engine.rollTurn();
    }
    const state = vi.spyOn(GameEngine.prototype, 'getState').mockReturnValue(engine.getState());
    const fixture = TestBed.createComponent(GamePage);
    state.mockRestore();
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const rollButton = element.querySelector<HTMLButtonElement>('.roll-button')!;
    expect(rollButton.disabled).toBe(true);
    expect(element.textContent).toContain('You reached 100!');
    expect(element.querySelector('.age')?.textContent).toContain('100 years, 0 weeks');
    expect(element.querySelector('#upcoming-heading')).toBeNull();
    element.querySelector<HTMLButtonElement>('.scene-footer button')!.click();
    await fixture.whenStable();
    expect(rollButton.disabled).toBe(false);
    expect(element.querySelectorAll('.encounter')).toHaveLength(12);
    expect(element.querySelector('.age')?.textContent).toContain('0 years, 0 weeks');
    expect(element.querySelector('.inventory')?.textContent).toContain('No collectibles yet.');
  });

  it('resets during a slide and ignores stale animation completion events', async () => {
    const fixture = TestBed.createComponent(GamePage);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    element.querySelector<HTMLButtonElement>('.roll-button')!.click();
    await fixture.whenStable();
    expect(element.querySelector('.hero--sliding')).not.toBeNull();
    element.querySelector<HTMLButtonElement>('.scene-footer button')!.click();
    await fixture.whenStable();
    finishSlide(element);
    await fixture.whenStable();
    expect(element.querySelector<HTMLDialogElement>('dialog')!.open).toBe(false);
    expect(element.querySelector('.hero--sliding')).toBeNull();
    expect(element.querySelector<HTMLButtonElement>('.roll-button')!.disabled).toBe(false);
    expect(element.querySelector('.age')?.textContent).toContain('0 years, 0 weeks');
    expect(element.querySelector('.dice')).toBeNull();
  });

  it('slides to the finish flag on the final roll and remains there after completion', async () => {
    const engine = new GameEngine(() => 0.999999);
    for (let turn = 0; turn < 433; turn++) {
      engine.rollTurn();
    }
    const before = engine.getState();
    const finalTurn = engine.rollTurn();
    const completed = engine.getState();
    const state = vi.spyOn(GameEngine.prototype, 'getState').mockReturnValue(before);
    const fixture = TestBed.createComponent(GamePage);
    await fixture.whenStable();
    state.mockReturnValue(completed);
    vi.spyOn(GameEngine.prototype, 'rollTurn').mockReturnValue(finalTurn);
    const element = fixture.nativeElement as HTMLElement;
    element.querySelector<HTMLButtonElement>('.roll-button')!.click();
    await fixture.whenStable();
    expect(element.querySelector('.hero--sliding')).not.toBeNull();
    expect(
      element.querySelector<HTMLElement>('.hero')!.style.getPropertyValue('--landing-position'),
    ).toBe('95%');
    expect(element.querySelectorAll('.encounter')).toHaveLength(12);
    finishSlide(element);
    await fixture.whenStable();
    expect(element.querySelector<HTMLDialogElement>('dialog')!.open).toBe(true);
    element.querySelector<HTMLButtonElement>('dialog button')!.click();
    await fixture.whenStable();
    expect(element.querySelector('.hero--finished')).not.toBeNull();
    expect(element.querySelectorAll('.encounter')).toHaveLength(0);
    expect(element.querySelector<HTMLButtonElement>('.roll-button')!.disabled).toBe(true);
    expect(element.textContent).toContain('You reached 100!');
  });

  it('requires OK, blocks extra rolls, and can reset during camera scrolling', async () => {
    const roll = vi.spyOn(GameEngine.prototype, 'rollTurn');
    const fixture = TestBed.createComponent(GamePage);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const rollButton = element.querySelector<HTMLButtonElement>('.roll-button')!;
    rollButton.click();
    await fixture.whenStable();
    finishSlide(element);
    await fixture.whenStable();
    const dialog = element.querySelector<HTMLDialogElement>('dialog')!;
    const cancel = new Event('cancel', { cancelable: true });
    dialog.dispatchEvent(cancel);
    expect(cancel.defaultPrevented).toBe(true);
    expect(dialog.open).toBe(true);
    rollButton.click();
    expect(roll).toHaveBeenCalledOnce();
    dialog.querySelector('button')!.click();
    await fixture.whenStable();
    expect(element.querySelector('.world--scrolling')).not.toBeNull();
    element.querySelector<HTMLButtonElement>('.scene-footer button')!.click();
    await fixture.whenStable();
    finishScroll(element);
    await fixture.whenStable();
    expect(element.querySelector('.world--scrolling')).toBeNull();
    expect(element.querySelector('.hero--landed')).toBeNull();
    expect(rollButton.disabled).toBe(false);
    expect(element.querySelectorAll('.encounter')).toHaveLength(12);
    expect(element.querySelector('.encounter')?.querySelector('.step-icon')).toBeNull();
    expect(element.querySelector('.age')?.textContent).toContain('0 years, 0 weeks');
  });
});
