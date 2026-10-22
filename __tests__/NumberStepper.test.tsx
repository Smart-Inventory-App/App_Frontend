import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import NumberStepper from '../src/components/NumberStepper';

const setup = (value: string, min = 2, max = 90) => {
  const onChange = jest.fn();
  render(<NumberStepper testID="days" value={value} onChange={onChange} min={min} max={max} />);
  return onChange;
};

describe('NumberStepper', () => {
  it('shows the value in an input the user can type in', () => {
    const onChange = setup('7');
    expect(screen.getByTestId('days').props.value).toBe('7');
    fireEvent.changeText(screen.getByTestId('days'), '15');
    expect(onChange).toHaveBeenCalledWith('15');
  });

  it('only takes digits, and no more than the digits of the maximum', () => {
    const onChange = setup('7');
    fireEvent.changeText(screen.getByTestId('days'), '1a2b');
    expect(onChange).toHaveBeenLastCalledWith('12');
    fireEvent.changeText(screen.getByTestId('days'), '123');
    expect(onChange).toHaveBeenLastCalledWith('12');
    expect(screen.getByTestId('days').props.maxLength).toBe(2);
  });

  it('goes up and down with its two buttons', () => {
    const onChange = setup('7');
    fireEvent.press(screen.getByTestId('days-up'));
    expect(onChange).toHaveBeenLastCalledWith('8');
    fireEvent.press(screen.getByTestId('days-down'));
    expect(onChange).toHaveBeenLastCalledWith('6');
  });

  it('cannot go past the maximum: the up button is disabled', () => {
    const onChange = setup('90');
    expect(screen.getByTestId('days-up').props.accessibilityState?.disabled ?? screen.getByTestId('days-up').props.disabled).toBeTruthy();
    fireEvent.press(screen.getByTestId('days-up'));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByTestId('days-down').props.accessibilityState?.disabled).toBeFalsy();
  });

  it('cannot go below the minimum: the down button is disabled', () => {
    const onChange = setup('2');
    fireEvent.press(screen.getByTestId('days-down'));
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.press(screen.getByTestId('days-up'));
    expect(onChange).toHaveBeenCalledWith('3');
  });

  it('works for the hours, from 0 to 23', () => {
    const onChange = setup('23', 0, 23);
    fireEvent.press(screen.getByTestId('days-up'));
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.press(screen.getByTestId('days-down'));
    expect(onChange).toHaveBeenCalledWith('22');
  });

  it('starts from the minimum going up, and from the maximum going down, when it is empty', () => {
    const onChange = setup('');
    fireEvent.press(screen.getByTestId('days-up'));
    expect(onChange).toHaveBeenLastCalledWith('2');
    fireEvent.press(screen.getByTestId('days-down'));
    expect(onChange).toHaveBeenLastCalledWith('90');
  });

  it('labels the buttons for accessibility', () => {
    setup('7');
    expect(screen.getByLabelText('Subir')).toBeTruthy();
    expect(screen.getByLabelText('Bajar')).toBeTruthy();
  });
});
