// Opens the SQLite connection and applies migrations.
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { config } from '../config/env.js';
import { logger } from '../lib/logger.js';
import { migrate } from './schema.js';
let instance: Database.Database | undefined;
export function getDb(): Database.Database {
  if (instance) return instance;
  fs.mkdirSync(path.dirname(config.databaseFile), { recursive: true });
  const db = new Database(config.databaseFile);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  migrate(db);
  instance = db;
  logger.info('db.ready', { file: config.databaseFile });
  return db;
}
export function closeDb(): void {
  instance?.close();
  instance = undefined;
}
