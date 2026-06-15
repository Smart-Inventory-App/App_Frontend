import React from 'react';
import { ActivityIndicator } from 'react-native';
import { render } from '@testing-library/react-native';
import { useAuth } from '../src/context/AuthContext';
import RootIndex from '../app/index';

jest.mock('expo-router', () => ({
  Redirect: () => null,
  useRouter: () => ({ replace: jest.fn() }),
}));

jest.mock('../src/context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

describe('RootIndex', () => {
  it('renders loading indicator while auth is loading', () => {
    (useAuth as jest.Mock).mockReturnValue({ isAuthenticated: false, isLoading: true });
    const { UNSAFE_getByType } = render(<RootIndex />);
    expect(UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
  });

  it('renders Redirect to login when not authenticated', () => {
    (useAuth as jest.Mock).mockReturnValue({ isAuthenticated: false, isLoading: false });
    const { toJSON } = render(<RootIndex />);
    expect(toJSON()).toBeNull();
  });

  it('renders Redirect to app when authenticated', () => {
    (useAuth as jest.Mock).mockReturnValue({ isAuthenticated: true, isLoading: false });
    const { toJSON } = render(<RootIndex />);
    expect(toJSON()).toBeNull();
  });
});
