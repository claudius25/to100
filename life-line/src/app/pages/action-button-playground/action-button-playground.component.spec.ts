import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { routes } from '../../app.routes';
import {
  ACTION_BUTTON_ICONS,
  ActionButtonComponent,
} from '../../components/action-button/action-button.component';
import { ActionButtonPlaygroundComponent } from './action-button-playground.component';

describe('Action button playground', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ActionButtonPlaygroundComponent],
    }).compileComponents();
  });

  it('has an isolated lazy route', async () => {
    const route = routes.find((route) => route.path === 'dev/action-button');
    expect(route?.loadComponent).toBeDefined();
    expect(await route!.loadComponent!()).toBe(ActionButtonPlaygroundComponent);
  });

  it('shows all three buttons over the launcher artwork', () => {
    const fixture = TestBed.createComponent(ActionButtonPlaygroundComponent);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector<HTMLImageElement>('.poster-art')?.getAttribute('src')).toBe(
      'assets/launcher.png',
    );
    const overlaid = root.querySelectorAll('.poster-actions app-action-button');
    expect(overlaid).toHaveLength(ACTION_BUTTON_ICONS.length);
    expect([...overlaid].map((button) => button.querySelector('button')?.ariaLabel)).toEqual([
      'Restart',
      'Play',
      'Next',
    ]);
  });

  it('applies the size and gap controls to every preview', () => {
    const fixture = TestBed.createComponent(ActionButtonPlaygroundComponent);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    for (const [id, value] of [
      ['size', '96'],
      ['gap', '40'],
    ]) {
      const input = root.querySelector<HTMLInputElement>(`#${id}`)!;
      input.value = value;
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();
    }
    expect(fixture.componentInstance.size()).toBe(96);
    expect(root.querySelector<HTMLElement>('.poster-actions')?.style.gap).toBe('40px');
    const buttons = fixture.debugElement.queryAll(By.directive(ActionButtonComponent));
    expect(buttons.every((button) => button.componentInstance.size() === 96)).toBe(true);

    // Out-of-range values are clamped rather than ignored.
    const size = root.querySelector<HTMLInputElement>('#size')!;
    size.value = '999';
    size.dispatchEvent(new Event('input'));
    expect(fixture.componentInstance.size()).toBe(112);
  });

  it('reports the last press and can disable every button', () => {
    const fixture = TestBed.createComponent(ActionButtonPlaygroundComponent);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    root.querySelectorAll<HTMLButtonElement>('.poster-actions button')[2].click();
    fixture.detectChanges();
    expect(root.querySelector('.pressed')?.textContent).toContain('Next (next)');

    root.querySelector<HTMLButtonElement>('#disabled-toggle')!.click();
    fixture.detectChanges();
    const overlaid = root.querySelectorAll<HTMLButtonElement>('.poster-actions button');
    expect([...overlaid].every((button) => button.disabled)).toBe(true);
  });
});
