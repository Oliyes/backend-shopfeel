export async function up(knex) {
  await knex.schema.alterTable('customers', (table) => {
    table.text('password_reset_code_hash');
    table.text('password_reset_expires_at');
  });
}

export async function down(knex) {
  await knex.schema.alterTable('customers', (table) => {
    table.dropColumn('password_reset_code_hash');
    table.dropColumn('password_reset_expires_at');
  });
}
