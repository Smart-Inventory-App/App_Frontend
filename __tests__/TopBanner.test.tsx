import React from 'react';
import { Animated, PanResponder } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import TopBanner, { shouldDismissOnSwipe } from '../src/components/TopBanner';

type PanConfig = {
  onMoveShouldSetPanResponder: (e: any, g: any) => boolean;
  onPanResponderMove: (e: any, g: any) => void;
  onPanResponderRelease: (e: any, g: any) => void;
  onPanResponderTerminate: () => void;
};

let config: PanConfig;

beforeEach(() => {
  jest.spyOn(PanResponder, 'create').mockImplementation(((cfg: PanConfig) => {
    config = cfg;
    return { panHandlers: {} };
  }) as any);
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe('shouldDismissOnSwipe', () => {
  it('dismisses on a long upward drag or a fast upward flick only', () => {
    expect(shouldDismissOnSwipe(-40, 0)).toBe(true);
    expect(shouldDismissOnSwipe(-10, -0.8)).toBe(true);
    expect(shouldDismissOnSwipe(-10, -0.1)).toBe(false);
    expect(shouldDismissOnSwipe(40, 0)).toBe(false);
  });
});

describe('TopBanner', () => {
  it('renders the message', () => {
    render(<TopBanner message="Hola" onDismiss={jest.fn()} />);
    expect(screen.getByText('Hola')).toBeTruthy();
  });

  it('slides out before calling onDismiss when tapped', async () => {
    const onDismiss = jest.fn();
    const timing = jest.spyOn(Animated, 'timing');
    render(<TopBanner message="Hola" onDismiss={onDismiss} />);
    fireEvent.press(screen.getByText('Hola'));
    expect(timing).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ toValue: -200 }));
    await waitFor(() => expect(onDismiss).toHaveBeenCalledTimes(1));
  });

  it('only dismisses once even if triggered repeatedly', async () => {
    const onDismiss = jest.fn();
    render(<TopBanner message="Hola" onDismiss={onDismiss} />);
    fireEvent.press(screen.getByText('Hola'));
    fireEvent.press(screen.getByText('Hola'));
    await waitFor(() => expect(onDismiss).toHaveBeenCalledTimes(1));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('dismisses by itself after autoDismissMs', async () => {
    jest.useFakeTimers();
    const onDismiss = jest.fn();
    render(<TopBanner message="Hola" onDismiss={onDismiss} autoDismissMs={1000} />);
    expect(onDismiss).not.toHaveBeenCalled();
    await act(async () => { await jest.advanceTimersByTimeAsync(1500); });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('only captures upward, mostly vertical gestures', () => {
    render(<TopBanner message="Hola" onDismiss={jest.fn()} />);
    expect(config.onMoveShouldSetPanResponder({}, { dy: -20, dx: 3 })).toBe(true);
    expect(config.onMoveShouldSetPanResponder({}, { dy: -20, dx: 30 })).toBe(false);
    expect(config.onMoveShouldSetPanResponder({}, { dy: 20, dx: 0 })).toBe(false);
    expect(config.onMoveShouldSetPanResponder({}, { dy: -2, dx: 0 })).toBe(false);
  });

  it('dismisses when swiped up past the threshold', async () => {
    const onDismiss = jest.fn();
    render(<TopBanner message="Hola" onDismiss={onDismiss} />);
    act(() => {
      config.onPanResponderMove({}, { dy: -50 });
      config.onPanResponderRelease({}, { dy: -50, vy: -0.1 });
    });
    await waitFor(() => expect(onDismiss).toHaveBeenCalledTimes(1));
  });

  it('springs back and stays when the swipe is short or downward', () => {
    const onDismiss = jest.fn();
    const spring = jest.spyOn(Animated, 'spring');
    render(<TopBanner message="Hola" onDismiss={onDismiss} />);
    act(() => {
      config.onPanResponderMove({}, { dy: 30 });
      config.onPanResponderRelease({}, { dy: -10, vy: -0.1 });
      config.onPanResponderTerminate();
    });
    expect(spring).toHaveBeenCalledTimes(2);
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('ignores drag moves once it is already leaving', async () => {
    const onDismiss = jest.fn();
    render(<TopBanner message="Hola" onDismiss={onDismiss} />);
    fireEvent.press(screen.getByText('Hola'));
    act(() => { config.onPanResponderMove({}, { dy: -10 }); });
    await waitFor(() => expect(onDismiss).toHaveBeenCalledTimes(1));
  });
});
