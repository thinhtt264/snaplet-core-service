import { MAX_REACTION_HISTORY } from '../constants/post-reaction.constants';

export const buildReactionHistory = (
  currentReactionHistory: string | undefined,
  incomingReactionIcon: string,
): string => {
  const incomingToken = incomingReactionIcon.trim();
  const previousTokens = (currentReactionHistory ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  // Deduplicate against the incoming reaction so repeated double-taps don't
  // fill the history with identical entries like "🎉,🎉,🎉".
  const dedupedPreviousTokens = previousTokens.filter(
    (token) => token !== incomingToken,
  );

  return [incomingToken, ...dedupedPreviousTokens]
    .slice(0, MAX_REACTION_HISTORY)
    .join(',');
};
