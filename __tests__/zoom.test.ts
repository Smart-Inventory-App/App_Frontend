import {
  clampScale,
  clampTranslation,
  distanceBetween,
  isResetScale,
  MAX_SCALE,
  maxTranslation,
  midpoint,
  MIN_SCALE,
  pinchTranslation,
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

  it('finds the point between two fingers', () => {
    expect(midpoint({ pageX: 0, pageY: 10 }, { pageX: 100, pageY: 30 })).toEqual({ pageX: 50, pageY: 20 });
  });

  describe('pinchTranslation', () => {
    const center = { pageX: 200, pageY: 400 };
    const mid = (x: number, y: number) => ({ pageX: x, pageY: y });

    it('leaves the image where it was if nothing changes', () => {
      expect(pinchTranslation({ x: 30, y: -10 }, 2, 2, mid(300, 500), mid(300, 500), center)).toEqual({ x: 30, y: -10 });
    });

    it('zooms around the center without moving the image when the fingers are on the center', () => {
      expect(pinchTranslation({ x: 0, y: 0 }, 1, 2, mid(200, 400), mid(200, 400), center)).toEqual({ x: 0, y: 0 });
    });

    it('keeps the point under the fingers in place while zooming', () => {
      // El punto medio está 100 a la derecha y 50 abajo del centro: al duplicar el zoom la imagen se corre 100 y 50
      expect(pinchTranslation({ x: 0, y: 0 }, 1, 2, mid(300, 450), mid(300, 450), center)).toEqual({ x: -100, y: -50 });
    });

    it('accompanies the fingers when they move together', () => {
      expect(pinchTranslation({ x: 0, y: 0 }, 2, 2, mid(200, 400), mid(230, 380), center)).toEqual({ x: 30, y: -20 });
    });

    it('does not break when the base zoom is zero', () => {
      expect(pinchTranslation({ x: 0, y: 0 }, 0, 2, mid(200, 400), mid(200, 400), center)).toEqual({ x: 0, y: 0 });
    });
  });

  it('treats a barely zoomed image as not zoomed', () => {
    expect(isResetScale(1)).toBe(true);
    expect(isResetScale(1.02)).toBe(true);
    expect(isResetScale(1.5)).toBe(false);
  });
});
