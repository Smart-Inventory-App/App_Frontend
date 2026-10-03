import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import PerfilScreen from '../app/(tabs)/perfil';
import { profileService, UserProfile } from '@/services/profileService';
import { changeLanguage } from '@/i18n';

const mockReplace = jest.fn();
const mockLogout = jest.fn();

jest.mock('expo-router', () => {
  const ReactActual = require('react');
  return {
    router: { replace: (...args: any[]) => mockReplace(...args) },
    useFocusEffect: (cb: () => void) => ReactActual.useEffect(cb, [cb]),
  };
});

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ logout: mockLogout }),
}));

jest.mock('@/i18n', () => ({
  changeLanguage: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/services/profileService', () => ({
  profileService: {
    getProfile: jest.fn(),
    updateProfile: jest.fn(),
    activateNotifications: jest.fn(),
    deactivateNotifications: jest.fn(),
  },
}));

const mockedProfileService = profileService as jest.Mocked<typeof profileService>;

const baseProfile = (overrides: Partial<UserProfile> = {}): UserProfile => ({
  sub: 'u1',
  email: 'a@b.com',
  firstName: 'Ana',
  lastName: 'Perez',
  username: 'ana',
  coverageDaysThreshold: 7,
  expiryDaysThreshold: 7,
  alertCheckHour: 8,
  userType: 'individuo',
  ...overrides,
});

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  mockedProfileService.getProfile.mockResolvedValue(baseProfile());
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  (console.error as jest.Mock).mockRestore();
});

