import { TestBed } from '@angular/core/testing';
import { formatStatusMoney, StatusBarComponent } from './status-bar.component';

describe('Status money formatting', () => {
  it.each([
    [0, '0'],
    [850, '850'],
    [1_250, '1.3k'],
    [12_500, '12.5k'],
    [850_000, '850k'],
    [1_800_000, '1.8m'],
    [10_000_000, '10m'],
    [999_950, '1m'],
    [999.9, '1k'],
    [-10, '0'],
    [NaN, '0'],
    [Infinity, '0'],
  ])('formats %s as %s', (value, expected) => {
    expect(formatStatusMoney(value)).toBe(expected);
  });
});

describe('StatusBarComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [StatusBarComponent] }).compileComponents();
  });

  it('applies optional width and height to the host and ignores invalid sizes', () => {
    const fixture = TestBed.createComponent(StatusBarComponent);
    fixture.componentRef.setInput('width', 480);
    fixture.componentRef.setInput('height', 30);
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement;
    expect(host.style.width).toBe('480px');
    expect(host.style.getPropertyValue('--status-bar-track-height')).toBe('30px');
    fixture.componentRef.setInput('width', -5);
    fixture.componentRef.setInput('height', null);
    fixture.detectChanges();
    expect(host.style.width).toBe('');
    expect(host.style.getPropertyValue('--status-bar-track-height')).toBe('');
  });

  it('draws the face background to the edge of its SVG without clipping the border', () => {
    const fixture = TestBed.createComponent(StatusBarComponent);
    fixture.detectChanges();
    const face = fixture.nativeElement.querySelector('.face') as SVGElement;
    const background = face.querySelector('.face-background') as SVGCircleElement;
    const [, , width, height] = face.getAttribute('viewBox')!.split(' ').map(Number);
    const radius = Number(background.getAttribute('r'));
    const strokeWidth = Number.parseFloat(getComputedStyle(background).strokeWidth);

    expect(width).toBe(height);
    expect(Number(background.getAttribute('cx'))).toBe(width / 2);
    expect(Number(background.getAttribute('cy'))).toBe(height / 2);
    expect(radius * 2 + strokeWidth).toBe(height);
  });

  it('shows the money section without a divider', () => {
    const fixture = TestBed.createComponent(StatusBarComponent);
    fixture.detectChanges();
    const money = fixture.nativeElement.querySelector('.money') as HTMLElement;
    const styles = getComputedStyle(money);
    expect(['', 'none']).toContain(styles.borderLeftStyle);
    expect(['', 'none']).toContain(styles.boxShadow);
  });

  it('provides presentation-only defaults and an accessible summary', () => {
    const fixture = TestBed.createComponent(StatusBarComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.renderedHealth()).toBe(100);
    expect(fixture.componentInstance.renderedAge()).toBe(0);
    expect(fixture.nativeElement.querySelector('.status-bar').getAttribute('aria-label')).toBe(
      'Health 100 of 100. Happy. Age 0 years. Money 0.',
    );
  });

  it.each([
    [-20, 0],
    [0, 0],
    [100, 100],
    [125, 100],
    [NaN, 0],
    [Infinity, 0],
  ])('clamps health and age %s to %s without modifying inputs', (value, expected) => {
    const fixture = TestBed.createComponent(StatusBarComponent);
    fixture.componentRef.setInput('health', value);
    fixture.componentRef.setInput('age', value);
    fixture.detectChanges();
    expect(fixture.componentInstance.renderedHealth()).toBe(expected);
    expect(fixture.componentInstance.renderedAge()).toBe(expected);
    expect(fixture.componentInstance.health()).toBe(value);
    expect(fixture.componentInstance.age()).toBe(value);
    const bar = fixture.nativeElement.querySelector('.status-bar') as HTMLElement;
    expect(bar.style.getPropertyValue('--health-position')).toBe(`${expected}%`);
    expect(fixture.nativeElement.querySelector('.age-ring').getAttribute('stroke-dashoffset')).toBe(
      String(100 - expected),
    );
  });

  it('changes all four expressions without moving the face or changing age', () => {
    const fixture = TestBed.createComponent(StatusBarComponent);
    fixture.componentRef.setInput('health', 42);
    fixture.componentRef.setInput('age', 75);
    const paths = new Set<string>();
    for (const disposition of [1, 2, 3, 4]) {
      fixture.componentRef.setInput('disposition', disposition);
      fixture.detectChanges();
      paths.add(fixture.nativeElement.querySelector('.mouth').getAttribute('d'));
      expect(fixture.componentInstance.renderedHealth()).toBe(42);
      expect(fixture.componentInstance.renderedAge()).toBe(75);
    }
    expect(paths.size).toBe(4);
  });

  it('renders independent quarter-circle age progress starting at twelve oclock', () => {
    const fixture = TestBed.createComponent(StatusBarComponent);
    for (const age of [0, 25, 50, 75, 100]) {
      fixture.componentRef.setInput('age', age);
      fixture.detectChanges();
      const ring = fixture.nativeElement.querySelector('.age-ring') as SVGCircleElement;
      expect(ring.getAttribute('stroke-dashoffset')).toBe(String(100 - age));
      expect(ring.getAttribute('pathLength')).toBe('100');
      expect(ring.getAttribute('transform')).toBe('rotate(-90 32 32)');
      expect(fixture.componentInstance.renderedHealth()).toBe(100);
    }
  });

  it('interpolates pastel health colors between stops', () => {
    const fixture = TestBed.createComponent(StatusBarComponent);
    fixture.componentRef.setInput('health', 0);
    expect(fixture.componentInstance.fillColors().start).toBe('rgb(196, 121, 126)');
    fixture.componentRef.setInput('health', 12.5);
    expect(fixture.componentInstance.fillColors().start).toBe('rgb(213, 138, 133)');
    fixture.componentRef.setInput('health', 100);
    expect(fixture.componentInstance.fillColors().start).toBe('rgb(102, 199, 162)');
  });
});
