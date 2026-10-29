import { Animated, Dimensions } from 'react-native';
import {
  BANNER_TABS,
  TAB_SLIDE_DURATION_MS,
  isFixedBannerChange,
  endTabTransition,
  resetTabTransition,
  startTabTransition,
  subscribeFixedBanner,
  skipNextTabAnimation,
  slideTransition,
} from '../src/utils/tabTransition';

const WIDTH = 400;

beforeEach(() => {
  jest.spyOn(Dimensions, 'get').mockReturnValue({ width: WIDTH, height: 800, scale: 1, fontScale: 1 });
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

// translateX de una pantalla según su progreso: -1 a la izquierda de la que se ve, 0 la que se ve, 1 a la derecha
const translateX = (progress: number) => {
  const result = slideTransition.sceneStyleInterpolator!({ current: { progress: new Animated.Value(progress) } });
  const style = result.sceneStyle as { transform: { translateX: any }[] };
  return style.transform[0].translateX.__getValue();
};

describe('slideTransition', () => {
  it('keeps the visible screen in place', () => {
    expect(translateX(0)).toBe(0);
  });

  it('puts a screen of a tab further to the right one screen width to the right', () => {
    expect(translateX(1)).toBe(WIDTH);
  });

  it('puts a screen of a tab further to the left one screen width to the left', () => {
    expect(translateX(-1)).toBe(-WIDTH);
  });

  it('moves smoothly between the places while it slides', () => {
    expect(translateX(0.5)).toBe(WIDTH / 2);
    expect(translateX(-0.25)).toBe(-WIDTH / 4);
  });

  it('uses the width of the screen at the moment it animates', () => {
    (Dimensions.get as jest.Mock).mockReturnValue({ width: 800, height: 400, scale: 1, fontScale: 1 });
    expect(translateX(1)).toBe(800);
  });

  it('eases in and out with a smooth curve: slow at the ends, faster in the middle', () => {
    const { easing } = (slideTransition.transitionSpec as { config: { easing: (t: number) => number } }).config;
    expect(easing(0)).toBe(0);
    expect(easing(1)).toBe(1);
    expect(easing(0.1)).toBeLessThan(0.1 + 0.1);
    expect(easing(0.5)).toBeGreaterThan(0.5);
  });

  it('is an animation with a duration, not an instant jump', () => {
    expect(slideTransition.transitionSpec).toMatchObject({ animation: 'timing', config: { duration: TAB_SLIDE_DURATION_MS } });
    expect(TAB_SLIDE_DURATION_MS).toBeGreaterThan(100);
  });
});

const duration = () => (slideTransition.transitionSpec as { config: { duration: number } }).config.duration;

describe('skipNextTabAnimation', () => {
  it('slides normally by default', () => {
    expect(duration()).toBe(TAB_SLIDE_DURATION_MS);
  });

  it('makes the next change of tab instant, and goes back to sliding after a moment', () => {
    jest.useFakeTimers();
    skipNextTabAnimation();
    expect(duration()).toBe(0);
    jest.advanceTimersByTime(1000);
    expect(duration()).toBe(TAB_SLIDE_DURATION_MS);
  });

  it('can be asked again while it was already waiting', () => {
    jest.useFakeTimers();
    skipNextTabAnimation();
    jest.advanceTimersByTime(300);
    skipNextTabAnimation();
    jest.advanceTimersByTime(400);
    expect(duration()).toBe(0);
    jest.advanceTimersByTime(400);
    expect(duration()).toBe(TAB_SLIDE_DURATION_MS);
  });
});

describe('isFixedBannerChange', () => {
  it('keeps the banner still between any two tabs that are not the home', () => {
    BANNER_TABS.forEach(from => {
      BANNER_TABS.forEach(to => {
        if (from !== to) expect(isFixedBannerChange(from, to)).toBe(true);
      });
    });
  });

  it('lets the banner slide with its screen whenever the home is involved', () => {
    BANNER_TABS.forEach(tab => {
      expect(isFixedBannerChange('index', tab)).toBe(false);
      expect(isFixedBannerChange(tab, 'index')).toBe(false);
    });
  });
});

describe('fixed banner store', () => {
  beforeEach(() => resetTabTransition());

  it('says which tab the fixed banner is for when changing between tabs that are not the home', () => {
    const listener = jest.fn();
    subscribeFixedBanner(listener);
    startTabTransition('inventario');
    expect(listener).toHaveBeenLastCalledWith(null);
    endTabTransition();
    startTabTransition('cargar');
    expect(listener).toHaveBeenLastCalledWith('cargar');
    endTabTransition();
    expect(listener).toHaveBeenLastCalledWith(null);
  });

  it('keeps the banner with its screen when the home is the origin or the destination', () => {
    const listener = jest.fn();
    subscribeFixedBanner(listener);
    startTabTransition('perfil');
    expect(listener).toHaveBeenLastCalledWith(null);
    endTabTransition();
    startTabTransition('index');
    expect(listener).toHaveBeenLastCalledWith(null);
    endTabTransition();
    startTabTransition('alertas');
    expect(listener).toHaveBeenLastCalledWith(null);
  });

  it('stops telling a listener that unsubscribed', () => {
    const listener = jest.fn();
    const unsubscribe = subscribeFixedBanner(listener);
    unsubscribe();
    startTabTransition('inventario');
    expect(listener).not.toHaveBeenCalled();
  });

  it('starts again from the home after a reset', () => {
    startTabTransition('inventario');
    resetTabTransition();
    const listener = jest.fn();
    subscribeFixedBanner(listener);
    startTabTransition('cargar');
    expect(listener).toHaveBeenLastCalledWith(null);
  });
});
