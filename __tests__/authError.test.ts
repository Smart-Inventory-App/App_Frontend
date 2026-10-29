import { getAuthError } from '../src/utils/authError';
import { i18n } from '../src/i18n';

const t = i18n.getFixedT('es');

describe('getAuthError', () => {
  it('returns the generic fallback when detail is not a string', () => {
    expect(getAuthError(undefined, t)).toBe('Ocurrió un error inesperado');
    expect(getAuthError({ some: 'object' }, t)).toBe('Ocurrió un error inesperado');
  });

  it('returns a custom fallback when provided and detail is not a string', () => {
    expect(getAuthError(null, t, 'Mensaje custom')).toBe('Mensaje custom');
  });

  it('translates a known, namespaced auth error code', () => {
    expect(getAuthError('auth.invalid_credentials', t)).toBe('Email o contraseña incorrectos');
  });

  it('translates the too many attempts error of the recovery code', () => {
    expect(getAuthError('auth.too_many_attempts', t)).toBe('Demasiados intentos. Pedí un código nuevo');
  });

  it('falls back to generic when the code has no translation', () => {
    expect(getAuthError('this_code_does_not_exist', t)).toBe('Ocurrió un error inesperado');
  });

  it('falls back to a custom fallback when the code has no translation', () => {
    expect(getAuthError('this_code_does_not_exist', t, 'Fallback custom')).toBe('Fallback custom');
  });
});
