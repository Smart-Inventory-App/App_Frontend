import { requestAlertFilter, takeRequestedAlertFilter } from '@/utils/alertFilterRequest';

describe('alertFilterRequest', () => {
  it('has nothing requested at first', () => {
    expect(takeRequestedAlertFilter()).toBeNull();
  });

  it('gives the requested option once and then forgets it', () => {
    requestAlertFilter('Stock');
    expect(takeRequestedAlertFilter()).toBe('Stock');
    expect(takeRequestedAlertFilter()).toBeNull();
  });

  it('keeps only the last request', () => {
    requestAlertFilter('Stock');
    requestAlertFilter('Vencimiento');
    expect(takeRequestedAlertFilter()).toBe('Vencimiento');
  });
});
