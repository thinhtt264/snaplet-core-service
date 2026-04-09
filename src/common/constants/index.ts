export const API_VERSION = 'v1';

export const MAX_MEDIA_FILE_SIZE = 8 * 1024 * 1024; // 8MB
export const MAX_AVATAR_FILE_SIZE = 5 * 1024 * 1024; // 5MB
export const IMAGE_V1_FOLDER = 'imageV1';
export const AVATAR_V1_FOLDER = 'avatarV1';

export enum OrderDirection {
  ASC = 'asc',
  DESC = 'desc',
}

export enum ErrorCode {
  RELATIONSHIP_LIMIT_EXCEEDED = 'RELATIONSHIP_LIMIT_EXCEEDED',
  POST_CREATE_LIMIT_EXCEEDED = 'POST_CREATE_LIMIT_EXCEEDED',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  INVALID_FINGERPRINT = 'INVALID_FINGERPRINT',
}

export enum RelationshipLimitReason {
  SOURCE = 'SOURCE_LIMIT',
  TARGET = 'TARGET_LIMIT',
}

export const MAX_RELATIONSHIPS_PER_USER = 30;
export const POST_CREATE_DAILY_LIMIT = 10;
export const POST_CREATE_LIMIT_TTL_SECONDS = 24 * 60 * 60; // 24h

export * from './redis-keys.constants';
export * from './regex.constants';
export * from './user-profile.constants';
