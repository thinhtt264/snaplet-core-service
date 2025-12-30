import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Relationship,
  RelationshipSchema,
} from './schemas/relationship.schema';
import { RelationshipController } from './controllers/relationship.controller';
import { RelationshipService } from './services/relationship.service';
import { RelationshipRepository } from './repositories/relationship.repository';
import { UsersModule } from '@modules/users/users.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Relationship.name, schema: RelationshipSchema },
    ]),
    UsersModule,
  ],
  controllers: [RelationshipController],
  providers: [RelationshipService, RelationshipRepository],
})
export class RelationshipsModule {}
