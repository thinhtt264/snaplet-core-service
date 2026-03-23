import {
  IsNotEmpty,
  IsString,
  IsEnum,
  IsArray,
  ArrayMinSize,
  IsMongoId,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { RelationshipStatus } from '../schemas/relationship.schema';

export class CreateRelationshipDto {
  @IsNotEmpty({ message: 'Target User ID is required' })
  @IsString({ message: 'Target User ID must be a string' })
  @IsMongoId({ message: 'Target User ID must be a valid MongoDB ObjectId' })
  targetUserId: string;
}

export class GetRelationshipWithUserDto {
  @IsNotEmpty({ message: 'Target User ID is required' })
  @IsString({ message: 'Target User ID must be a string' })
  @IsMongoId({ message: 'Target User ID must be a valid MongoDB ObjectId' })
  targetUserId: string;
}

export class RelationshipIdParamDto {
  @IsNotEmpty({ message: 'Relationship ID is required' })
  @IsString({ message: 'Relationship ID must be a string' })
  @IsMongoId({ message: 'Relationship ID must be a valid MongoDB ObjectId' })
  relationshipId: string;
}

export class RelationshipStatusDto {
  @IsNotEmpty({ message: 'Status is required' })
  @IsEnum(RelationshipStatus, {
    message: 'Status must be one of: pending, accepted, blocked',
  })
  status: RelationshipStatus;
}

export class GetRelationshipsByStatusQueryDto {
  @Transform(({ value }) =>
    typeof value === 'string'
      ? value
          .split(',')
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean)
      : [],
  )
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one status is required' })
  @IsEnum(RelationshipStatus, {
    each: true,
    message: 'Each status must be one of: pending, accepted, blocked',
  })
  statuses: RelationshipStatus[];
}
