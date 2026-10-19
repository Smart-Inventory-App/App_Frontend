import {
  clampScale,
  clampTranslation,
  distanceBetween,
  DOUBLE_TAP_MS,
  DOUBLE_TAP_SCALE,
  isDoubleTap,
  isResetScale,
  MAX_SCALE,
  maxTranslation,
  MIN_SCALE,
  nextDoubleTapScale,
} from '../src/utils/zoom';

describe('zoom utils', () => {
  it('measures the distance between two fingers', () => {
    expect(distanceBetween({ pageX: 0, pageY: 0 }, { pageX: 3, pageY: 4 })).toBe(5);
  });

  it('keeps the zoom between the minimum and the maximum', () => {
    expect(clampScale(0.4)).toBe(MIN_SCALE);
    expect(clampScale(2)).toBe(2);
    expect(clampScale(99)).toBe(MAX_SCALE);
  });

  it('allows no movement without zoom and half of the extra size on each side with zoom', () => {
    expect(maxTranslation(400, 1)).toBe(0);
    expect(maxTranslation(400, 2)).toBe(200);
    expect(maxTranslation(400, 0.5)).toBe(0);
  });

  it('does not let the image leave the screen', () => {
    expect(clampTranslation(500, 400, 2)).toBe(200);
    expect(clampTranslation(-500, 400, 2)).toBe(-200);
    expect(clampTranslation(50, 400, 2)).toBe(50);
    expect(clampTranslation(50, 400, 1)).toBe(0);
  });

  it('recognizes a double tap only when the second tap is quick and there was a first one', () => {
    expect(isDoubleTap(1000, 0)).toBe(false);
    expect(isDoubleTap(1000, 1000 - DOUBLE_TAP_MS)).toBe(true);
    expect(isDoubleTap(1000, 1000 - DOUBLE_TAP_MS - 1)).toBe(false);
  });

  it('zooms in on a double tap and goes back to normal if it was already zoomed', () => {
    expect(nextDoubleTapScale(1)).toBe(DOUBLE_TAP_SCALE);
    expect(nextDoubleTapScale(1.01)).toBe(DOUBLE_TAP_SCALE);
    expect(nextDoubleTapScale(2)).toBe(MIN_SCALE);
  });

  it('treats a barely zoomed image as not zoomed', () => {
    expect(isResetScale(1)).toBe(true);
    expect(isResetScale(1.02)).toBe(true);
    expect(isResetScale(1.5)).toBe(false);
  });
});
