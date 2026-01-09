export const API_VERSION = 'v1';

export enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
  Staging = 'staging',
}

export enum OrderDirection {
  ASC = 'asc',
  DESC = 'desc',
}

export enum ErrorCode {
  RELATIONSHIP_LIMIT_EXCEEDED = 'RELATIONSHIP_LIMIT_EXCEEDED',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
}

export enum RelationshipLimitReason {
  SOURCE = 'SOURCE_LIMIT',
  TARGET = 'TARGET_LIMIT',
}

export const MAX_RELATIONSHIPS_PER_USER = 50;
export const DEFAULT_PAGE_SIZE = 10;
export const MAX_PAGE_SIZE = 100;

export * from './redis-keys.constants';
export * from './regex.constants';
