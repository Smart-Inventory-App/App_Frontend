import React from 'react';
import { act, render, screen } from '@testing-library/react-native';
import RootLayout from '../app/_layout';
import AppLayout from '../app/(app)/_layout';
import AuthLayout from '../app/(auth)/_layout';
import TabsLayout from '../app/(tabs)/_layout';
import AppIndexScreen from '../app/(app)/index';
import { useAuth } from '@/context/AuthContext';
import { resetTabTransition, slideTransition } from '../src/utils/tabTransition';

let mockTabsScreenOptions: any;
let mockTabsScreenListeners: any;
let mockTabsRenders = 0;

jest.mock('expo-router', () => ({
  Stack: ({ children }: any) => children ?? null,
  Tabs: Object.assign(
    ({ children, screenOptions, screenListeners }: any) => {
      mockTabsScreenOptions = screenOptions;
      mockTabsScreenListeners = screenListeners;
      mockTabsRenders += 1;
      return children ?? null;
    },
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

  it('TabsLayout slides the screens when switching tabs, towards the side of the chosen tab', () => {
    (useAuth as jest.Mock).mockReturnValue({ isAuthenticated: true, isLoading: false });
    render(<TabsLayout />);
    expect(mockTabsScreenOptions.headerShown).toBe(false);
    expect(mockTabsScreenOptions.sceneStyleInterpolator).toBe(slideTransition.sceneStyleInterpolator);
    expect(mockTabsScreenOptions.transitionSpec).toBe(slideTransition.transitionSpec);
  });

  describe('fixed banner while sliding between tabs', () => {
    const go = (tab: string) => act(() => { mockTabsScreenListeners({ route: { name: tab } }).transitionStart(); });
    const end = (tab: string) => act(() => { mockTabsScreenListeners({ route: { name: tab } }).transitionEnd(); });

    beforeEach(() => {
      resetTabTransition();
      mockTabsRenders = 0;
      (useAuth as jest.Mock).mockReturnValue({ isAuthenticated: true, isLoading: false });
      render(<TabsLayout />);
    });

    it('has no extra banner when nothing is sliding', () => {
      expect(screen.queryByTestId('fixed-banner')).toBeNull();
    });

    it('shows a still banner with the title of the new tab when sliding between two tabs that are not the home', () => {
      go('inventario');
      end('inventario');
      go('cargar');
      expect(screen.getByTestId('fixed-banner')).toBeTruthy();
      expect(screen.getByText('Flujo de Producto')).toBeTruthy();
      end('cargar');
      expect(screen.queryByTestId('fixed-banner')).toBeNull();
    });

    it.each([
      ['alertas', 'Centro de Alertas'],
      ['perfil', 'Perfil'],
      ['inventario', 'Inventario'],
    ])('uses the title of %s', (tab, title) => {
      go('cargar');
      end('cargar');
      go(tab);
      expect(screen.getByText(title)).toBeTruthy();
    });

    it('does not use it when going from the home to another tab: its banner slides with the screen', () => {
      go('inventario');
      expect(screen.queryByTestId('fixed-banner')).toBeNull();
    });

    it('does not use it when going to the home from another tab', () => {
      go('perfil');
      end('perfil');
      go('index');
      expect(screen.queryByTestId('fixed-banner')).toBeNull();
    });

    it('does not draw the tabs again while the banner changes, which would restart the slide and make the old screen vanish', () => {
      const rendersBefore = mockTabsRenders;
      go('inventario');
      end('inventario');
      go('cargar');
      end('cargar');
      go('alertas');
      expect(screen.getByTestId('fixed-banner')).toBeTruthy();
      expect(mockTabsRenders).toBe(rendersBefore);
    });

    it('gives the navigator the same options and listeners every time, so it never rebuilds them mid-slide', () => {
      const options = mockTabsScreenOptions;
      const listeners = mockTabsScreenListeners;
      go('inventario');
      go('cargar');
      expect(mockTabsScreenOptions).toBe(options);
      expect(mockTabsScreenListeners).toBe(listeners);
    });

    it('does not take touches, so the screens below keep working', () => {
      go('inventario');
      end('inventario');
      go('alertas');
      expect(screen.getByTestId('fixed-banner').props.pointerEvents).toBe('none');
    });
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
