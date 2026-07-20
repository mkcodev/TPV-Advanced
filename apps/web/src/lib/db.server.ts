import 'server-only';

import { getServerEnv } from '@tpv/api';
import { type Database, createDb } from '@tpv/db';

// Module-level singleton — one connection pool per process / warm serverless instance.
let _db: Database | undefined;

export function getDb(): Database {
  if (!_db) {
    _db = createDb(getServerEnv().DATABASE_URL);
  }
  return _db;
}
