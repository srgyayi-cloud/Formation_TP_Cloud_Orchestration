export interface Config {
  port: number;
  appVersion: string;
  gitCommit: string;
  databasePath: string;
}

// Valeurs de secours pour une exécution locale sans variables d'environnement
export const DEFAULT_VERSION = '0.0.0-local';

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return {
    port: Number(env.PORT ?? 3000),
    appVersion: env.APP_VERSION?.trim() || DEFAULT_VERSION,
    gitCommit: env.GIT_COMMIT?.trim() || 'unknown',
    databasePath: env.DATABASE_PATH?.trim() || './data/reservations.db',
  };
}
