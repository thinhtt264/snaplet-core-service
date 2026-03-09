/**
 * Common image URL response: original + CDN sizes (XS, SM, MD, XL).
 * Used for both avatar (avatarUrls) and media (images). All fields are always string (never null/undefined).
 */
export interface ImageSizesResponse {
  original: string;
  xs: string;
  sm: string;
  md: string;
  xl: string;
}

/** Alias for avatar responses (same shape; xl is '' when not used). */
export type AvatarUrlsResponse = ImageSizesResponse;
