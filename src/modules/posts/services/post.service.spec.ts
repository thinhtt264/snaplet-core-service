import { buildReactionHistory } from '../utils/reaction-history.util';

describe('reaction history util', () => {
  it('prepends newest emoji to existing history', () => {
    const next = buildReactionHistory('😀,👍', '🎉');

    expect(next).toBe('🎉,😀,👍');
  });

  it('drops the oldest emoji when history exceeds three items', () => {
    const next = buildReactionHistory('😀,👍,🔥', '🎉');

    expect(next).toBe('🎉,😀,👍');
  });

  it('creates single-item history when there is no previous reaction', () => {
    const next = buildReactionHistory(undefined, '🎉');

    expect(next).toBe('🎉');
  });
});
