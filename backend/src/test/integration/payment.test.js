// VNPAY_HASH_SECRET / MOMO_SECRET_KEY rong trong .env.test (khong co sandbox that) -> moi
// endpoint phai bao "chua cau hinh"/tu choi ro rang thay vi 200 gia vo thanh cong.
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import app from '../../app.js';

describe('GET /api/payments/vnpay/return (not configured)', () => {
  it('returns 503 instead of pretending payment succeeded', async () => {
    const res = await request(app).get('/api/payments/vnpay/return').query({ vnp_TxnRef: '1', vnp_ResponseCode: '00' });
    expect(res.status).toBe(503);
    expect(res.body.data.verified).toBe(false);
  });
});

describe('GET /api/payments/vnpay/ipn (not configured)', () => {
  it('replies with VNPay-format RspCode 97 (invalid signature), not a raw HTTP error', async () => {
    const res = await request(app).get('/api/payments/vnpay/ipn').query({ vnp_TxnRef: '1', vnp_ResponseCode: '00' });
    expect(res.status).toBe(200);
    expect(res.body.RspCode).toBe('97');
  });
});

describe('GET /api/payments/momo/return (not configured)', () => {
  it('returns 503 instead of pretending payment succeeded', async () => {
    const res = await request(app).get('/api/payments/momo/return').query({ resultCode: '0' });
    expect(res.status).toBe(503);
    expect(res.body.data.verified).toBe(false);
  });
});

describe('POST /api/payments/momo/ipn (not configured)', () => {
  it('acknowledges with 204 without marking any order as paid', async () => {
    const res = await request(app).post('/api/payments/momo/ipn').send({ resultCode: '0', orderId: '1-req' });
    expect(res.status).toBe(204);
  });
});
