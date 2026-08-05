import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import app from '../../app.js';
import { authHeader, createCustomer, createAdmin, createWarehouseStaff } from '../helpers.js';

describe('RBAC on /api/admin/* routes', () => {
  let customer;
  let admin;
  let warehouseStaff;

  beforeAll(async () => {
    customer = await createCustomer();
    admin = await createAdmin();
    warehouseStaff = await createWarehouseStaff();
  });

  it('blocks anonymous requests with 401', async () => {
    const res = await request(app).get('/api/admin/products');
    expect(res.status).toBe(401);
  });

  it('rejects a malformed/garbage Authorization token with 401 (not a crash)', async () => {
    const res = await request(app).get('/api/admin/products').set('Authorization', 'Bearer not-a-real-jwt');
    expect(res.status).toBe(401);
  });

  it('blocks a logged-in CUSTOMER from admin routes with 403', async () => {
    const res = await request(app).get('/api/admin/products').set(authHeader(customer.token));
    expect(res.status).toBe(403);
  });

  it('blocks a WAREHOUSE_STAFF from admin-only routes with 403', async () => {
    const res = await request(app).get('/api/admin/products').set(authHeader(warehouseStaff.token));
    expect(res.status).toBe(403);
  });

  it('allows an ADMIN through', async () => {
    const res = await request(app).get('/api/admin/products').set(authHeader(admin.token));
    expect(res.status).toBe(200);
  });

  it('re-reads is_active from the DB on every request — a token issued before deactivation stops working immediately (L02)', async () => {
    const target = await createCustomer();
    const before = await request(app).get('/api/me').set(authHeader(target.token));
    expect(before.status).toBe(200);

    await request(app)
      .put(`/api/admin/users/${target.id}`)
      .set(authHeader(admin.token))
      .send({ is_active: false });

    const after = await request(app).get('/api/me').set(authHeader(target.token));
    expect(after.status).toBe(401);
  });
});
