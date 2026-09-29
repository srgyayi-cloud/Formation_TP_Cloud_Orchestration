export interface Config {
  port: number;
  appVersion: string;
  gitCommit: string;
  databaseUrl: string;
  migrateOnStart: boolean;
}

// Valeurs de secours pour une exécution locale sans variables d'environnement
export const DEFAULT_VERSION = '0.0.0-local';
export const DEFAULT_DATABASE_URL = 'postgres://reservations:reservations@localhost:5432/reservations';

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return {
    port: Number(env.PORT ?? 3000),
    appVersion: env.APP_VERSION?.trim() || DEFAULT_VERSION,
    gitCommit: env.GIT_COMMIT?.trim() || 'unknown',
    databaseUrl: env.DATABASE_URL?.trim() || DEFAULT_DATABASE_URL,
    migrateOnStart: env.MIGRATE_ON_START !== 'false',
  };
}
