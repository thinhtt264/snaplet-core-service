import { ConfigService } from '@nestjs/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export const DRIZZLE_CLIENT = 'DRIZZLE_CLIENT';

export const drizzleProvider = {
  provide: DRIZZLE_CLIENT,
  inject: [ConfigService],
  useFactory: (configService: ConfigService) => {
    const url = configService.get<string>('postgres.url')!;
    const client = postgres(url);
    return drizzle(client, { schema });
  },
};
