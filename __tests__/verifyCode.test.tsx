import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { TextInput } from 'react-native';
import VerifyCodeScreen from '../app/(auth)/verify-code';
import { authService } from '@/services/authService';

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockDismissAll = jest.fn();

jest.mock('expo-router', () => ({
  router: {
    push: (...args: any[]) => mockPush(...args),
    replace: (...args: any[]) => mockReplace(...args),
    dismissAll: (...args: any[]) => mockDismissAll(...args),
  },
  useLocalSearchParams: () => ({ email: 'a@b.com' }),
}));

jest.mock('../src/services/authService', () => ({
  authService: { verifyCode: jest.fn(), forgotPassword: jest.fn() },
}));

const mockedAuthService = authService as jest.Mocked<typeof authService>;

beforeEach(() => {
  jest.clearAllMocks();
});

function fillCode(digitBoxes: any[], code: string) {
  code.split('').forEach((d, i) => fireEvent.changeText(digitBoxes[i], d));
}

describe('VerifyCodeScreen', () => {
  it('does not submit an incomplete code', async () => {
    render(<VerifyCodeScreen />);
    const boxes = screen.UNSAFE_getAllByType(TextInput);
    fillCode(boxes, '123');
    await act(async () => {
      fireEvent.press(screen.getByText('Recuperar Cuenta'));
    });
    expect(mockedAuthService.verifyCode).not.toHaveBeenCalled();
  });

  it('verifies a full code and navigates to change-password', async () => {
    mockedAuthService.verifyCode.mockResolvedValue('reset-tok');
    render(<VerifyCodeScreen />);
    const boxes = screen.UNSAFE_getAllByType(TextInput);
    fillCode(boxes, '123456');
    await act(async () => {
      fireEvent.press(screen.getByText('Recuperar Cuenta'));
    });
    expect(mockedAuthService.verifyCode).toHaveBeenCalledWith('a@b.com', '123456');
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/(auth)/change-password', params: { reset_token: 'reset-tok' } });
  });

  it('shows an error for an invalid/expired code', async () => {
    mockedAuthService.verifyCode.mockRejectedValue(new Error('bad code'));
    render(<VerifyCodeScreen />);
    const boxes = screen.UNSAFE_getAllByType(TextInput);
    fillCode(boxes, '123456');
    await act(async () => {
      fireEvent.press(screen.getByText('Recuperar Cuenta'));
    });
    expect(screen.getByText('Código inválido o expirado')).toBeTruthy();
  });

  it('handles backspace to move focus to the previous box', () => {
    render(<VerifyCodeScreen />);
    const boxes = screen.UNSAFE_getAllByType(TextInput);
    fireEvent.changeText(boxes[0], '1');
    fireEvent(boxes[1], 'keyPress', { nativeEvent: { key: 'Backspace' } });
  });

  it('ignores backspace on the first box', () => {
    render(<VerifyCodeScreen />);
    const boxes = screen.UNSAFE_getAllByType(TextInput);
    fireEvent(boxes[0], 'keyPress', { nativeEvent: { key: 'Backspace' } });
  });

  it('resends the code, clearing the current digits', async () => {
    mockedAuthService.forgotPassword.mockResolvedValue(undefined);
    render(<VerifyCodeScreen />);
    const boxes = screen.UNSAFE_getAllByType(TextInput);
    fillCode(boxes, '123456');
    await act(async () => {
      fireEvent.press(screen.getByText('Reenviar Código'));
    });
    expect(mockedAuthService.forgotPassword).toHaveBeenCalledWith('a@b.com');
  });

  it('goes back to the initial login screen, clearing the recovery stack first', () => {
    const calls: string[] = [];
    mockDismissAll.mockImplementation(() => calls.push('dismissAll'));
    mockReplace.mockImplementation(() => calls.push('replace'));
    render(<VerifyCodeScreen />);
    fireEvent.press(screen.getByText('Volver al inicio de sesión'));
    expect(calls).toEqual(['dismissAll', 'replace']);
    expect(mockReplace).toHaveBeenCalledWith('/(auth)/login');
  });

  it('silently ignores a resend failure', async () => {
    mockedAuthService.forgotPassword.mockRejectedValue(new Error('boom'));
    render(<VerifyCodeScreen />);
    await act(async () => {
      fireEvent.press(screen.getByText('Reenviar Código'));
    });
  });

  it('strips non-digit characters and only keeps the last character typed', () => {
    render(<VerifyCodeScreen />);
    const boxes = screen.UNSAFE_getAllByType(TextInput);
    fireEvent.changeText(boxes[0], 'a9b');
    expect(boxes[0].props.value).toBe('9');
  });
});
