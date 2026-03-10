#!/usr/bin/env ts-node
import 'dotenv/config';
import path from 'path';
import os from 'os';
import Database from 'better-sqlite3';

const DB_DIR = path.resolve(
  (process.env.DB_PATH || '~/.code-llm/vectors.db').replace('~', os.homedir()).replace('/vectors.db', '')
);

function main() {
  const cacheDb = new Database(path.join(DB_DIR, 'cache.db'));

  // Remove expired query cache
  const { changes } = cacheDb.prepare(
    "DELETE FROM query_cache WHERE expires_at < datetime('now')"
  ).run();

  // Vacuum to reclaim space
  cacheDb.exec('VACUUM;');
  cacheDb.close();

  console.log(`✅ Cache cleaned: ${changes} expired entries removed`);
}

main();
