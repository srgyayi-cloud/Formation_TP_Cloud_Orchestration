import { loadConfig } from '../config.js';
import { createDatabase, migrate } from '../db.js';

const db = createDatabase(loadConfig().databaseUrl);
try {
  const applied = await migrate(db);
  console.log(applied.length ? `Migrations appliquées : ${applied.join(', ')}` : 'Base déjà à jour.');
} finally {
  await db.end();
}
