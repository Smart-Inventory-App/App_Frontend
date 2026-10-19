import React from 'react';
import { Animated, StyleSheet } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import SuccessCheck from '../src/components/SuccessCheck';

afterEach(() => {
  jest.restoreAllMocks();
});

describe('SuccessCheck', () => {
  it('shows the check mark icon', () => {
    render(<SuccessCheck />);
    expect(screen.getByTestId('success-check')).toBeTruthy();
  });

  it('starts out of nothing: with no size and no opacity', () => {
    render(<SuccessCheck />);
    const style = StyleSheet.flatten(screen.getByTestId('success-check').props.style);
    expect(style.transform[0].scale.__getValue()).toBe(0);
    expect(style.opacity.__getValue()).toBe(0);
  });

  it('pops up with a spring that grows it to its full size', () => {
    const spring = jest.spyOn(Animated, 'spring');
    render(<SuccessCheck />);
    expect(spring).toHaveBeenCalledTimes(1);
    expect(spring.mock.calls[0][1]).toMatchObject({ toValue: 1 });
    // un resorte con poca fricción rebota un poco antes de quedar en su tamaño
    expect((spring.mock.calls[0][1] as { friction: number }).friction).toBeLessThan(8);
  });

  it('stops its animation when it goes away', () => {
    const stop = jest.fn();
    jest.spyOn(Animated, 'spring').mockReturnValue({ start: jest.fn(), stop, reset: jest.fn() } as any);
    const { unmount } = render(<SuccessCheck />);
    unmount();
    expect(stop).toHaveBeenCalled();
  });
});
