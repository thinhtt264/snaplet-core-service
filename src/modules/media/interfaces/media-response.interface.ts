import { ImageMimeType } from '@common/types/mime-type.types';
import { ImageTransform, ImageSizesResponse } from '@common/types';

/**
 * Base media info (internal use / upload responses)
 * images: original + CDN sizes (xs, sm, md, xl) – same pattern as avatar avatarUrls
 */
export interface MediaBaseResponse {
  id: string;
  ownerId: string;
  mimeType: ImageMimeType;
  images: ImageSizesResponse;
  duration?: number;
  width: number;
  height: number;
  transform: ImageTransform;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

/** Full media response (for feed/posts) – same as base */
export type MediaResponse = MediaBaseResponse;

export interface UploadRequestResponse {
  mediaId: string;
  uploadUrl: string;
  expiresIn: number; // seconds
}

export interface ConfirmUploadResponse {
  media: MediaBaseResponse[];
  message: string;
}

export interface BatchUploadItemResponse {
  mediaId: string;
  uploadUrl: string;
  expiresIn: number; // seconds
}

export interface BatchUploadRequestResponse {
  data: BatchUploadItemResponse[];
}
