import type { TFunction } from 'i18next';

export function getAuthError(detail: unknown, t: TFunction, fallback?: string): string {
  if (typeof detail !== 'string') return fallback ?? t('errors.generic');
  const key = `errors.${detail}` as any;
  const translated = t(key);
  return translated !== key ? translated : (fallback ?? t('errors.generic'));
}
