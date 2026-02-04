import { ImageMimeType } from '@common/types/mime-type.types';
import { ImageTransform, ImageUrls } from '@common/types';

/**
 * Base media info (internal use / upload responses)
 */
export interface MediaBaseResponse {
  id: string;
  ownerId: string;
  mimeType: ImageMimeType;
  originalUrl: string;
  duration?: number;
  transform: ImageTransform;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Full media response with CDN image URLs (for feed/posts)
 */
export interface MediaResponse extends MediaBaseResponse {
  images: ImageUrls | null;
}

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
