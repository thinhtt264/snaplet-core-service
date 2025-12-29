import { IsNotEmpty, IsString, IsEnum } from 'class-validator';
import { RelationshipStatus } from '../schemas/relationship.schema';

export class CreateRelationshipDto {
  @IsNotEmpty({ message: 'Target User ID is required' })
  @IsString({ message: 'Target User ID must be a string' })
  targetUserId: string;
}

export class RelationshipStatusDto {
  @IsNotEmpty({ message: 'Status is required' })
  @IsEnum(RelationshipStatus, {
    message: 'Status must be one of: pending, accepted, blocked',
  })
  status: RelationshipStatus;
}
