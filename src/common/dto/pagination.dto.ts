import { IsOptional, IsInt, Min, Max, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { OrderDirection, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../constants';

export class PaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  limit?: number = DEFAULT_PAGE_SIZE;

  @IsOptional()
  sortBy?: string;

  @IsOptional()
  @IsEnum(OrderDirection)
  order?: OrderDirection = OrderDirection.DESC;
}

export class PaginationMetaDto {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;

  constructor(page: number, limit: number, totalItems: number) {
    this.page = page;
    this.limit = limit;
    this.totalItems = totalItems;
    this.totalPages = Math.ceil(totalItems / limit);
    this.hasNextPage = page < this.totalPages;
    this.hasPreviousPage = page > 1;
  }
}

export class PaginatedResponseDto<T> {
  data: T[];
  meta: PaginationMetaDto;

  constructor(data: T[], page: number, limit: number, totalItems: number) {
    this.data = data;
    this.meta = new PaginationMetaDto(page, limit, totalItems);
  }
}
