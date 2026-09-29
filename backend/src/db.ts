import { readdir, readFile } from 'node:fs/promises';
import pg from 'pg';

export type Database = pg.Pool;

// Dossier backend/migrations, que le code tourne depuis src/ (dev) ou dist/ (build)
const MIGRATIONS_DIR = new URL('../migrations/', import.meta.url);

// Verrou applicatif : deux instances qui démarrent ensemble ne migrent pas en même temps
const MIGRATION_LOCK_ID = 4_815_162_342;

export function createDatabase(connectionString: string): Database {
  return new pg.Pool({
    connectionString,
    max: 10,
    connectionTimeoutMillis: 3_000,
    query_timeout: 5_000,
  });
}

// Applique, dans l'ordre, les fichiers SQL de migrations/ pas encore appliqués
export async function migrate(db: Database): Promise<string[]> {
  const files = (await readdir(MIGRATIONS_DIR)).filter((file) => file.endsWith('.sql')).sort();
  const client = await db.connect();
  const applied: string[] = [];
  try {
    await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_ID]);
    await client.query(
      `CREATE TABLE IF NOT EXISTS schema_migrations (
         version    text        PRIMARY KEY,
         applied_at timestamptz NOT NULL DEFAULT now()
       )`,
    );
    const { rows } = await client.query<{ version: string }>('SELECT version FROM schema_migrations');
    const done = new Set(rows.map((row) => row.version));

    for (const file of files.filter((f) => !done.has(f))) {
      const sql = await readFile(new URL(file, MIGRATIONS_DIR), 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [file]);
        await client.query('COMMIT');
        applied.push(file);
      } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(`Échec de la migration ${file} : ${(err as Error).message}`);
      }
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_ID]).catch(() => undefined);
    client.release();
  }
  return applied;
}

// Vérification réelle utilisée par /health/ready
export async function pingDatabase(db: Database): Promise<void> {
  await db.query('SELECT 1');
}
