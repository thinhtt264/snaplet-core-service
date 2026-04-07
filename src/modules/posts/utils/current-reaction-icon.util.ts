/**
 * Persisted reaction icons may be comma-separated history (newest first).
 * Exposes the full sequence with commas replaced by single spaces.
 */
export function getCurrentReactionIcon(stored: string): string {
  if (!stored) {
    return '';
  }
  return stored
    .split(',')
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0)
    .join(' ');
}
