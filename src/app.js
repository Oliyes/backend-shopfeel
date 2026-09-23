import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import multer from 'multer';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

import { mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { z } from 'zod';

import db from './db/connection.js';
import env from './config/env.js';


/* ========================================
   CONFIGURAÇÕES DE ARQUIVOS
======================================== */

const __dirname = path.dirname(
  fileURLToPath(import.meta.url)
);

const uploadDirectory = path.resolve(
  __dirname,
  '..',
  env.uploadDir
);

mkdirSync(uploadDirectory, {
  recursive: true
});


const upload = multer({
  storage: multer.diskStorage({

    destination: uploadDirectory,

    filename: (
      _request,
      file,
      callback
    ) => {

      const extension =
        path
          .extname(file.originalname)
          .toLowerCase();

      callback(
        null,
        `${randomUUID()}${extension}`
      );
    }
  }),

  limits: {
    fileSize: env.maxFileSize,
    files: 1
  },

  fileFilter: (
    _request,
    file,
    callback
  ) => {

    if (
      ![
        'image/jpeg',
        'image/png',
        'image/webp'
      ].includes(file.mimetype)
    ) {

      const error =
        new Error(
          'A imagem deve ser JPEG, PNG ou WebP'
        );

      error.code =
        'INVALID_IMAGE_TYPE';

      return callback(error);
    }

    return callback(null, true);
  }
});


/* ========================================
   APP
======================================== */

const app = express();


app.use(helmet());

app.use(
  cors({
    origin: env.webOrigin
  })
);

app.use(
  express.json({
    limit: '1mb'
  })
);

app.use(
  '/uploads',
  express.static(uploadDirectory)
);


/* ========================================
   FUNÇÕES AUXILIARES
======================================== */

const publicCustomer = (
  customer
) => ({
  id: customer.id,

  name: customer.name,

  email: customer.email,

  photo: customer.photo,

  access_level:
    customer.access_level,

  created_at:
    customer.created_at,

  updated_at:
    customer.updated_at
});


const signToken = (
  customer
) =>
  jwt.sign(
    {
      sub:
        customer.id,

      accessLevel:
        customer.access_level
    },

    env.jwtSecret,

    {
      expiresIn:
        env.jwtExpiresIn
    }
  );


/* ========================================
   AUTENTICAÇÃO
======================================== */

const authenticate = async (
  request,
  response,
  next
) => {

  try {

    const header =
      request.get(
        'authorization'
      );


    if (
      !header?.startsWith(
        'Bearer '
      )
    ) {

      return response
        .status(401)
        .json({
          error:
            'Token ausente'
        });
    }


    const payload =
      jwt.verify(
        header.slice(7),
        env.jwtSecret
      );


    const customer =
      await db(
        'customers'
      )
        .where({
          id:
            payload.sub
        })
        .first();


    if (!customer) {

      return response
        .status(401)
        .json({
          error:
            'Usuário inválido'
        });
    }


    request.customer =
      customer;


    return next();

  } catch {

    return response
      .status(401)
      .json({
        error:
          'Token inválido ou expirado'
      });
  }
};


const requireAdmin = (
  request,
  response,
  next
) => {

  if (
    request.customer
      ?.access_level !==
    'ADMIN'
  ) {

    return response
      .status(403)
      .json({
        error:
          'Acesso administrativo necessário'
      });
  }

  return next();
};


/* ========================================
   VALIDAÇÕES
======================================== */

const customerInput =
  z.object({

    name:
      z
        .string()
        .trim()
        .min(2)
        .max(120),

    email:
      z
        .string()
        .trim()
        .email()
        .max(255),

    password:
      z
        .string()
        .min(8)
        .max(128)
  });


const productInput =
  z.object({

    name:
      z
        .string()
        .trim()
        .min(1)
        .max(200),

    description:
      z
        .string()
        .max(5000)
        .nullable()
        .optional(),

    price_cents:
      z
        .number()
        .int()
        .nonnegative(),

    store_name:
      z
        .string()
        .trim()
        .min(1)
        .max(150),

    store_key:
      z
        .string()
        .trim()
        .min(1)
        .max(100),

    external_url:
      z
        .string()
        .url(),

    image_url:
      z
        .string()
        .url()
        .nullable()
        .optional(),

    is_active:
      z
        .union([
          z.literal(0),
          z.literal(1)
        ])
        .optional()
  });


/* ========================================
   HEALTH
======================================== */

app.get(
  '/health',
  async (
    _request,
    response
  ) => {

    await db.raw(
      'select 1'
    );

    response.json({
      status: 'ok'
    });
  }
);


/* ========================================
   CADASTRO
======================================== */

app.post(
  '/api/auth/register',
  async (
    request,
    response,
    next
  ) => {

    try {

      const input =
        customerInput.parse(
          request.body
        );


      const password =
        await bcrypt.hash(
          input.password,
          12
        );


      const [id] =
        await db(
          'customers'
        ).insert({
          ...input,

          password,

          email_verified: 0
        });


      const customer =
        await db(
          'customers'
        )
          .where({
            id
          })
          .first();


      response
        .status(201)
        .json({

          customer:
            publicCustomer(
              customer
            ),

          token:
            signToken(
              customer
            )
        });

    } catch (error) {

      next(error);
    }
  }
);


/* ========================================
   LOGIN
======================================== */

app.post(
  '/api/auth/login',
  async (
    request,
    response,
    next
  ) => {

    try {

      const input =
        z
          .object({

            email:
              z
                .string()
                .email(),

            password:
              z.string()

          })
          .parse(
            request.body
          );


      const customer =
        await db(
          'customers'
        )
          .where({
            email:
              input.email
          })
          .first();


      if (
        !customer ||
        !customer.password ||
        !(
          await bcrypt.compare(
            input.password,
            customer.password
          )
        )
      ) {

        return response
          .status(401)
          .json({
            error:
              'Credenciais inválidas'
          });
      }


      return response.json({

        customer:
          publicCustomer(
            customer
          ),

        token:
          signToken(
            customer
          )
      });

    } catch (error) {

      return next(error);
    }
  }
);


/* ========================================
   PERFIL
======================================== */

app.get(
  '/api/me',

  authenticate,

  (
    request,
    response
  ) => {

    response.json({

      customer:
        publicCustomer(
          request.customer
        )

    });
  }
);


app.patch(
  '/api/me',

  authenticate,

  async (
    request,
    response,
    next
  ) => {

    try {

      const input =
        z
          .object({

            name:
              z
                .string()
                .trim()
                .min(2)
                .max(120)
                .optional()

          })
          .parse(
            request.body
          );


      await db(
        'customers'
      )
        .where({
          id:
            request.customer.id
        })
        .update({

          ...input,

          updated_at:
            db.fn.now()
        });


      const customer =
        await db(
          'customers'
        )
          .where({
            id:
              request.customer.id
          })
          .first();


      response.json({

        customer:
          publicCustomer(
            customer
          )

      });

    } catch (error) {

      next(error);
    }
  }
);


/* ========================================
   FOTO DO PERFIL
======================================== */

app.post(
  '/api/me/photo',

  authenticate,

  upload.single(
    'photo'
  ),

  async (
    request,
    response,
    next
  ) => {

    try {

      if (!request.file) {

        return response
          .status(400)
          .json({
            error:
              'Imagem JPEG, PNG ou WebP é obrigatória'
          });
      }


      const photo =
        `/uploads/${request.file.filename}`;


      await db(
        'customers'
      )
        .where({
          id:
            request.customer.id
        })
        .update({

          photo,

          updated_at:
            db.fn.now()
        });


      response.json({
        photo
      });

    } catch (error) {

      next(error);
    }
  }
);


/* ========================================
   MOBILE - HUMORES
======================================== */

app.get(
  '/api/mobile/moods',

  async (
    _request,
    response,
    next
  ) => {

    try {

      const moods =
        await db(
          'moods'
        )
          .orderBy(
            'id'
          );


      response.json({
        moods
      });

    } catch (error) {

      next(error);
    }
  }
);


/* ========================================
   MOBILE - PRODUTOS
======================================== */

app.get(
  '/api/mobile/products',

  async (
    request,
    response,
    next
  ) => {

    try {

      const page =
        Math.max(
          Number(
            request.query.page ??
            1
          ),
          1
        );


      const limit =
        Math.min(
          Math.max(
            Number(
              request.query.limit ??
              20
            ),
            1
          ),
          100
        );


      const query =
        db(
          'products'
        )
          .where({
            is_active: 1
          });


      if (
        request.query.search
      ) {

        query.whereLike(
          'name',
          `%${request.query.search}%`
        );
      }


      const [
        {
          count
        }
      ] =
        await query
          .clone()
          .count({
            count: '*'
          });


      const products =
        await query
          .clone()
          .orderBy(
            'id',
            'desc'
          )
          .limit(limit)
          .offset(
            (page - 1) *
            limit
          );


      response.json({

        products,

        pagination: {
          page,

          limit,

          total:
            Number(count)
        }
      });

    } catch (error) {

      next(error);
    }
  }
);


/* ========================================
   MOBILE - RECOMENDAÇÕES
======================================== */

app.get(
  '/api/mobile/recommendations/:moodId',

  async (
    request,
    response,
    next
  ) => {

    try {

      const products =
        await db(
          'products'
        )
          .join(

            'mood_product_recommendations as recommendations',

            'products.id',

            'recommendations.product_id'

          )
          .where({

            'recommendations.mood_id':
              request.params.moodId,

            'products.is_active':
              1

          })
          .select(
            'products.*'
          );


      response.json({
        products
      });

    } catch (error) {

      next(error);
    }
  }
);


/* ========================================
   FAVORITOS
======================================== */

app.get(
  '/api/me/favorites',

  authenticate,

  async (
    request,
    response,
    next
  ) => {

    try {

      const products =
        await db(
          'products'
        )
          .join(

            'favorite_products as favorites',

            'products.id',

            'favorites.product_id'

          )
          .where({

            'favorites.customer_id':
              request.customer.id

          })
          .select(
            'products.*'
          );


      response.json({
        products
      });

    } catch (error) {

      next(error);
    }
  }
);


app.post(
  '/api/me/favorites/:productId',

  authenticate,

  async (
    request,
    response,
    next
  ) => {

    try {

      await db(
        'favorite_products'
      )
        .insert({

          customer_id:
            request.customer.id,

          product_id:
            request.params.productId

        })
        .onConflict([
          'customer_id',
          'product_id'
        ])
        .ignore();


      response
        .status(201)
        .json({
          message:
            'Produto favoritado'
        });

    } catch (error) {

      next(error);
    }
  }
);


app.delete(
  '/api/me/favorites/:productId',

  authenticate,

  async (
    request,
    response,
    next
  ) => {

    try {

      await db(
        'favorite_products'
      )
        .where({

          customer_id:
            request.customer.id,

          product_id:
            request.params.productId

        })
        .del();


      response
        .status(204)
        .send();

    } catch (error) {

      next(error);
    }
  }
);


/* ========================================
   ROTAS ADMIN
======================================== */

app.use(
  '/api/admin',
  authenticate,
  requireAdmin
);


/* ========================================
   ADMIN - USUÁRIOS
======================================== */

app.get(
  '/api/admin/customers',

  async (
    _request,
    response,
    next
  ) => {

    try {

      const customers =
        await db(
          'customers'
        )
          .select(

            'id',

            'name',

            'email',

            'photo',

            'email_verified',

            'access_level',

            'created_at',

            'updated_at'

          )
          .orderBy(
            'id'
          );


      response.json({
        customers
      });

    } catch (error) {

      next(error);
    }
  }
);


/* ========================================
   ADMIN - LISTAR PRODUTOS
======================================== */

app.get(
  '/api/admin/products',

  async (
    _request,
    response,
    next
  ) => {

    try {

      const products =
        await db(
          'products'
        )
          .select('*')
          .orderBy(
            'id',
            'desc'
          );


      response.json({
        products
      });

    } catch (error) {

      next(error);
    }
  }
);


/* ========================================
   ADMIN - CRIAR PRODUTO
======================================== */

app.post(
  '/api/admin/products',

  async (
    request,
    response,
    next
  ) => {

    try {

      const input =
        productInput.parse(
          request.body
        );


      const [id] =
        await db(
          'products'
        )
          .insert({

            ...input,

            user_id:
              request.customer.id

          });


      const product =
        await db(
          'products'
        )
          .where({
            id
          })
          .first();


      response
        .status(201)
        .json({
          product
        });

    } catch (error) {

      next(error);
    }
  }
);


/* ========================================
   ADMIN - EDITAR PRODUTO
======================================== */

app.patch(
  '/api/admin/products/:id',

  async (
    request,
    response,
    next
  ) => {

    try {

      const input =
        productInput
          .partial()
          .parse(
            request.body
          );


      await db(
        'products'
      )
        .where({
          id:
            request.params.id
        })
        .update({

          ...input,

          updated_at:
            db.fn.now()

        });


      const product =
        await db(
          'products'
        )
          .where({
            id:
              request.params.id
          })
          .first();


      response.json({
        product
      });

    } catch (error) {

      next(error);
    }
  }
);


/* ========================================
   ADMIN - DESATIVAR PRODUTO
======================================== */

app.delete(
  '/api/admin/products/:id',

  async (
    request,
    response,
    next
  ) => {

    try {

      await db(
        'products'
      )
        .where({
          id:
            request.params.id
        })
        .update({

          is_active:
            0,

          updated_at:
            db.fn.now()

        });


      response
        .status(204)
        .send();

    } catch (error) {

      next(error);
    }
  }
);


/* ========================================
   ADMIN - CURADORIA
======================================== */


/* LISTAR RECOMENDAÇÕES */

app.get(
  '/api/admin/recommendations',

  async (
    request,
    response,
    next
  ) => {

    try {

      const query =
        db(
          'mood_product_recommendations'
        )
          .select(
            'product_id',
            'mood_id'
          );


      if (
        request.query.mood_id
      ) {

        query.where({

          mood_id:
            request.query.mood_id

        });
      }


      const recommendations =
        await query
          .orderBy(
            'mood_id'
          )
          .orderBy(
            'product_id'
          );


      response.json({
        recommendations
      });

    } catch (error) {

      next(error);
    }
  }
);


/* CRIAR RECOMENDAÇÃO */

app.post(
  '/api/admin/recommendations',

  async (
    request,
    response,
    next
  ) => {

    try {

      const input =
        z
          .object({

            product_id:
              z
                .number()
                .int()
                .positive(),

            mood_id:
              z
                .number()
                .int()
                .positive()

          })
          .parse(
            request.body
          );


      await db(
        'mood_product_recommendations'
      )
        .insert(
          input
        )
        .onConflict([
          'product_id',
          'mood_id'
        ])
        .ignore();


      response
        .status(201)
        .json({
          message:
            'Recomendação criada'
        });

    } catch (error) {

      next(error);
    }
  }
);


/* REMOVER RECOMENDAÇÃO */

app.delete(
  '/api/admin/recommendations/:moodId/:productId',

  async (
    request,
    response,
    next
  ) => {

    try {

      await db(
        'mood_product_recommendations'
      )
        .where({

          mood_id:
            request.params.moodId,

          product_id:
            request.params.productId

        })
        .del();


      response
        .status(204)
        .send();

    } catch (error) {

      next(error);
    }
  }
);


/* ========================================
   TRATAMENTO DE ERROS
======================================== */

app.use(
  (
    error,
    _request,
    response,
    _next
  ) => {

    if (
      error instanceof
      z.ZodError
    ) {

      return response
        .status(400)
        .json({

          error:
            'Dados inválidos',

          details:
            error.issues

        });
    }


    if (
      error.code ===
      'SQLITE_CONSTRAINT_UNIQUE'
    ) {

      return response
        .status(409)
        .json({
          error:
            'Registro duplicado'
        });
    }


    if (
      error.code ===
      'INVALID_IMAGE_TYPE'
    ) {

      return response
        .status(400)
        .json({
          error:
            error.message
        });
    }


    if (
      error instanceof
      multer.MulterError
    ) {

      const message =
        error.code ===
        'LIMIT_FILE_SIZE'

          ? `A imagem excede o limite de ${env.maxFileSize} bytes`

          : error.code ===
            'LIMIT_UNEXPECTED_FILE'

            ? 'Use exatamente um arquivo no campo photo'

            : 'Upload inválido';


      return response
        .status(400)
        .json({
          error:
            message
        });
    }


    console.error(error);


    return response
      .status(500)
      .json({
        error:
          'Erro interno'
      });
  }
);


/* ========================================
   EXPORT
======================================== */

export default app;