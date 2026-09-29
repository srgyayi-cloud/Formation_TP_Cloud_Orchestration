import { loadConfig } from '../config.js';
import { createDatabase, migrate } from '../db.js';
import { resetDatabase } from '../seed.js';

const db = createDatabase(loadConfig().databaseUrl);
try {
  await migrate(db);
  const count = await resetDatabase(db);
  console.log(`Base réinitialisée avec ${count} réservations.`);
} finally {
  await db.end();
}