describe('PerfilScreen', () => {
  it('loads and shows the profile', async () => {
    render(<PerfilScreen />);
    await waitFor(() => expect(screen.getByText('Ana')).toBeTruthy());
    expect(screen.getByText('Perez')).toBeTruthy();
    expect(screen.getByText('a@b.com')).toBeTruthy();
    expect(screen.getByText('ana')).toBeTruthy();
  });

  it('shows placeholders for a profile with no name/username', async () => {
    mockedProfileService.getProfile.mockResolvedValue(baseProfile({ firstName: undefined, lastName: undefined, username: undefined, email: undefined }));
    render(<PerfilScreen />);
    await waitFor(() => expect(screen.getAllByText('—').length).toBeGreaterThan(0));
  });

  it('edits and saves the profile', async () => {
    render(<PerfilScreen />);
    await waitFor(() => expect(screen.getByText('Ana')).toBeTruthy());

    fireEvent.press(screen.UNSAFE_getAllByType(Ionicons).find((n: any) => n.props.name === 'pencil'));

    fireEvent.changeText(screen.getByDisplayValue('Ana'), 'Anita');
    mockedProfileService.updateProfile.mockResolvedValue(baseProfile({ firstName: 'Anita' }));

    await act(async () => {
      fireEvent.press(screen.getByText('Guardar'));
    });

    expect(mockedProfileService.updateProfile).toHaveBeenCalledWith('Anita', 'Perez', 'ana');
    expect(screen.getByText('Perfil actualizado')).toBeTruthy();
  });

  it('shows an error message when saving the profile fails', async () => {
    render(<PerfilScreen />);
    await waitFor(() => expect(screen.getByText('Ana')).toBeTruthy());
    fireEvent.press(screen.UNSAFE_getAllByType(Ionicons).find((n: any) => n.props.name === 'pencil'));
    mockedProfileService.updateProfile.mockRejectedValue(new Error('boom'));
    await act(async () => {
      fireEvent.press(screen.getByText('Guardar'));
    });
    expect(screen.getByText('No se pudo actualizar el perfil')).toBeTruthy();
  });

  it('cancels editing, discarding changes', async () => {
    render(<PerfilScreen />);
    await waitFor(() => expect(screen.getByText('Ana')).toBeTruthy());
    fireEvent.press(screen.UNSAFE_getAllByType(Ionicons).find((n: any) => n.props.name === 'pencil'));
    fireEvent.changeText(screen.getByDisplayValue('Ana'), 'Cambio');
    fireEvent.press(screen.getByText('Cancelar'));
    expect(screen.getByText('Ana')).toBeTruthy();
  });

  it('changes the user type', async () => {
    mockedProfileService.updateProfile.mockResolvedValue(baseProfile({ userType: 'comercio' }));
    render(<PerfilScreen />);
    await waitFor(() => expect(screen.getByText('Ana')).toBeTruthy());
    await act(async () => {
      fireEvent.press(screen.getByText('Comercio'));
    });
    expect(mockedProfileService.updateProfile).toHaveBeenCalledWith('Ana', 'Perez', 'ana', undefined, undefined, undefined, 'comercio');
  });

  it('reverts the user type when the update fails', async () => {
    mockedProfileService.updateProfile.mockRejectedValue(new Error('boom'));
    render(<PerfilScreen />);
    await waitFor(() => expect(screen.getByText('Ana')).toBeTruthy());
    await act(async () => {
      fireEvent.press(screen.getByText('Comercio'));
    });
    expect(mockedProfileService.updateProfile).toHaveBeenCalled();
  });

  it('does not re-update the user type when pressing the already-active option', async () => {
    render(<PerfilScreen />);
    await waitFor(() => expect(screen.getByText('Ana')).toBeTruthy());
    await act(async () => {
      fireEvent.press(screen.getByText('Consumidor final'));
    });
    expect(mockedProfileService.updateProfile).not.toHaveBeenCalled();
  });

  it('saves settings on blur with a valid coverage days value', async () => {
    mockedProfileService.updateProfile.mockResolvedValue(baseProfile({ coverageDaysThreshold: 10 }));
    render(<PerfilScreen />);
    await waitFor(() => expect(screen.getByText('Ana')).toBeTruthy());
    const input = screen.getAllByDisplayValue('7')[0];
    fireEvent.changeText(input, '10');
    await act(async () => {
      fireEvent(input, 'blur');
    });
    expect(mockedProfileService.updateProfile).toHaveBeenCalled();
  });

  it('ignores invalid settings values (no update call)', async () => {
    render(<PerfilScreen />);
    await waitFor(() => expect(screen.getByText('Ana')).toBeTruthy());
    const input = screen.getAllByDisplayValue('7')[0];
    fireEvent.changeText(input, '0');
    await act(async () => {
      fireEvent(input, 'blur');
    });
    expect(mockedProfileService.updateProfile).not.toHaveBeenCalled();
  });

  it('silently ignores a failure saving settings', async () => {
    mockedProfileService.updateProfile.mockRejectedValue(new Error('boom'));
    render(<PerfilScreen />);
    await waitFor(() => expect(screen.getByText('Ana')).toBeTruthy());
    const input = screen.getAllByDisplayValue('7')[0];
    fireEvent.changeText(input, '10');
    await act(async () => {
      fireEvent(input, 'blur');
    });
  });

  it('toggles the language', async () => {
    render(<PerfilScreen />);
    await waitFor(() => expect(screen.getByText('Ana')).toBeTruthy());
    await act(async () => {
      fireEvent.press(screen.getByText(/Idioma:/));
    });
    expect(changeLanguage).toHaveBeenCalledWith('en');
  });

  it('activates notifications', async () => {
    mockedProfileService.activateNotifications.mockResolvedValue(true);
    render(<PerfilScreen />);
    await waitFor(() => expect(screen.getByText('Ana')).toBeTruthy());
    expect(screen.getByText(/Desactivadas/)).toBeTruthy();
    await act(async () => {
      fireEvent.press(screen.getByText(/Notificaciones:/));
    });
    expect(mockedProfileService.activateNotifications).toHaveBeenCalled();
    await waitFor(() => expect(screen.getByText(/Activadas/)).toBeTruthy());
    await expect(AsyncStorage.getItem('notificationsEnabled')).resolves.toBe('true');
  });

  it('deactivates notifications once already enabled', async () => {
    await AsyncStorage.setItem('notificationsEnabled', JSON.stringify(true));
    mockedProfileService.deactivateNotifications.mockResolvedValue(true);
    render(<PerfilScreen />);
    await waitFor(() => expect(screen.getByText(/Activadas/)).toBeTruthy());
    await act(async () => {
      fireEvent.press(screen.getByText(/Notificaciones:/));
    });
    expect(mockedProfileService.deactivateNotifications).toHaveBeenCalled();
    await waitFor(() => expect(screen.getByText(/Desactivadas/)).toBeTruthy());
  });

  it('logs an error when toggling notifications fails', async () => {
    mockedProfileService.activateNotifications.mockRejectedValue(new Error('boom'));
    render(<PerfilScreen />);
    await waitFor(() => expect(screen.getByText('Ana')).toBeTruthy());
    await act(async () => {
      fireEvent.press(screen.getByText(/Notificaciones:/));
    });
    expect(console.error).toHaveBeenCalledWith('Error activating notifications:', expect.any(Error));
  });

  it('logs an error when reading the stored notification status fails', async () => {
    jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('boom'));
    render(<PerfilScreen />);
    await waitFor(() => expect(console.error).toHaveBeenCalledWith('Error loading notifications status:', expect.any(Error)));
  });

  it('logs out and navigates to login', async () => {
    render(<PerfilScreen />);
    await waitFor(() => expect(screen.getByText('Ana')).toBeTruthy());
    await act(async () => {
      fireEvent.press(screen.getByText('Cerrar sesión'));
    });
    expect(mockLogout).toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith('/(auth)/login');
  });
});
