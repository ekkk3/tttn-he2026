// Truoc dot sua gan day, cac endpoint UPDATE/DESTROY nay chay thang cau UPDATE voi id bat
// ky: khong khop dong nao thi MySQL coi la binh thuong (affectedRows = 0), roi SELECT lai
// tra ve undefined -> endpoint van dap 200 kem { data: null }. Voi nguoi goi, "sua thanh
// cong nhung khong co du lieu" va "khong tim thay ban ghi" trong giong het nhau. Nhung test
// nay khoa lai dung hanh vi 404 ro rang cho tung endpoint, tranh regression ve sau.
import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import app from '../../app.js';
import { authHeader, createAdmin } from '../helpers.js';

const NOT_FOUND_ID = 999999999;

describe('Admin endpoints return 404 (not 200 { data: null }) for a non-existent id', () => {
  let admin;

  beforeAll(async () => {
    admin = await createAdmin();
  });

  it('PUT /api/admin/products/:id', async () => {
    const res = await request(app)
      .put(`/api/admin/products/${NOT_FOUND_ID}`)
      .set(authHeader(admin.token))
      .send({ name: 'x' });
    expect(res.status).toBe(404);
  });

  it('DELETE /api/admin/products/:id', async () => {
    const res = await request(app).delete(`/api/admin/products/${NOT_FOUND_ID}`).set(authHeader(admin.token));
    expect(res.status).toBe(404);
  });

  it('PUT /api/admin/shipping-carriers/:carrier', async () => {
    const res = await request(app)
      .put(`/api/admin/shipping-carriers/${NOT_FOUND_ID}`)
      .set(authHeader(admin.token))
      .send({ name: 'x' });
    expect(res.status).toBe(404);
  });

  it('DELETE /api/admin/shipping-carriers/:carrier', async () => {
    const res = await request(app).delete(`/api/admin/shipping-carriers/${NOT_FOUND_ID}`).set(authHeader(admin.token));
    expect(res.status).toBe(404);
  });

  it('PUT /api/admin/admins/:admin', async () => {
    const res = await request(app)
      .put(`/api/admin/admins/${NOT_FOUND_ID}`)
      .set(authHeader(admin.token))
      .send({ full_name: 'x' });
    expect(res.status).toBe(404);
  });

  it('PATCH /api/admin/admins/:admin/status', async () => {
    const res = await request(app)
      .patch(`/api/admin/admins/${NOT_FOUND_ID}/status`)
      .set(authHeader(admin.token))
      .send({ is_active: 1 });
    expect(res.status).toBe(404);
  });

  it('PATCH /api/admin/admins/:admin/password', async () => {
    const res = await request(app)
      .patch(`/api/admin/admins/${NOT_FOUND_ID}/password`)
      .set(authHeader(admin.token))
      .send({ password: 'Abcdefgh1' });
    expect(res.status).toBe(404);
  });

  it('PUT /api/admin/suppliers/:supplier', async () => {
    const res = await request(app)
      .put(`/api/admin/suppliers/${NOT_FOUND_ID}`)
      .set(authHeader(admin.token))
      .send({ name: 'x' });
    expect(res.status).toBe(404);
  });

  it('DELETE /api/admin/suppliers/:supplier', async () => {
    const res = await request(app).delete(`/api/admin/suppliers/${NOT_FOUND_ID}`).set(authHeader(admin.token));
    expect(res.status).toBe(404);
  });

  it('PATCH /api/admin/reviews/:id/moderate', async () => {
    const res = await request(app)
      .patch(`/api/admin/reviews/${NOT_FOUND_ID}/moderate`)
      .set(authHeader(admin.token))
      .send({ status: 'HIDDEN' });
    expect(res.status).toBe(404);
  });

  it('DELETE /api/admin/vouchers/:voucher', async () => {
    const res = await request(app).delete(`/api/admin/vouchers/${NOT_FOUND_ID}`).set(authHeader(admin.token));
    expect(res.status).toBe(404);
  });
});
