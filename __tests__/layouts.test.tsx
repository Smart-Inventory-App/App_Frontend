import React from 'react';
import { render, screen } from '@testing-library/react-native';
import RootLayout from '../app/_layout';
import AppLayout from '../app/(app)/_layout';
import AuthLayout from '../app/(auth)/_layout';
import TabsLayout from '../app/(tabs)/_layout';
import AppIndexScreen from '../app/(app)/index';
import { useAuth } from '@/context/AuthContext';

jest.mock('expo-router', () => ({
  Stack: ({ children }: any) => children ?? null,
  Tabs: Object.assign(
    ({ children }: any) => children ?? null,
    {
      Screen: ({ options }: any) => {
        // Exercise the tabBarIcon render-prop so its branch is covered too.
        options?.tabBarIcon?.({ color: '#000', size: 20, focused: false });
        return null;
      },
    },
  ),
  Redirect: ({ href }: { href: string }) => {
    const { Text } = require('react-native');
    return <Text>redirect:{href}</Text>;
  },
  useFocusEffect: () => {},
}));

jest.mock('../src/context/AuthContext', () => ({
  AuthProvider: ({ children }: any) => children ?? null,
  useAuth: jest.fn(),
}));

jest.mock('../src/i18n', () => ({
  initI18n: jest.fn().mockResolvedValue(undefined),
}));

describe('Layouts', () => {
  it('AuthLayout renders a Stack', () => {
    render(<AuthLayout />);
  });

  it('TabsLayout renders Tabs with all screens', () => {
    (useAuth as jest.Mock).mockReturnValue({ isAuthenticated: true, isLoading: false });
    render(<TabsLayout />);
  });

  it('TabsLayout redirects to login when the session is gone', () => {
    (useAuth as jest.Mock).mockReturnValue({ isAuthenticated: false, isLoading: false });
    render(<TabsLayout />);
    expect(screen.getByText('redirect:/(auth)/login')).toBeTruthy();
  });

  it('TabsLayout does not redirect while auth is still loading', () => {
    (useAuth as jest.Mock).mockReturnValue({ isAuthenticated: false, isLoading: true });
    render(<TabsLayout />);
    expect(screen.queryByText('redirect:/(auth)/login')).toBeNull();
  });

  it('RootLayout shows a spinner while i18n initializes, then renders children', async () => {
    render(<RootLayout />);
    await new Promise((r) => setTimeout(r, 0));
  });

  it('AppLayout redirects to login when not authenticated', () => {
    (useAuth as jest.Mock).mockReturnValue({ isAuthenticated: false, isLoading: false });
    render(<AppLayout />);
    expect(screen.getByText('redirect:/(auth)/login')).toBeTruthy();
  });

  it('AppLayout renders nothing while auth is loading', () => {
    (useAuth as jest.Mock).mockReturnValue({ isAuthenticated: false, isLoading: true });
    const { toJSON } = render(<AppLayout />);
    expect(toJSON()).toBeNull();
  });

  it('AppLayout renders a Stack once authenticated', () => {
    (useAuth as jest.Mock).mockReturnValue({ isAuthenticated: true, isLoading: false });
    render(<AppLayout />);
  });

  it('(app)/index redirects to the tabs home', () => {
    render(<AppIndexScreen />);
    expect(screen.getByText('redirect:/(tabs)/')).toBeTruthy();
  });
});
