import React from 'react';
import { StyleSheet } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import PerfilScreen from '../app/(tabs)/perfil';
import { profileService, UserProfile } from '@/services/profileService';
import { changeLanguage } from '@/i18n';
import { ensureNotificationPermission, getNotificationPermission } from '@/services/notificationPermission';

const mockReplace = jest.fn();
const mockNavigate = jest.fn();
const mockLogout = jest.fn();
let mockFocusCallback: () => void = () => {};

jest.mock('expo-router', () => {
  const ReactActual = require('react');
  return {
    router: { replace: (...args: any[]) => mockReplace(...args), navigate: (...args: any[]) => mockNavigate(...args) },
    useFocusEffect: (cb: () => void) => {
      mockFocusCallback = cb;
      ReactActual.useEffect(cb, [cb]);
    },
  };
});

jest.mock('@/services/notificationPermission', () => ({
  getNotificationPermission: jest.fn(),
  ensureNotificationPermission: jest.fn(),
}));

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

// Hora UTC que se guarda para una hora de Argentina (UTC-3)
const utcHourOf = (argentinaHour: number) => (argentinaHour + 3) % 24;

const startEditing = () => {
  fireEvent.press(screen.UNSAFE_getAllByType(Ionicons).find((n: any) => n.props.name === 'pencil'));
};
const startEditingIfNeeded = () => {
  if (!screen.queryByText('Guardar')) startEditing();
};

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  mockedProfileService.getProfile.mockResolvedValue(baseProfile());
  // Por defecto el teléfono ya dio el permiso de notificaciones
  (getNotificationPermission as jest.Mock).mockResolvedValue({ granted: true, canAskAgain: true });
  (ensureNotificationPermission as jest.Mock).mockResolvedValue('granted');
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

    startEditing();

    fireEvent.changeText(screen.getByDisplayValue('Ana'), 'Anita');
    mockedProfileService.updateProfile.mockResolvedValue(baseProfile({ firstName: 'Anita' }));

    await act(async () => {
      fireEvent.press(screen.getByText('Guardar'));
    });

    expect(mockedProfileService.updateProfile).toHaveBeenCalledWith('Anita', 'Perez', 'ana', 7, 7, utcHourOf(5), 'individuo');
    expect(screen.getByText('Perfil actualizado')).toBeTruthy();
    expect(screen.queryByText('Guardar')).toBeNull();
  });

  it('shows an error message when saving the profile fails', async () => {
    render(<PerfilScreen />);
    await waitFor(() => expect(screen.getByText('Ana')).toBeTruthy());
    startEditing();
    mockedProfileService.updateProfile.mockRejectedValue(new Error('boom'));
    await act(async () => {
      fireEvent.press(screen.getByText('Guardar'));
    });
    expect(screen.getByText('No se pudo actualizar el perfil')).toBeTruthy();
    expect(screen.getByText('Guardar')).toBeTruthy();
  });

  it('cancels editing, discarding every change', async () => {
    render(<PerfilScreen />);
    await waitFor(() => expect(screen.getByText('Ana')).toBeTruthy());
    startEditing();
    fireEvent.changeText(screen.getByDisplayValue('Ana'), 'Cambio');
    fireEvent.changeText(screen.getByTestId('coverage-days-input'), '30');
    fireEvent.press(screen.getByTestId('user-type-comercio'));
    fireEvent.press(screen.getByText('Cancelar'));
    expect(mockedProfileService.updateProfile).not.toHaveBeenCalled();
    expect(screen.getByText('Ana')).toBeTruthy();
    expect(screen.getByTestId('coverage-days-value').props.children.join('')).toContain('7');
    expect(screen.getByText('Consumidor final')).toBeTruthy();
    startEditing();
    expect(screen.getByTestId('coverage-days-input').props.value).toBe('7');
    expect(screen.getByDisplayValue('Ana')).toBeTruthy();
  });

  it('shows the settings already filled in, not as inputs or buttons', async () => {
    render(<PerfilScreen />);
    await waitFor(() => expect(screen.getByText('Ana')).toBeTruthy());
    expect(screen.queryByTestId('coverage-days-input')).toBeNull();
    expect(screen.queryByTestId('expiry-days-input')).toBeNull();
    expect(screen.queryByTestId('alert-hour-input')).toBeNull();
    expect(screen.queryByTestId('user-type-individuo')).toBeNull();
    expect(screen.queryByTestId('user-type-comercio')).toBeNull();
    expect(screen.getByTestId('coverage-days-value').props.children.join('')).toBe('7 días');
    expect(screen.getByTestId('expiry-days-value').props.children.join('')).toBe('7 días');
    expect(screen.getByTestId('alert-hour-value').props.children).toBe('05:00 hs · Hora de Argentina (UTC-3)');
  });

  it('shows the account type in a highlighted box as wide as the screen, which is not a button', async () => {
    const { Colors } = require('../src/constants/colors');
    mockedProfileService.getProfile.mockResolvedValue(baseProfile({ userType: 'comercio' }));
    render(<PerfilScreen />);
    await waitFor(() => expect(screen.getByTestId('user-type-display')).toBeTruthy());
    const box = StyleSheet.flatten(screen.getByTestId('user-type-display').props.style);
    expect(box.width).toBe('100%');
    expect(box.backgroundColor).toBe(Colors.primary);
    expect(box.paddingVertical).toBe(10);
    expect(screen.getByText('Comercio')).toBeTruthy();
    expect(screen.queryByText('Consumidor final')).toBeNull();
    expect(screen.getByTestId('user-type-display').props.onPress).toBeUndefined();
  });

  it('lets the user edit the settings only while editing the profile', async () => {
    render(<PerfilScreen />);
    await waitFor(() => expect(screen.getByText('Ana')).toBeTruthy());
    startEditing();
    expect(screen.getByTestId('coverage-days-input').props.value).toBe('7');
    expect(screen.getByTestId('expiry-days-input').props.value).toBe('7');
    expect(screen.getByTestId('alert-hour-input')).toBeTruthy();
    expect(screen.getByTestId('user-type-individuo')).toBeTruthy();
    expect(screen.getByTestId('user-type-comercio')).toBeTruthy();
    expect(screen.queryByTestId('user-type-display')).toBeNull();
  });

  it('saves the account type and the alert settings together with the personal data', async () => {
    mockedProfileService.updateProfile.mockResolvedValue(baseProfile({ userType: 'comercio', coverageDaysThreshold: 10 }));
    render(<PerfilScreen />);
    await waitFor(() => expect(screen.getByText('Ana')).toBeTruthy());
    startEditing();
    fireEvent.press(screen.getByTestId('user-type-comercio'));
    fireEvent.changeText(screen.getByTestId('coverage-days-input'), '10');
    fireEvent.changeText(screen.getByTestId('expiry-days-input'), '5');
    fireEvent.changeText(screen.getByTestId('alert-hour-input'), '9');
    fireEvent.changeText(screen.getByDisplayValue('Perez'), 'Gomez');
    fireEvent.changeText(screen.getByDisplayValue('ana'), 'anita');
    await act(async () => {
      fireEvent.press(screen.getByText('Guardar'));
    });
    expect(mockedProfileService.updateProfile).toHaveBeenCalledWith('Ana', 'Gomez', 'anita', 10, 5, utcHourOf(9), 'comercio');
    expect(screen.getByText('Comercio')).toBeTruthy();
    expect(screen.getByTestId('coverage-days-value').props.children.join('')).toContain('10');
  });

  it('does not save invalid alert settings, and says so', async () => {
    render(<PerfilScreen />);
    await waitFor(() => expect(screen.getByText('Ana')).toBeTruthy());
    for (const [id, value] of [['coverage-days-input', '0'], ['expiry-days-input', ''], ['alert-hour-input', '24']]) {
      startEditingIfNeeded();
      fireEvent.changeText(screen.getByTestId(id), value);
      await act(async () => {
        fireEvent.press(screen.getByText('Guardar'));
      });
      expect(screen.getByText(/Revisá los valores/)).toBeTruthy();
      fireEvent.press(screen.getByText('Cancelar'));
    }
    expect(mockedProfileService.updateProfile).not.toHaveBeenCalled();
  });

  it('hides the language, notifications and logout buttons while editing the profile', async () => {
    render(<PerfilScreen />);
    await waitFor(() => expect(screen.getByText('Ana')).toBeTruthy());
    expect(screen.getByText(/Idioma:/)).toBeTruthy();
    startEditing();
    expect(screen.queryByText(/Idioma:/)).toBeNull();
    expect(screen.queryByText(/Notificaciones:/)).toBeNull();
    expect(screen.queryByText('Cerrar sesión')).toBeNull();
    fireEvent.press(screen.getByText('Cancelar'));
    expect(screen.getByText(/Idioma:/)).toBeTruthy();
    expect(screen.getByText(/Notificaciones:/)).toBeTruthy();
    expect(screen.getByText('Cerrar sesión')).toBeTruthy();
  });

  it('puts save and cancel below every field, and the settings below the personal data', async () => {
    render(<PerfilScreen />);
    await waitFor(() => expect(screen.getByText('Ana')).toBeTruthy());
    startEditing();
    const tree = JSON.stringify(screen.toJSON());
    expect(tree.indexOf('Usuario')).toBeLessThan(tree.indexOf('coverage-days-input'));
    expect(tree.indexOf('alert-hour-input')).toBeLessThan(tree.indexOf('Guardar'));
    expect(tree.indexOf('Guardar')).toBeLessThan(tree.indexOf('Cancelar'));
  });

  it('leaves the editing mode when coming back to the screen', async () => {
    render(<PerfilScreen />);
    await waitFor(() => expect(screen.getByText('Ana')).toBeTruthy());
    startEditing();
    expect(screen.getByText('Guardar')).toBeTruthy();
    act(() => { mockFocusCallback(); });
    await waitFor(() => expect(screen.queryByText('Guardar')).toBeNull());
  });

  it('brings the avatar closer to the banner', async () => {
    render(<PerfilScreen />);
    await waitFor(() => expect(screen.getByText('Ana')).toBeTruthy());
    expect(StyleSheet.flatten(screen.getByTestId('profile-avatar').props.style).marginTop).toBeLessThan(32);
  });

  it('shows the alert check hour in Argentine time (the server keeps it in UTC)', async () => {
    mockedProfileService.getProfile.mockResolvedValue(baseProfile({ alertCheckHour: 11 }));
    render(<PerfilScreen />);
    await waitFor(() => expect(screen.getByTestId('alert-hour-value')).toBeTruthy());
    expect(screen.getByTestId('alert-hour-value').props.children).toBe('08:00 hs · Hora de Argentina (UTC-3)');
    startEditing();
    expect(screen.getByTestId('alert-hour-input').props.value).toBe('8');
    expect(screen.getByText('Hora de Argentina (UTC-3)')).toBeTruthy();
  });

  it('asks for confirmation before changing the language, and changes it once confirmed', async () => {
    render(<PerfilScreen />);
    await waitFor(() => expect(screen.getByText('Ana')).toBeTruthy());
    fireEvent.press(screen.getByText(/Idioma:/));
    expect(screen.getByText('Se va a cambiar el idioma a English.')).toBeTruthy();
    expect(changeLanguage).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent.press(screen.getByText('Confirmar'));
    });
    expect(changeLanguage).toHaveBeenCalledWith('en');
    expect(screen.queryByText('Se va a cambiar el idioma a English.')).toBeNull();
  });

  it('does not change the language when the confirmation is cancelled', async () => {
    render(<PerfilScreen />);
    await waitFor(() => expect(screen.getByText('Ana')).toBeTruthy());
    fireEvent.press(screen.getByText(/Idioma:/));
    fireEvent.press(screen.getByText('Cancelar'));
    expect(changeLanguage).not.toHaveBeenCalled();
    expect(screen.queryByText('Se va a cambiar el idioma a English.')).toBeNull();
  });

  it('activates notifications right away, without asking', async () => {
    mockedProfileService.activateNotifications.mockResolvedValue(true);
    render(<PerfilScreen />);
    await waitFor(() => expect(screen.getByText('Ana')).toBeTruthy());
    expect(screen.getByText(/Desactivadas/)).toBeTruthy();
    await act(async () => {
      fireEvent.press(screen.getByText(/Notificaciones:/));
    });
    expect(screen.queryByText('¿Estás seguro de desactivar las notificaciones?')).toBeNull();
    expect(mockedProfileService.activateNotifications).toHaveBeenCalled();
    await waitFor(() => expect(screen.getByText(/Activadas/)).toBeTruthy());
    await expect(AsyncStorage.getItem('notificationsEnabled')).resolves.toBe('true');
  });

  it('asks for confirmation before turning the notifications off, and does it once confirmed', async () => {
    await AsyncStorage.setItem('notificationsEnabled', JSON.stringify(true));
    mockedProfileService.deactivateNotifications.mockResolvedValue(true);
    render(<PerfilScreen />);
    await waitFor(() => expect(screen.getByText(/Activadas/)).toBeTruthy());
    fireEvent.press(screen.getByText(/Notificaciones:/));
    expect(screen.getByText('¿Estás seguro de desactivar las notificaciones?')).toBeTruthy();
    expect(mockedProfileService.deactivateNotifications).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent.press(screen.getByText('Confirmar'));
    });
    expect(mockedProfileService.deactivateNotifications).toHaveBeenCalled();
    await waitFor(() => expect(screen.getByText(/Desactivadas/)).toBeTruthy());
  });

  it('keeps the notifications on when the confirmation is cancelled', async () => {
    await AsyncStorage.setItem('notificationsEnabled', JSON.stringify(true));
    render(<PerfilScreen />);
    await waitFor(() => expect(screen.getByText(/Activadas/)).toBeTruthy());
    fireEvent.press(screen.getByText(/Notificaciones:/));
    fireEvent.press(screen.getByText('Cancelar'));
    expect(mockedProfileService.deactivateNotifications).not.toHaveBeenCalled();
    expect(screen.getByText(/Activadas/)).toBeTruthy();
    expect(screen.queryByText('¿Estás seguro de desactivar las notificaciones?')).toBeNull();
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

  it('asks for confirmation before logging out, and does nothing if cancelled', async () => {
    render(<PerfilScreen />);
    await waitFor(() => expect(screen.getByText('Ana')).toBeTruthy());
    expect(screen.queryByText('¿Estás seguro que querés cerrar sesión?')).toBeNull();
    fireEvent.press(screen.getByText('Cerrar sesión'));
    expect(screen.getByText('¿Estás seguro que querés cerrar sesión?')).toBeTruthy();
    expect(mockLogout).not.toHaveBeenCalled();
    fireEvent.press(screen.getByText('Cancelar'));
    expect(screen.queryByText('¿Estás seguro que querés cerrar sesión?')).toBeNull();
    expect(mockLogout).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('logs out and navigates to login once the user confirms', async () => {
    render(<PerfilScreen />);
    await waitFor(() => expect(screen.getByText('Ana')).toBeTruthy());
    fireEvent.press(screen.getByText('Cerrar sesión'));
    await act(async () => {
      fireEvent.press(screen.getByText('Cerrar'));
    });
    expect(mockLogout).toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith('/(auth)/login');
    expect(screen.queryByText('¿Estás seguro que querés cerrar sesión?')).toBeNull();
  });
});

describe('PerfilScreen - header', () => {
  it('shows the home icon on the left and "Perfil" on the right, and the icon goes home', async () => {
    mockedProfileService.getProfile.mockResolvedValue(baseProfile());
    render(<PerfilScreen />);
    await waitFor(() => expect(screen.getByText('Perfil')).toBeTruthy());
    const tree = JSON.stringify(screen.toJSON());
    expect(tree.indexOf('header-home')).toBeLessThan(tree.indexOf('"Perfil"'));
    fireEvent.press(screen.getByTestId('header-home'));
    expect(mockNavigate).toHaveBeenCalledWith('/(tabs)/');
  });

  it('puts the banner above the rest of the profile', async () => {
    mockedProfileService.getProfile.mockResolvedValue(baseProfile());
    render(<PerfilScreen />);
    await waitFor(() => expect(screen.getByTestId('screen-header')).toBeTruthy());
    const tree = JSON.stringify(screen.toJSON());
    expect(tree.indexOf('screen-header')).toBeLessThan(tree.indexOf('Cerrar sesión'));
    expect(tree.indexOf('screen-header')).toBeLessThan(tree.indexOf('ana'));
  });
});

describe('PerfilScreen - limits of the fields', () => {
  const LONG = 'Maximiliano Alejandro Rodriguez Gonzalez';

  it('shows the first 20 characters followed by "..." when the name, last name or username are longer', async () => {
    mockedProfileService.getProfile.mockResolvedValue(baseProfile({ firstName: LONG, lastName: LONG, username: LONG }));
    render(<PerfilScreen />);
    await waitFor(() => expect(screen.getAllByText('Maximiliano Alejandr...').length).toBe(3));
    expect(screen.queryByText(LONG)).toBeNull();
  });

  it('shows short values untouched, and exactly 20 characters without dots', async () => {
    mockedProfileService.getProfile.mockResolvedValue(baseProfile({ firstName: 'a'.repeat(20), lastName: 'Perez', username: 'ana' }));
    render(<PerfilScreen />);
    await waitFor(() => expect(screen.getByText('a'.repeat(20))).toBeTruthy());
    expect(screen.getByText('Perez')).toBeTruthy();
  });

  it('edits a long name with its first 20 characters', async () => {
    mockedProfileService.getProfile.mockResolvedValue(baseProfile({ firstName: LONG }));
    render(<PerfilScreen />);
    await waitFor(() => expect(screen.getByText('Maximiliano Alejandr...')).toBeTruthy());
    startEditing();
    expect(screen.getByTestId('first-name-input').props.value).toBe('Maximiliano Alejandr');
    expect(screen.getByTestId('first-name-counter').props.children.join('')).toBe('20/20');
  });

  it('limits the name, last name and username to 20 characters', async () => {
    render(<PerfilScreen />);
    await waitFor(() => expect(screen.getByText('Ana')).toBeTruthy());
    startEditing();
    ['first-name-input', 'last-name-input', 'username-input'].forEach(id => {
      expect(screen.getByTestId(id).props.maxLength).toBe(20);
    });
  });

  it('shows a counter under each of the three fields that follows what is typed', async () => {
    render(<PerfilScreen />);
    await waitFor(() => expect(screen.getByText('Ana')).toBeTruthy());
    expect(screen.queryByTestId('first-name-counter')).toBeNull();
    startEditing();
    const counter = (id: string) => screen.getByTestId(id).props.children.join('');
    expect(counter('first-name-counter')).toBe('3/20');
    expect(counter('last-name-counter')).toBe('5/20');
    expect(counter('username-counter')).toBe('3/20');
    fireEvent.changeText(screen.getByTestId('first-name-input'), 'Maria Fernanda Lopez');
    expect(counter('first-name-counter')).toBe('20/20');
    fireEvent.changeText(screen.getByTestId('username-input'), '');
    expect(counter('username-counter')).toBe('0/20');
  });

  it('says under each number field which numbers are accepted', async () => {
    render(<PerfilScreen />);
    await waitFor(() => expect(screen.getByText('Ana')).toBeTruthy());
    expect(screen.queryByTestId('coverage-days-hint')).toBeNull();
    startEditing();
    expect(screen.getByTestId('coverage-days-hint').props.children).toBe('Se aceptan números entre 2 y 90 (inclusive).');
    expect(screen.getByTestId('expiry-days-hint').props.children).toBe('Se aceptan números entre 2 y 90 (inclusive).');
    expect(screen.getByTestId('alert-hour-hint').props.children).toBe('Se aceptan números entre 0 y 23 (inclusive).');
  });

  it('puts the hint right below its own field', async () => {
    render(<PerfilScreen />);
    await waitFor(() => expect(screen.getByText('Ana')).toBeTruthy());
    startEditing();
    const tree = JSON.stringify(screen.toJSON());
    const at = (id: string) => tree.indexOf(`"${id}"`);
    expect(at('coverage-days-input')).toBeLessThan(at('coverage-days-hint'));
    expect(at('coverage-days-hint')).toBeLessThan(at('expiry-days-input'));
    expect(at('expiry-days-input')).toBeLessThan(at('expiry-days-hint'));
    expect(at('expiry-days-hint')).toBeLessThan(at('alert-hour-input'));
    expect(at('alert-hour-input')).toBeLessThan(at('alert-hour-hint'));
  });

  it('moves the days and the hour with the up and down buttons, and saves them', async () => {
    mockedProfileService.updateProfile.mockResolvedValue(baseProfile());
    render(<PerfilScreen />);
    await waitFor(() => expect(screen.getByText('Ana')).toBeTruthy());
    startEditing();
    fireEvent.press(screen.getByTestId('coverage-days-input-up'));
    fireEvent.press(screen.getByTestId('coverage-days-input-up'));
    fireEvent.press(screen.getByTestId('expiry-days-input-down'));
    fireEvent.press(screen.getByTestId('alert-hour-input-up'));
    expect(screen.getByTestId('coverage-days-input').props.value).toBe('9');
    expect(screen.getByTestId('expiry-days-input').props.value).toBe('6');
    expect(screen.getByTestId('alert-hour-input').props.value).toBe('6');
    await act(async () => {
      fireEvent.press(screen.getByText('Guardar'));
    });
    expect(mockedProfileService.updateProfile).toHaveBeenCalledWith('Ana', 'Perez', 'ana', 9, 6, utcHourOf(6), 'individuo');
  });

  it('stops at 2 and 90 for the days, and at 0 and 23 for the hour', async () => {
    render(<PerfilScreen />);
    await waitFor(() => expect(screen.getByText('Ana')).toBeTruthy());
    startEditing();
    fireEvent.changeText(screen.getByTestId('coverage-days-input'), '90');
    fireEvent.press(screen.getByTestId('coverage-days-input-up'));
    expect(screen.getByTestId('coverage-days-input').props.value).toBe('90');
    fireEvent.changeText(screen.getByTestId('expiry-days-input'), '2');
    fireEvent.press(screen.getByTestId('expiry-days-input-down'));
    expect(screen.getByTestId('expiry-days-input').props.value).toBe('2');
    fireEvent.changeText(screen.getByTestId('alert-hour-input'), '23');
    fireEvent.press(screen.getByTestId('alert-hour-input-up'));
    expect(screen.getByTestId('alert-hour-input').props.value).toBe('23');
    fireEvent.changeText(screen.getByTestId('alert-hour-input'), '0');
    fireEvent.press(screen.getByTestId('alert-hour-input-down'));
    expect(screen.getByTestId('alert-hour-input').props.value).toBe('0');
  });

  it.each([
    ['coverage-days-input', '1'],
    ['coverage-days-input', '91'],
    ['expiry-days-input', '0'],
    ['expiry-days-input', '99'],
    ['alert-hour-input', '24'],
  ])('does not save a typed %s of %s, and says so', async (id, value) => {
    render(<PerfilScreen />);
    await waitFor(() => expect(screen.getByText('Ana')).toBeTruthy());
    startEditing();
    fireEvent.changeText(screen.getByTestId(id), value);
    await act(async () => {
      fireEvent.press(screen.getByText('Guardar'));
    });
    expect(screen.getByText('Revisá los valores: los días deben estar entre 2 y 90 y la hora entre 0 y 23')).toBeTruthy();
    expect(mockedProfileService.updateProfile).not.toHaveBeenCalled();
  });

  it.each(['2', '90'])('saves the day limit %s', async value => {
    mockedProfileService.updateProfile.mockResolvedValue(baseProfile());
    render(<PerfilScreen />);
    await waitFor(() => expect(screen.getByText('Ana')).toBeTruthy());
    startEditing();
    fireEvent.changeText(screen.getByTestId('coverage-days-input'), value);
    await act(async () => {
      fireEvent.press(screen.getByText('Guardar'));
    });
    expect(mockedProfileService.updateProfile).toHaveBeenCalled();
  });

  it('uses 7 days when the saved days are outside 2 to 90, in the view and in the edition', async () => {
    mockedProfileService.getProfile.mockResolvedValue(baseProfile({ coverageDaysThreshold: 1, expiryDaysThreshold: 91 }));
    render(<PerfilScreen />);
    await waitFor(() => expect(screen.getByTestId('coverage-days-value')).toBeTruthy());
    expect(screen.getByTestId('coverage-days-value').props.children.join('')).toBe('7 días');
    expect(screen.getByTestId('expiry-days-value').props.children.join('')).toBe('7 días');
    startEditing();
    expect(screen.getByTestId('coverage-days-input').props.value).toBe('7');
    expect(screen.getByTestId('expiry-days-input').props.value).toBe('7');
  });

  it('keeps the saved days when they are inside the range', async () => {
    mockedProfileService.getProfile.mockResolvedValue(baseProfile({ coverageDaysThreshold: 2, expiryDaysThreshold: 90 }));
    render(<PerfilScreen />);
    await waitFor(() => expect(screen.getByTestId('coverage-days-value')).toBeTruthy());
    expect(screen.getByTestId('coverage-days-value').props.children.join('')).toBe('2 días');
    expect(screen.getByTestId('expiry-days-value').props.children.join('')).toBe('90 días');
  });

  it('uses the hour 5 when the saved hour is not a valid hour', async () => {
    mockedProfileService.getProfile.mockResolvedValue(baseProfile({ alertCheckHour: undefined as any }));
    render(<PerfilScreen />);
    await waitFor(() => expect(screen.getByTestId('alert-hour-value')).toBeTruthy());
    expect(screen.getByTestId('alert-hour-value').props.children).toBe('05:00 hs · Hora de Argentina (UTC-3)');
    startEditing();
    expect(screen.getByTestId('alert-hour-input').props.value).toBe('5');
  });
});

describe('PerfilScreen - permission of the notifications', () => {
  const NOTICE = 'Para activar las notificaciones de la aplicación, ve a Ajustes y otorga los permisos';
  const ungranted = () => (getNotificationPermission as jest.Mock).mockResolvedValue({ granted: false, canAskAgain: true });

  const openWithEnabled = async () => {
    await AsyncStorage.setItem('notificationsEnabled', JSON.stringify(true));
    render(<PerfilScreen />);
    await waitFor(() => expect(screen.getByText('Ana')).toBeTruthy());
  };

  it('does not ask for anything when the button says "Activadas" and the phone already gave the permission', async () => {
    await openWithEnabled();
    expect(screen.getByText(/Activadas/)).toBeTruthy();
    expect(ensureNotificationPermission).not.toHaveBeenCalled();
  });

  it('does not check the permission when the button says "Desactivadas"', async () => {
    render(<PerfilScreen />);
    await waitFor(() => expect(screen.getByText('Ana')).toBeTruthy());
    expect(getNotificationPermission).not.toHaveBeenCalled();
  });

  it('shows the request of the system when the button says "Activadas" but the permission was not given', async () => {
    ungranted();
    await openWithEnabled();
    await waitFor(() => expect(ensureNotificationPermission).toHaveBeenCalledTimes(1));
  });

  it('keeps the notifications on, registering the phone again, when the user gives the permission', async () => {
    ungranted();
    mockedProfileService.activateNotifications.mockResolvedValue(true);
    await openWithEnabled();
    await waitFor(() => expect(mockedProfileService.activateNotifications).toHaveBeenCalled());
    expect(screen.getByText(/Activadas/)).toBeTruthy();
    expect(screen.queryByText(NOTICE)).toBeNull();
  });

  it('turns the button to "Desactivadas" when the user refuses the request, without any notice', async () => {
    ungranted();
    (ensureNotificationPermission as jest.Mock).mockResolvedValue('denied');
    mockedProfileService.deactivateNotifications.mockResolvedValue(true);
    await openWithEnabled();
    await waitFor(() => expect(screen.getByText(/Desactivadas/)).toBeTruthy());
    await expect(AsyncStorage.getItem('notificationsEnabled')).resolves.toBe('false');
    expect(mockedProfileService.deactivateNotifications).toHaveBeenCalled();
    expect(screen.queryByText(NOTICE)).toBeNull();
  });

  it('tells the user to go to Settings, with a "Continuar" button, when the permission was blocked for good', async () => {
    ungranted();
    (ensureNotificationPermission as jest.Mock).mockResolvedValue('blocked');
    mockedProfileService.deactivateNotifications.mockResolvedValue(true);
    await openWithEnabled();
    await waitFor(() => expect(screen.getByText(NOTICE)).toBeTruthy());
    expect(screen.getByText(/Desactivadas/)).toBeTruthy();
    fireEvent.press(screen.getByText('Continuar'));
    expect(screen.queryByText(NOTICE)).toBeNull();
  });

  it('still turns the button off when the server can not be reached', async () => {
    ungranted();
    (ensureNotificationPermission as jest.Mock).mockResolvedValue('denied');
    mockedProfileService.deactivateNotifications.mockRejectedValue(new Error('down'));
    await openWithEnabled();
    await waitFor(() => expect(screen.getByText(/Desactivadas/)).toBeTruthy());
  });

  it('checks again every time the user comes back to the profile', async () => {
    await openWithEnabled();
    expect(getNotificationPermission).toHaveBeenCalledTimes(1);
    ungranted();
    (ensureNotificationPermission as jest.Mock).mockResolvedValue('denied');
    mockedProfileService.deactivateNotifications.mockResolvedValue(true);
    await act(async () => { mockFocusCallback(); });
    await waitFor(() => expect(screen.getByText(/Desactivadas/)).toBeTruthy());
  });

  it('asks for the permission before turning the notifications on, and turns them on when it is given', async () => {
    mockedProfileService.activateNotifications.mockResolvedValue(true);
    render(<PerfilScreen />);
    await waitFor(() => expect(screen.getByText('Ana')).toBeTruthy());
    await act(async () => {
      fireEvent.press(screen.getByText(/Notificaciones:/));
    });
    expect(ensureNotificationPermission).toHaveBeenCalledTimes(1);
    expect(mockedProfileService.activateNotifications).toHaveBeenCalled();
    await waitFor(() => expect(screen.getByText(/Activadas/)).toBeTruthy());
  });

  it('does not turn the notifications on, nor say anything, when the user refuses the request', async () => {
    (ensureNotificationPermission as jest.Mock).mockResolvedValue('denied');
    render(<PerfilScreen />);
    await waitFor(() => expect(screen.getByText('Ana')).toBeTruthy());
    await act(async () => {
      fireEvent.press(screen.getByText(/Notificaciones:/));
    });
    expect(mockedProfileService.activateNotifications).not.toHaveBeenCalled();
    expect(screen.getByText(/Desactivadas/)).toBeTruthy();
    expect(screen.queryByText(NOTICE)).toBeNull();
  });

  it('tells the user to go to Settings when pressing the button and the permission was blocked for good', async () => {
    (ensureNotificationPermission as jest.Mock).mockResolvedValue('blocked');
    render(<PerfilScreen />);
    await waitFor(() => expect(screen.getByText('Ana')).toBeTruthy());
    await act(async () => {
      fireEvent.press(screen.getByText(/Notificaciones:/));
    });
    expect(screen.getByText(NOTICE)).toBeTruthy();
    expect(mockedProfileService.activateNotifications).not.toHaveBeenCalled();
    expect(screen.getByText(/Desactivadas/)).toBeTruthy();
    fireEvent.press(screen.getByText('Continuar'));
    expect(screen.queryByText(NOTICE)).toBeNull();
  });
});

describe('PerfilScreen - the hour of the daily check', () => {
  it('shows the hour with two digits, saying it is Argentine time, with nothing else under it', async () => {
    render(<PerfilScreen />);
    await waitFor(() => expect(screen.getByTestId('alert-hour-value')).toBeTruthy());
    expect(screen.getByTestId('alert-hour-value').props.children).toBe('05:00 hs · Hora de Argentina (UTC-3)');
    expect(screen.queryByTestId('alert-hour-utc')).toBeNull();
    expect(screen.queryByText(/hs UTC/)).toBeNull();
  });

  it('shows hours past noon too, as saved in UTC and as Argentine time', async () => {
    mockedProfileService.getProfile.mockResolvedValue(baseProfile({ alertCheckHour: 22 }));
    render(<PerfilScreen />);
    await waitFor(() => expect(screen.getByTestId('alert-hour-value')).toBeTruthy());
    expect(screen.getByTestId('alert-hour-value').props.children).toBe('19:00 hs · Hora de Argentina (UTC-3)');
  });

  it('wraps the hours around midnight', async () => {
    mockedProfileService.getProfile.mockResolvedValue(baseProfile({ alertCheckHour: 1 }));
    render(<PerfilScreen />);
    await waitFor(() => expect(screen.getByTestId('alert-hour-value')).toBeTruthy());
    expect(screen.getByTestId('alert-hour-value').props.children).toBe('22:00 hs · Hora de Argentina (UTC-3)');
  });

  it('shows only the range hint under the field while editing, with no message about when the alerts are checked', async () => {
    render(<PerfilScreen />);
    await waitFor(() => expect(screen.getByText('Ana')).toBeTruthy());
    startEditing();
    expect(screen.getByTestId('alert-hour-hint').props.children).toBe('Se aceptan números entre 0 y 23 (inclusive).');
    expect(screen.queryByTestId('alert-hour-preview')).toBeNull();
    fireEvent.changeText(screen.getByTestId('alert-hour-input'), '20');
    expect(screen.queryByTestId('alert-hour-preview')).toBeNull();
    expect(screen.queryByText(/se van a revisar/)).toBeNull();
  });
});

describe('PerfilScreen - color of the confirm buttons', () => {
  const background = () => StyleSheet.flatten(screen.getByTestId('confirm-accept').props.style).backgroundColor;

  it('is the teal of the app when confirming a change of language', async () => {
    const { Colors } = require('../src/constants/colors');
    render(<PerfilScreen />);
    await waitFor(() => expect(screen.getByText('Ana')).toBeTruthy());
    fireEvent.press(screen.getByText(/Idioma:/));
    expect(background()).toBe(Colors.primary);
  });

  it('is the teal of the app when confirming to turn the notifications off', async () => {
    const { Colors } = require('../src/constants/colors');
    await AsyncStorage.setItem('notificationsEnabled', JSON.stringify(true));
    render(<PerfilScreen />);
    await waitFor(() => expect(screen.getByText(/Activadas/)).toBeTruthy());
    fireEvent.press(screen.getByText(/Notificaciones:/));
    expect(background()).toBe(Colors.primary);
  });

  it('stays red when confirming to log out', async () => {
    const { Colors } = require('../src/constants/colors');
    render(<PerfilScreen />);
    await waitFor(() => expect(screen.getByText('Ana')).toBeTruthy());
    fireEvent.press(screen.getByText('Cerrar sesión'));
    expect(background()).toBe(Colors.error);
  });
});
