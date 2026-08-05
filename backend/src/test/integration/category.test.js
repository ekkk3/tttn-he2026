import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import app from '../../app.js';
import { authHeader, createAdmin, createCategory, createProduct, uniqueSuffix } from '../helpers.js';

describe('Public category endpoints', () => {
  it('GET /api/categories lists active categories', async () => {
    const res = await request(app).get('/api/categories');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/categories/:id 404s for a non-existent category', async () => {
    const res = await request(app).get('/api/categories/999999999');
    expect(res.status).toBe(404);
  });

  it('GET /api/categories/:id/products returns products belonging to that category', async () => {
    const category = await createCategory();
    const product = await createProduct({ categoryId: category.id });
    const res = await request(app).get(`/api/categories/${category.id}/products`);
    expect(res.status).toBe(200);
    expect(res.body.data.some((p) => p.id === product.id)).toBe(true);
  });
});

describe('Admin category endpoints', () => {
  let admin;

  beforeAll(async () => {
    admin = await createAdmin();
  });

  it('creates a category', async () => {
    const res = await request(app)
      .post('/api/admin/categories')
      .set(authHeader(admin.token))
      .send({ name: `Danh mục ${uniqueSuffix()}` });
    expect(res.status).toBe(201);
  });

  it('rejects a blank name', async () => {
    const res = await request(app).post('/api/admin/categories').set(authHeader(admin.token)).send({ name: '   ' });
    expect(res.status).toBe(422);
  });

  it('rejects a DUPLICATE category name on create (L11)', async () => {
    const name = `Trùng tên ${uniqueSuffix()}`;
    const first = await request(app).post('/api/admin/categories').set(authHeader(admin.token)).send({ name });
    expect(first.status).toBe(201);
    const second = await request(app).post('/api/admin/categories').set(authHeader(admin.token)).send({ name });
    expect(second.status).toBe(422);
  });

  it('rejects renaming a category to a name that already exists on ANOTHER category (L11)', async () => {
    const nameA = `Danh mục A ${uniqueSuffix()}`;
    const nameB = `Danh mục B ${uniqueSuffix()}`;
    const a = await request(app).post('/api/admin/categories').set(authHeader(admin.token)).send({ name: nameA });
    await request(app).post('/api/admin/categories').set(authHeader(admin.token)).send({ name: nameB });

    const rename = await request(app).put(`/api/admin/categories/${a.body.data.id}`).set(authHeader(admin.token)).send({ name: nameB });
    expect(rename.status).toBe(422);
  });

  it('allows saving a category with its OWN unchanged name (excludeId works)', async () => {
    const name = `Giữ nguyên tên ${uniqueSuffix()}`;
    const created = await request(app).post('/api/admin/categories').set(authHeader(admin.token)).send({ name });
    const resaved = await request(app)
      .put(`/api/admin/categories/${created.body.data.id}`)
      .set(authHeader(admin.token))
      .send({ name, description: 'cập nhật mô tả' });
    expect(resaved.status).toBe(200);
  });

  it('404s updating a non-existent category', async () => {
    const res = await request(app).put('/api/admin/categories/999999999').set(authHeader(admin.token)).send({ name: 'x' });
    expect(res.status).toBe(404);
  });

  it('blocks deleting a category that still has active products (L12)', async () => {
    const category = await request(app)
      .post('/api/admin/categories')
      .set(authHeader(admin.token))
      .send({ name: `Có sản phẩm ${uniqueSuffix()}` });
    await createProduct({ categoryId: category.body.data.id });

    const res = await request(app).delete(`/api/admin/categories/${category.body.data.id}`).set(authHeader(admin.token));
    expect(res.status).toBe(409);
  });

  it('allows deleting an empty category', async () => {
    const category = await request(app)
      .post('/api/admin/categories')
      .set(authHeader(admin.token))
      .send({ name: `Rỗng ${uniqueSuffix()}` });
    const res = await request(app).delete(`/api/admin/categories/${category.body.data.id}`).set(authHeader(admin.token));
    expect(res.status).toBe(200);
  });

  it('404s deleting a non-existent category', async () => {
    const res = await request(app).delete('/api/admin/categories/999999999').set(authHeader(admin.token));
    expect(res.status).toBe(404);
  });
});
