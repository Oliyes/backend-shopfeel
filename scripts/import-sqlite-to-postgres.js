// Migração de dados do SQLite para PostgreSQL. NÃO modifica o SQLite.
// Uso: node --env-file=.env.migration scripts/import-sqlite-to-postgres.js
import Database from 'better-sqlite3';
import knex from 'knex';
import config from '../knexfile.js';

const tables = [
  'customers',
  'moods',
  'products',
  'favorite_products',
  'mood_product_recommendations'
];

if (process.env.DATABASE_CLIENT !== 'pg') {
  throw new Error('Segurança: defina DATABASE_CLIENT=pg no arquivo .env.migration.');
}
if (!process.env.SQLITE_SOURCE_PATH) {
  throw new Error('Defina SQLITE_SOURCE_PATH com o caminho do backup SQLite.');
}
if (process.env.MIGRATION_CONFIRM !== 'SHOPFEEL_IMPORT') {
  throw new Error('Defina MIGRATION_CONFIRM=SHOPFEEL_IMPORT para autorizar esta importação.');
}

const source = new Database(process.env.SQLITE_SOURCE_PATH, {
  readonly: true,
  fileMustExist: true
});
const target = knex(config.production);

try {
  const integrity = source.pragma('quick_check', { simple: true });
  if (integrity !== 'ok') {
    throw new Error('Falha na verificação de integridade do backup SQLite.');
  }
  const invalidReferences = source.pragma('foreign_key_check');
  if (invalidReferences.length) {
    throw new Error('O backup tem referências inválidas entre as tabelas.');
  }

  const sourceCounts = Object.fromEntries(tables.map((table) => [
    table,
    source.prepare(`SELECT COUNT(*) AS count FROM "${table}"`).get().count
  ]));

  console.log('Registros no SQLite (somente leitura):');
  for (const table of tables) console.log(`  ${table}: ${sourceCounts[table]}`);

  // A criação do esquema ocorre no destino. Nunca fazemos drop ou truncate.
  await target.migrate.latest();

  await target.transaction(async (trx) => {
    for (const table of tables) {
      const row = await trx(table).count({ total: '*' }).first();
      if (Number(row.total) !== 0) {
        throw new Error(`Importação cancelada: tabela ${table} não está vazia no PostgreSQL.`);
      }
    }

    for (const table of tables) {
      const records = source.prepare(`SELECT * FROM "${table}"`).all();
      for (const record of records) {
        await trx(table).insert(record);
      }
    }

    // Atualiza as sequências após inserir IDs existentes; evita futuros conflitos.
    for (const table of ['customers', 'moods', 'products']) {
      await trx.raw(`SELECT setval(pg_get_serial_sequence('"${table}"', 'id'),
        COALESCE((SELECT MAX(id) FROM "${table}"), 1),
        EXISTS(SELECT 1 FROM "${table}"))`);
    }

    for (const table of tables) {
      const row = await trx(table).count({ total: '*' }).first();
      if (Number(row.total) !== sourceCounts[table]) {
        throw new Error(`Contagem divergente em ${table}; a transação será desfeita.`);
      }
    }

    console.log('Importação conferida. Registros correspondentes nas cinco tabelas.');
  });
  console.log('Importação concluída COM SUCESSO no PostgreSQL.');
} catch (error) {
  console.error('Importação interrompida:', error.message);
  process.exitCode = 1;
} finally {
  source.close();
  await target.destroy();
}
