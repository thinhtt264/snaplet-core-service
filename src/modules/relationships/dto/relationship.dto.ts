import { IsNotEmpty, IsString } from 'class-validator';
import { RelationshipStatus } from '../schemas/relationship.schema';

export class CreateRelationshipDto {
  @IsNotEmpty({ message: 'Target User ID is required' })
  @IsString({ message: 'Target User ID must be a string' })
  targetUserId: string;
}

export class UpdateRelationshipStatusDto {
  @IsNotEmpty({ message: 'Status is required' })
  @IsString({ message: 'Status must be a string' })
  status: RelationshipStatus;
}
