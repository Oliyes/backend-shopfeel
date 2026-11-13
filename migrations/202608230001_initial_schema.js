export async function up(knex) {
  // PostgreSQL exige conversão explícita do timestamp para os campos TEXT.
  const timestampDefault = knex.client.config.client === 'pg'
    ? knex.raw('CURRENT_TIMESTAMP::text')
    : knex.raw('CURRENT_TIMESTAMP');
  await knex.schema.createTable('customers', (table) => {
    table.increments('id').primary();
    table.text('name').notNullable();
    table.text('email').notNullable().unique();
    table.text('email_code');
    table.integer('email_verified').notNullable().defaultTo(0);
    table.text('photo');
    table.text('password');
    table.text('access_level').notNullable().defaultTo('USER');
    table.text('created_at').notNullable().defaultTo(timestampDefault);
    table.text('updated_at').notNullable().defaultTo(timestampDefault);
    table.check("email_verified IN (0, 1)");
    table.check("access_level IN ('USER', 'ADMIN')");
    table.index('name', 'idx_customers_name');
    table.index('email', 'idx_customers_email');
  });

  await knex.schema.createTable('products', (table) => {
    table.increments('id').primary();
    table.text('name').notNullable();
    table.text('description');
    table.integer('price_cents').notNullable();
    table.integer('is_active').notNullable().defaultTo(1);
    table.integer('user_id').notNullable().references('id').inTable('customers').onDelete('RESTRICT');
    table.text('created_at').notNullable().defaultTo(timestampDefault);
    table.text('updated_at').notNullable().defaultTo(timestampDefault);
    table.check('price_cents >= 0');
    table.check('is_active IN (0, 1)');
    table.index('name', 'idx_products_name');
    table.index('price_cents', 'idx_products_price');
    table.index('is_active', 'idx_products_is_active');
  });

  await knex.schema.createTable('favorite_products', (table) => {
    table.increments('id').primary();
    table.integer('customer_id').notNullable().references('id').inTable('customers').onDelete('CASCADE');
    table.integer('product_id').notNullable().references('id').inTable('products').onDelete('CASCADE');
    table.text('created_at').notNullable().defaultTo(timestampDefault);
    table.text('updated_at').notNullable().defaultTo(timestampDefault);
    table.unique(['customer_id', 'product_id'], 'uq_favorite_products_customer_product');
    table.index('customer_id', 'idx_favorite_products_customer_id');
    table.index('product_id', 'idx_favorite_products_product_id');
  });

  await knex.schema.createTable('moods', (table) => {
    table.increments('id').primary();
    table.text('mood_name').notNullable().unique();
    table.text('associated_color').notNullable();
    table.text('description');
    table.text('created_at').notNullable().defaultTo(timestampDefault);
    table.text('updated_at').notNullable().defaultTo(timestampDefault);
    table.index('mood_name', 'idx_moods_mood_name');
    table.index('associated_color', 'idx_moods_associated_color');
  });

  await knex.schema.createTable('mood_product_recommendations', (table) => {
    table.increments('id').primary();
    table.integer('product_id').notNullable().references('id').inTable('products').onDelete('CASCADE');
    table.integer('mood_id').notNullable().references('id').inTable('moods').onDelete('CASCADE');
    table.unique(['product_id', 'mood_id'], 'uq_mood_product_recommendations_product_mood');
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('mood_product_recommendations');
  await knex.schema.dropTableIfExists('moods');
  await knex.schema.dropTableIfExists('favorite_products');
  await knex.schema.dropTableIfExists('products');
  await knex.schema.dropTableIfExists('customers');
}
