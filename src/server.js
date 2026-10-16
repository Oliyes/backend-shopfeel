import 'dotenv/config';
import app from './app.js';
import db from './db/connection.js';
import env from './config/env.js';

await db.migrate.latest();

const allowedInterestCategories = [
  'Tecnologia',
  'Moda',
  'Beleza',
  'Casa',
  'Livros',
  'Games'
];

app.patch(
  '/api/admin/products/:id/interest-category',
  async (request, response) => {
    try {
      const category = request.body?.interest_category;

      if (
        category !== null &&
        !allowedInterestCategories.includes(category)
      ) {
        return response.status(400).json({
          error: 'Categoria de interesse inválida.'
        });
      }

      const product = await db('products')
        .where({ id: request.params.id })
        .first();

      if (!product) {
        return response.status(404).json({
          error: 'Produto não encontrado.'
        });
      }

      await db('products')
        .where({ id: request.params.id })
        .update({
          interest_category: category || null,
          updated_at: db.fn.now()
        });

      const updatedProduct = await db('products')
        .where({ id: request.params.id })
        .first();

      return response.json({
        product: updatedProduct
      });
    } catch (error) {
      console.error(error);

      return response.status(500).json({
        error: 'Não foi possível atualizar a categoria do produto.'
      });
    }
  }
);

const server = app.listen(env.port, () => {
  console.log(`Shopfeel API listening on port ${env.port}`);
});

const shutdown = async () => {
  server.close(async () => {
    await db.destroy();
    process.exit(0);
  });
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
