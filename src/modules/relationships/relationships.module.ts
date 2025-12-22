import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Relationship,
  RelationshipSchema,
} from './schemas/relationship.schema';
import { RelationshipController } from './controllers/relationship.controller';
import { RelationshipService } from './services/relationship.service';
import { RelationshipRepository } from './repositories/relationship.repository';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Relationship.name, schema: RelationshipSchema },
    ]),
    AuthModule,
  ],
  controllers: [RelationshipController],
  providers: [RelationshipService, RelationshipRepository],
  exports: [RelationshipService, RelationshipRepository],
})
export class RelationshipsModule {}
