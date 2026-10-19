import { markWelcomeSeen, resetWelcome, shouldWelcome } from '../src/utils/welcomeState';

describe('welcomeState', () => {
  beforeEach(() => resetWelcome());

  it('welcomes the user when the app is opened', () => {
    expect(shouldWelcome()).toBe(true);
  });

  it('stops welcoming once the home was left', () => {
    markWelcomeSeen();
    expect(shouldWelcome()).toBe(false);
    markWelcomeSeen();
    expect(shouldWelcome()).toBe(false);
  });

  it('welcomes again after a new login', () => {
    markWelcomeSeen();
    resetWelcome();
    expect(shouldWelcome()).toBe(true);
  });
});
