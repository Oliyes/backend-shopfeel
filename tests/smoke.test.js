import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { test, before, after } from 'node:test';
import request from 'supertest';
import app from '../src/app.js';
import db from '../src/db/connection.js';

before(async () => {
  // Os testes usam um banco isolado; as tabelas precisam existir antes das rotas.
  await db.migrate.latest();
});

test('health endpoint responds', async () => {
  const response = await request(app).get('/health');
  assert.equal(response.status, 200);
  assert.equal(response.body.status, 'ok');
});

test('registration returns a JWT without exposing password', async () => {
  await db('customers').where({ email: 'test@example.com' }).del();
  const response = await request(app).post('/api/auth/register').send({
    name: 'Test User', email: 'test@example.com', password: 'password123'
  });
  assert.equal(response.status, 201);
  assert.ok(response.body.token);
  assert.equal(response.body.customer.password, undefined);
});

test('profile photo accepts a JPEG multipart upload', async () => {
  await db('customers').where({ email: 'photo@example.com' }).del();
  const registration = await request(app).post('/api/auth/register').send({
    name: 'Photo User', email: 'photo@example.com', password: 'password123'
  });
  const response = await request(app)
    .post('/api/me/photo')
    .set('Authorization', `Bearer ${registration.body.token}`)
    .attach('photo', Buffer.from([0xff, 0xd8, 0xff, 0xd9]), 'profile.jpg');

  assert.equal(response.status, 200);
  assert.match(response.body.photo, /^\/uploads\/.+\.jpg$/);
});

after(async () => {
  await db('customers').where({ email: 'test@example.com' }).del();
  await db('customers').where({ email: 'photo@example.com' }).del();
  await db.destroy();
});
