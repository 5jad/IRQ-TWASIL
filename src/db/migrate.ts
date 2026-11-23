import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { getDb, hasDatabaseConfig, closeDbPool } from './index.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function runPendingMigrations(): Promise<boolean> {
  if (!hasDatabaseConfig()) {
    return false;
  }
  const migrationsFolder = path.resolve(__dirname, '../../drizzle');
  const db = getDb();
  await migrate(db, { migrationsFolder });
  return true;
}

const isDirectRun =
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  runPendingMigrations()
    .then(async (ran) => {
      if (!ran) {
        console.error('DATABASE_URL is not set; skipping migrations.');
        process.exitCode = 1;
      } else {
        console.log('Database migrations applied cleanly.');
      }
      await closeDbPool();
    })
    .catch(async (err) => {
      console.error('Migration failed:', err);
      await closeDbPool();
      process.exit(1);
    });
}
