import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { createDatabase, migrate } from './db.js';
import { seedIfEmpty } from './seed.js';

const config = loadConfig();
const db = createDatabase(config.databaseUrl);

// Désactivable (MIGRATE_ON_START=false) quand les migrations sont lancées à part
if (config.migrateOnStart) {
  const applied = await migrate(db);
  for (const version of applied) console.log(`Migration appliquée : ${version}`);
  const seeded = await seedIfEmpty(db);
  if (seeded > 0) console.log(`Base initialisée avec ${seeded} réservations.`);
}

let shuttingDown = false;
const app = createApp({ db, config, isShuttingDown: () => shuttingDown });

const server = app.listen(config.port, () => {
  console.log(`API réservations v${config.appVersion} (${config.gitCommit}) sur le port ${config.port}`);
});

// Arrêt propre : Docker et Kubernetes envoient SIGTERM avant de tuer le conteneur
function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} reçu, arrêt en cours…`);
  server.close(() => {
    db.end().finally(() => process.exit(0));
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
