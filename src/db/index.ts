import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.ts';
import { getEnv } from '../server/env.ts';

declare global {
  var _neonPool: Pool | undefined;
  var _neonPoolUrl: string | undefined;
}

export class DatabaseUnavailableError extends Error {
  constructor(message = 'Database connection is unavailable') {
    super(message);
    this.name = 'DatabaseUnavailableError';
  }
}

export function hasDatabaseConfig(): boolean {
  const env = getEnv();
  return Boolean(env.DATABASE_URL && env.DATABASE_URL.trim().length > 0);
}

export function getPool(): Pool | null {
  const env = getEnv();
  const connectionString = env.DATABASE_URL;
  if (!connectionString) {
    return null;
  }

  if (!global._neonPool || global._neonPoolUrl !== connectionString) {
    if (global._neonPool) {
      void global._neonPool.end().catch(() => {});
    }

    const requiresSsl =
      Boolean(env.DATABASE_CA_CERT) ||
      connectionString.includes('sslmode=require') ||
      connectionString.includes('sslmode=verify-full') ||
      connectionString.includes('sslmode=verify-ca');

    global._neonPool = new Pool({
      connectionString,
      ssl: env.DATABASE_CA_CERT
        ? { ca: env.DATABASE_CA_CERT, rejectUnauthorized: true }
        : requiresSsl
        ? { rejectUnauthorized: true }
        : undefined,
      max: 10,
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 30000,
    });
    global._neonPoolUrl = connectionString;

    global._neonPool.on('error', (err) => {
      console.error('Unexpected error on idle PostgreSQL pool client:', err.message);
    });
  }

  return global._neonPool;
}

export function getDb(): NodePgDatabase<typeof schema> {
  const pool = getPool();
  if (!pool) {
    throw new DatabaseUnavailableError('DATABASE_URL is not configured');
  }
  return drizzle(pool, { schema });
}

export async function checkDbReady(): Promise<boolean> {
  const pool = getPool();
  if (!pool) return false;
  try {
    await pool.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

export async function closeDbPool(): Promise<void> {
  if (global._neonPool) {
    const pool = global._neonPool;
    global._neonPool = undefined;
    global._neonPoolUrl = undefined;
    await pool.end().catch(() => {});
  }
}

// Lazy proxy so importing modules do not crash when DATABASE_URL is absent
export const db: NodePgDatabase<typeof schema> = new Proxy({} as NodePgDatabase<typeof schema>, {
  get(_target, prop, receiver) {
    const instance = getDb();
    const val = Reflect.get(instance, prop, receiver);
    return typeof val === 'function' ? val.bind(instance) : val;
  },
});
