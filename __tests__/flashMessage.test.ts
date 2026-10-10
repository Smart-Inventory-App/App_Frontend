import { clearFlashMessage, peekFlashMessage, setFlashMessage } from '@/utils/flashMessage';

describe('flashMessage', () => {
  afterEach(() => {
    clearFlashMessage();
    jest.useRealTimers();
  });

  it('returns null when nothing was set', () => {
    expect(peekFlashMessage()).toBeNull();
  });

  it('keeps the message across several peeks until it is cleared', () => {
    setFlashMessage('register.accountCreated');
    expect(peekFlashMessage()).toBe('register.accountCreated');
    expect(peekFlashMessage()).toBe('register.accountCreated');
    clearFlashMessage();
    expect(peekFlashMessage()).toBeNull();
  });

  it('expires stale messages', () => {
    jest.useFakeTimers();
    setFlashMessage('register.accountCreated');
    jest.advanceTimersByTime(11000);
    expect(peekFlashMessage()).toBeNull();
  });
});
