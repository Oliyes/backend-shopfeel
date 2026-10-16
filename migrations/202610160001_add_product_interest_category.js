export async function up(knex) {
  await knex.schema.alterTable('products', (table) => {
    table.text('interest_category');
    table.index('interest_category', 'idx_products_interest_category');
  });
}

export async function down(knex) {
  await knex.schema.alterTable('products', (table) => {
    table.dropIndex('interest_category', 'idx_products_interest_category');
    table.dropColumn('interest_category');
  });
}
