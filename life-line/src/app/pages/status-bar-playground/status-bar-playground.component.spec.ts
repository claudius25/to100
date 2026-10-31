import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { routes } from '../../app.routes';
import { StatusBarComponent } from '../../components/status-bar/status-bar.component';
import { StatusBarPlaygroundComponent } from './status-bar-playground.component';

describe('Status bar playground', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StatusBarPlaygroundComponent],
    }).compileComponents();
  });

  it('has an isolated lazy route', async () => {
    const route = routes.find((route) => route.path === 'dev/status-bar');
    expect(route?.loadComponent).toBeDefined();
    expect(await route!.loadComponent!()).toBe(StatusBarPlaygroundComponent);
  });

  it('starts with the requested preview and four presets', () => {
    const fixture = TestBed.createComponent(StatusBarPlaygroundComponent);
    fixture.detectChanges();
    const bars = fixture.debugElement.queryAll(By.directive(StatusBarComponent));
    expect(bars).toHaveLength(5);
    const preview = bars[0].componentInstance as StatusBarComponent;
    expect([preview.health(), preview.disposition(), preview.age(), preview.money()]).toEqual([
      80, 4, 50, 1_800_000,
    ]);
    expect(fixture.nativeElement.querySelector('#money').max).toBe('10000000');
  });

  it('updates the preview immediately from every control and the precise money input', () => {
    const fixture = TestBed.createComponent(StatusBarPlaygroundComponent);
    fixture.detectChanges();
    for (const [id, value] of [
      ['health', '0'],
      ['disposition', '1'],
      ['age', '100'],
      ['money', '10000000'],
      ['money-exact', '1250'],
    ]) {
      const input = fixture.nativeElement.querySelector(`#${id}`) as HTMLInputElement;
      input.value = value;
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();
    }
    const preview = fixture.debugElement.query(By.directive(StatusBarComponent))
      .componentInstance as StatusBarComponent;
    expect([preview.health(), preview.disposition(), preview.age(), preview.money()]).toEqual([
      0, 1, 100, 1_250,
    ]);
    expect(fixture.nativeElement.querySelector('#money').value).toBe('1250');
    expect(fixture.nativeElement.textContent).toContain('1,250 / 1.3k');
    expect(fixture.nativeElement.textContent).toContain('Very sad');
  });

  it('keeps valid money when the optional numeric field is empty and clamps out-of-range values', () => {
    const fixture = TestBed.createComponent(StatusBarPlaygroundComponent);
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('#money-exact') as HTMLInputElement;
    input.value = '';
    input.dispatchEvent(new Event('input'));
    expect(fixture.componentInstance.money()).toBe(1_800_000);
    input.value = '10000001';
    input.dispatchEvent(new Event('input'));
    expect(fixture.componentInstance.money()).toBe(10_000_000);
    input.value = '-1';
    input.dispatchEvent(new Event('input'));
    expect(fixture.componentInstance.money()).toBe(0);
  });

  it('changes only the background when toggled', () => {
    const fixture = TestBed.createComponent(StatusBarPlaygroundComponent);
    fixture.detectChanges();
    fixture.nativeElement.querySelector('.background-toggle').click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.playground--dark')).not.toBeNull();
    expect(
      fixture.nativeElement.querySelector('.background-toggle').getAttribute('aria-pressed'),
    ).toBe('true');
    expect(fixture.componentInstance.health()).toBe(80);
    expect(fixture.componentInstance.money()).toBe(1_800_000);
  });
});
