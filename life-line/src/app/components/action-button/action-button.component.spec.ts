import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  ACTION_BUTTON_ICONS,
  ACTION_BUTTON_LABELS,
  ActionButtonComponent,
  type ActionButtonIcon,
} from './action-button.component';

@Component({
  imports: [ActionButtonComponent],
  template: `<app-action-button
    [icon]="icon()"
    [label]="label()"
    [disabled]="disabled()"
    [size]="size()"
    (pressed)="presses.push($event)"
  />`,
})
class HostComponent {
  readonly icon = signal<ActionButtonIcon>('play');
  readonly label = signal('');
  readonly disabled = signal(false);
  readonly size = signal<number | null>(null);
  readonly presses: ActionButtonIcon[] = [];
}

describe('ActionButtonComponent', () => {
  function render() {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    return { fixture, button, host: fixture.componentInstance };
  }

  it('names each icon for screen readers and draws exactly one glyph', () => {
    const { fixture, button, host } = render();
    for (const icon of ACTION_BUTTON_ICONS) {
      host.icon.set(icon);
      fixture.detectChanges();
      expect(button.getAttribute('aria-label')).toBe(ACTION_BUTTON_LABELS[icon]);
      expect(button.querySelectorAll('svg')).toHaveLength(1);
      expect(button.querySelectorAll('path').length).toBeGreaterThan(0);
    }
  });

  it('prefers an explicit label over the icon default', () => {
    const { fixture, button, host } = render();
    host.label.set('  Start a new life  ');
    fixture.detectChanges();
    expect(button.getAttribute('aria-label')).toBe('Start a new life');
    host.label.set('   ');
    fixture.detectChanges();
    expect(button.getAttribute('aria-label')).toBe('Play');
  });

  it('reports the pressed icon, and stays silent while disabled', () => {
    const { fixture, button, host } = render();
    button.click();
    host.icon.set('next');
    fixture.detectChanges();
    button.click();
    expect(host.presses).toEqual(['play', 'next']);

    host.disabled.set(true);
    fixture.detectChanges();
    expect(button.disabled).toBe(true);
    button.click();
    expect(host.presses).toEqual(['play', 'next']);
  });

  it('only applies a positive diameter', () => {
    const { fixture, host } = render();
    const element = fixture.nativeElement.querySelector('app-action-button') as HTMLElement;
    expect(element.style.getPropertyValue('--action-button-size')).toBe('');
    host.size.set(96);
    fixture.detectChanges();
    expect(element.style.getPropertyValue('--action-button-size')).toBe('96px');
    host.size.set(0);
    fixture.detectChanges();
    expect(element.style.getPropertyValue('--action-button-size')).toBe('');
  });
});
