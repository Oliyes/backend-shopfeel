import 'dotenv/config';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const database = process.env.DATABASE_PATH ?? './data/shopfeel.sqlite';
// O banco de produção pode ficar fora da pasta publicada, por exemplo /home/data/.
if (database !== ':memory:') {
  mkdirSync(dirname(resolve(database)), { recursive: true });
}

// WAL permanece em desenvolvimento; no Azure com /home compartilhado,
// use SQLITE_JOURNAL_MODE=DELETE para evitar WAL em filesystem de rede.
const journalMode = (process.env.SQLITE_JOURNAL_MODE || 'WAL').toUpperCase();
if (!['WAL', 'DELETE', 'TRUNCATE'].includes(journalMode)) {
  throw new Error('SQLITE_JOURNAL_MODE inválido.');
}

const base = {
  client: 'better-sqlite3',
  connection: { filename: database },
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

export default {
  development: base,
  test: { ...base, connection: { filename: process.env.TEST_DATABASE_PATH ?? ':memory:' } },
  production: base
};
