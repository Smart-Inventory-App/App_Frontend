import React from 'react';
import { render } from '@testing-library/react-native';
import HomeScreen from '../app/index';

describe('HomeScreen', () => {
  it('renders the welcome text', () => {
    const { getByText } = render(<HomeScreen />);
    expect(getByText('Bienvenido')).toBeTruthy();
  });
});
