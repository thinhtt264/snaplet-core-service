import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

async function runMigrations() {
  const url = process.env.POSTGRES_URL;
  if (!url) throw new Error('POSTGRES_URL is not set');

  const client = postgres(url, { max: 1 });
  const db = drizzle(client);

  console.log('[migrate] Running database migrations...');
  await migrate(db, { migrationsFolder: './drizzle' });
  console.log('[migrate] Migrations complete.');

  await client.end();
}

runMigrations().catch((err) => {
  console.error('[migrate] FAILED:', err);
  process.exit(1);
});
