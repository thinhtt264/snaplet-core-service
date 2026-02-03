import { ImageMimeType } from '@common/types/mime-type.types';
import { ImageTransform } from '@common/types';

export interface MediaResponse {
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

export interface UploadRequestResponse {
  mediaId: string;
  uploadUrl: string;
  expiresIn: number; // seconds
}

export interface ConfirmUploadResponse {
  media: MediaResponse[];
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
