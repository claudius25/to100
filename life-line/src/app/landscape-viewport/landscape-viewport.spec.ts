import { TestBed } from '@angular/core/testing';
import { LandscapeViewport } from './landscape-viewport';

describe('LandscapeViewport', () => {
  let portrait: boolean;
  let onOrientationChange: (() => void) | undefined;
  const removeOrientationListener = vi.fn();

  beforeEach(() => {
    portrait = false;
    onOrientationChange = undefined;
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({
        media: query,
        get matches() {
          return query.includes('portrait') ? portrait : true;
        },
        addEventListener: (_type: string, listener: () => void) => {
          onOrientationChange = listener;
        },
        removeEventListener: removeOrientationListener,
      })),
    );
    TestBed.configureTestingModule({ imports: [LandscapeViewport] });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    Reflect.deleteProperty(document, 'fullscreenElement');
    vi.clearAllMocks();
  });

  it('blocks portrait touch screens and unblocks on rotation without recreating the content', async () => {
    portrait = true;
    const fixture = TestBed.createComponent(LandscapeViewport);
    await fixture.whenStable();
    const content = fixture.nativeElement.querySelector('.viewport-content') as HTMLElement;
    expect(content.inert).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Rotate your phone');

    portrait = false;
    onOrientationChange?.();
    await fixture.whenStable();
    expect(content.inert).toBe(false);
    expect(fixture.nativeElement.querySelector('.rotate-prompt')).toBeNull();
    fixture.destroy();
    expect(removeOrientationListener).toHaveBeenCalled();
  });

  it('omits fullscreen when the browser does not support it', async () => {
    const fixture = TestBed.createComponent(LandscapeViewport);
    Object.defineProperty(fixture.nativeElement, 'requestFullscreen', { value: undefined });
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.fullscreen-toggle')).toBeNull();
  });

  it('requests landscape after entering fullscreen and releases its lock on exit', async () => {
    const lock = vi.fn().mockResolvedValue(undefined);
    const unlock = vi.fn();
    vi.stubGlobal('screen', { orientation: { lock, unlock } });
    const fixture = TestBed.createComponent(LandscapeViewport);
    let fullscreenElement: Element | null = null;
    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      get: () => fullscreenElement,
    });
    const request = vi.fn().mockImplementation(async () => {
      fullscreenElement = fixture.nativeElement;
      document.dispatchEvent(new Event('fullscreenchange'));
    });
    Object.defineProperty(fixture.nativeElement, 'requestFullscreen', { value: request });
    await fixture.whenStable();
    fixture.nativeElement.querySelector('button').click();
    await fixture.whenStable();
    expect(request).toHaveBeenCalledOnce();
    expect(lock).toHaveBeenCalledWith('landscape');
    expect(fixture.nativeElement.querySelector('button').textContent).toContain('Exit fullscreen');

    fullscreenElement = null;
    document.dispatchEvent(new Event('fullscreenchange'));
    expect(unlock).toHaveBeenCalledOnce();
  });

  it('shows manual-rotation guidance when fullscreen is rejected', async () => {
    const fixture = TestBed.createComponent(LandscapeViewport);
    Object.defineProperty(fixture.nativeElement, 'requestFullscreen', {
      value: vi.fn().mockRejectedValue(new Error('Not allowed')),
    });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await fixture.whenStable();
    fixture.nativeElement.querySelector('button').click();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.fullscreen-notice').textContent).toContain(
      'Fullscreen is unavailable',
    );
    expect(warn).toHaveBeenCalled();
  });
});
