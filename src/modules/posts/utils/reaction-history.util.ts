const MAX_REACTION_HISTORY = 3;

export const buildReactionHistory = (
  currentReactionHistory: string | undefined,
  incomingReactionIcon: string,
): string => {
  const previousTokens = (currentReactionHistory ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  return [incomingReactionIcon, ...previousTokens]
    .slice(0, MAX_REACTION_HISTORY)
    .join(',');
};
