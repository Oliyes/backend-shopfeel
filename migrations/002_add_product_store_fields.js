export async function up(knex) {
  await knex.schema.alterTable("products", (table) => {
    table.string("store_name");
    table.string("store_key");

    table.text("external_url");
    table.text("image_url");
  });
}

export async function down(knex) {
  await knex.schema.alterTable("products", (table) => {
    table.dropColumn("store_name");
    table.dropColumn("store_key");
    table.dropColumn("external_url");
    table.dropColumn("image_url");
  });
}