import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { drizzleProvider } from './postgres.provider';

@Module({
  imports: [ConfigModule],
  providers: [drizzleProvider],
  exports: [drizzleProvider],
})
export class PostgresModule {}
