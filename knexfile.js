import 'dotenv/config';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const databaseClient = (process.env.DATABASE_CLIENT ?? 'sqlite').toLowerCase();

const sqliteDatabase = process.env.DATABASE_PATH ?? './data/shopfeel.sqlite';

if (sqliteDatabase !== ':memory:' && databaseClient !== 'pg') {
  mkdirSync(dirname(resolve(sqliteDatabase)), { recursive: true });
}

const journalMode = (process.env.SQLITE_JOURNAL_MODE || 'WAL').toUpperCase();
if (!['WAL', 'DELETE', 'TRUNCATE'].includes(journalMode)) {
  throw new Error('SQLITE_JOURNAL_MODE inválido.');
}

const sqlite = {
  client: 'better-sqlite3',
  connection: { filename: sqliteDatabase },
  useNullAsDefault: true,
  migrations: { directory: './migrations' },
  seeds: { directory: './seeds' },
  pool: {
    afterCreate(connection, callback) {
      connection.pragma('foreign_keys = ON');
      connection.pragma(`journal_mode = ${journalMode}`);
      connection.pragma('busy_timeout = 5000');
      callback(null, connection);
    }
  }
};

const postgres = {
  client: 'pg',
  connection: () => {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL é obrigatória quando DATABASE_CLIENT=pg.');
    }
    return {
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: true }
    };
  },
  migrations: { directory: './migrations' },
  seeds: { directory: './seeds' }
};

if (!['sqlite', 'pg'].includes(databaseClient)) {
  throw new Error('DATABASE_CLIENT deve ser sqlite ou pg.');
}

export default {
  development: databaseClient === 'pg' ? postgres : sqlite,
  test: {
    ...sqlite,
    connection: { filename: process.env.TEST_DATABASE_PATH ?? ':memory:' }
  },
  production: databaseClient === 'pg' ? postgres : sqlite
};
