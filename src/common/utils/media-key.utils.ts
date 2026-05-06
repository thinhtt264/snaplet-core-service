import { IMAGE_V1_FOLDER } from '@common/constants';

/**
 * Normalize a client-provided media reference into a storage key.
 *
 * - If input is already a key (e.g. "imageV1/<id>"), return as-is.
 * - If input looks like a raw media id (e.g. "<id>"), prepend IMAGE_V1_FOLDER.
 */
export function normalizeImageV1MediaKey(
  input: string | undefined | null,
): string | null {
  if (input == null) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  // If the client already sent a full key/path, keep it.
  if (trimmed.includes('/')) return trimmed;

  // Otherwise, assume it's a raw media id.
  return `${IMAGE_V1_FOLDER}/${trimmed}`;
}

export function extractMediaIdFromKey(
  input: string | undefined | null,
): string | null {
  const normalizedKey = normalizeImageV1MediaKey(input);
  if (!normalizedKey) return null;

  const segments = normalizedKey.split('/').filter(Boolean);
  return segments.length > 0 ? segments[segments.length - 1] : null;
}
