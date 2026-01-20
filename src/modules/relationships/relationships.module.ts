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
import { CacheModule } from '@modules/cache/cache.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Relationship.name, schema: RelationshipSchema },
    ]),
    UsersModule,
    CacheModule,
  ],
  controllers: [RelationshipController],
  providers: [RelationshipService, RelationshipRepository],
  exports: [RelationshipService],
})
export class RelationshipsModule {}
