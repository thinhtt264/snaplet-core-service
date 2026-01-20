export interface MediaResponse {
  id: string;
  ownerId: string;
  type: string;
  originalUrl: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
  duration?: number;
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
  media: MediaResponse;
  message: string;
}

export interface BatchUploadItemResponse {
  mediaId: string;
  uploadUrl: string;
  expiresIn: number; // seconds
}

export interface BatchUploadRequestResponse {
  items: BatchUploadItemResponse[];
}
