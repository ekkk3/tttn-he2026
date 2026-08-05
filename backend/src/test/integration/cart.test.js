import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import app from '../../app.js';
import { authHeader, createCustomer, createProduct } from '../helpers.js';

describe('GET /api/cart', () => {
  it('creates an empty cart on first access', async () => {
    const customer = await createCustomer();
    const res = await request(app).get('/api/cart').set(authHeader(customer.token));
    expect(res.status).toBe(200);
    expect(res.body.data.items).toEqual([]);
  });
});

describe('POST /api/cart/items', () => {
  it('rejects a zero/negative/non-integer quantity', async () => {
    const customer = await createCustomer();
    const product = await createProduct({ stockQuantity: 10 });
    for (const quantity of [0, -1, 1.5, 'abc']) {
      const res = await request(app).post('/api/cart/items').set(authHeader(customer.token)).send({ product_id: product.id, quantity });
      expect(res.status).toBe(422);
    }
  });

  it('404s for a non-existent product', async () => {
    const customer = await createCustomer();
    const res = await request(app).post('/api/cart/items').set(authHeader(customer.token)).send({ product_id: 999999999, quantity: 1 });
    expect(res.status).toBe(404);
  });

  it('blocks adding more than the available stock', async () => {
    const customer = await createCustomer();
    const product = await createProduct({ stockQuantity: 5 });
    const res = await request(app).post('/api/cart/items').set(authHeader(customer.token)).send({ product_id: product.id, quantity: 6 });
    expect(res.status).toBe(422);
  });

  it('accumulates quantity across repeated adds and blocks once the TOTAL exceeds stock', async () => {
    const customer = await createCustomer();
    const product = await createProduct({ stockQuantity: 5 });
    const first = await request(app).post('/api/cart/items').set(authHeader(customer.token)).send({ product_id: product.id, quantity: 3 });
    expect(first.status).toBe(201);
    expect(first.body.data.items[0].quantity).toBe(3);

    // 3 da co + 3 them = 6, vuot ton kho 5 -> phai bi chan (khong duoc cong don thanh 6).
    const second = await request(app).post('/api/cart/items').set(authHeader(customer.token)).send({ product_id: product.id, quantity: 3 });
    expect(second.status).toBe(422);
  });

  it('computes line_total as unit_price * quantity', async () => {
    const customer = await createCustomer();
    const product = await createProduct({ stockQuantity: 10, salePrice: 50000 });
    const res = await request(app).post('/api/cart/items').set(authHeader(customer.token)).send({ product_id: product.id, quantity: 2 });
    expect(res.body.data.items[0].line_total).toBe(100000);
  });
});

describe('PATCH /api/cart/items/:cartItem (ownership + stock)', () => {
  it("404s when updating ANOTHER user's cart item (IDOR)", async () => {
    const owner = await createCustomer();
    const intruder = await createCustomer();
    const product = await createProduct({ stockQuantity: 10 });
    const added = await request(app).post('/api/cart/items').set(authHeader(owner.token)).send({ product_id: product.id, quantity: 1 });
    const itemId = added.body.data.items[0].id;

    const res = await request(app).patch(`/api/cart/items/${itemId}`).set(authHeader(intruder.token)).send({ quantity: 2 });
    expect(res.status).toBe(404);
  });

  it('blocks updating to a quantity above stock', async () => {
    const customer = await createCustomer();
    const product = await createProduct({ stockQuantity: 5 });
    const added = await request(app).post('/api/cart/items').set(authHeader(customer.token)).send({ product_id: product.id, quantity: 1 });
    const itemId = added.body.data.items[0].id;

    const res = await request(app).patch(`/api/cart/items/${itemId}`).set(authHeader(customer.token)).send({ quantity: 999 });
    expect(res.status).toBe(422);
  });

  it('lets the owner update their own item quantity', async () => {
    const customer = await createCustomer();
    const product = await createProduct({ stockQuantity: 10 });
    const added = await request(app).post('/api/cart/items').set(authHeader(customer.token)).send({ product_id: product.id, quantity: 1 });
    const itemId = added.body.data.items[0].id;

    const res = await request(app).patch(`/api/cart/items/${itemId}`).set(authHeader(customer.token)).send({ quantity: 3 });
    expect(res.status).toBe(200);
  });
});

describe('DELETE /api/cart/items/:cartItem (ownership)', () => {
  it("404s deleting ANOTHER user's cart item, and does NOT delete it", async () => {
    const owner = await createCustomer();
    const intruder = await createCustomer();
    const product = await createProduct({ stockQuantity: 10 });
    const added = await request(app).post('/api/cart/items').set(authHeader(owner.token)).send({ product_id: product.id, quantity: 1 });
    const itemId = added.body.data.items[0].id;

    const res = await request(app).delete(`/api/cart/items/${itemId}`).set(authHeader(intruder.token));
    expect(res.status).toBe(404);

    const stillThere = await request(app).get('/api/cart').set(authHeader(owner.token));
    expect(stillThere.body.data.items.some((i) => i.id === itemId)).toBe(true);
  });

  it('lets the owner delete their own item', async () => {
    const customer = await createCustomer();
    const product = await createProduct({ stockQuantity: 10 });
    const added = await request(app).post('/api/cart/items').set(authHeader(customer.token)).send({ product_id: product.id, quantity: 1 });
    const itemId = added.body.data.items[0].id;

    const res = await request(app).delete(`/api/cart/items/${itemId}`).set(authHeader(customer.token));
    expect(res.status).toBe(200);
    expect(res.body.data.items.some((i) => i.id === itemId)).toBe(false);
  });
});
