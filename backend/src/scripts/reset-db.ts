import { loadConfig } from '../config.js';
import { openDatabase } from '../db.js';
import { resetDatabase } from '../seed.js';

const { databasePath } = loadConfig();
const db = openDatabase(databasePath);
const count = resetDatabase(db);
db.close();
console.log(`Base ${databasePath} réinitialisée avec ${count} réservations.`);
