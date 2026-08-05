import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import app from '../../app.js';
import { authHeader, createAdmin, uniqueSuffix } from '../helpers.js';

const MAX_MONEY_VALUE = 9_999_999_999_999; // Trần cột DECIMAL(15,2): 13 chữ số phần nguyên.

describe('POST /api/admin/vouchers (business validation)', () => {
  let admin;

  beforeAll(async () => {
    admin = await createAdmin();
  });

  function payload(overrides = {}) {
    return {
      code: `TEST-${uniqueSuffix()}`,
      discount_type: 'PERCENT',
      discount_value: 10,
      min_order_amount: 0,
      ...overrides,
    };
  }

  it('rejects a NEGATIVE discount_value (đợt 9 LỖI-01: âm khiến khách bị TÍNH THỪA tiền)', async () => {
    const res = await request(app)
      .post('/api/admin/vouchers')
      .set(authHeader(admin.token))
      .send(payload({ discount_type: 'PERCENT', discount_value: -20 }));
    expect(res.status).toBe(422);
  });

  it('rejects a PERCENT discount above 100%', async () => {
    const res = await request(app)
      .post('/api/admin/vouchers')
      .set(authHeader(admin.token))
      .send(payload({ discount_type: 'PERCENT', discount_value: 150 }));
    expect(res.status).toBe(422);
  });

  it('rejects a FIXED discount_value beyond the DECIMAL(15,2) column cap', async () => {
    const res = await request(app)
      .post('/api/admin/vouchers')
      .set(authHeader(admin.token))
      .send(payload({ discount_type: 'FIXED', discount_value: MAX_MONEY_VALUE + 1 }));
    expect(res.status).toBe(422);
  });

  it('rejects a min_order_amount beyond the DECIMAL(15,2) column cap', async () => {
    const res = await request(app)
      .post('/api/admin/vouchers')
      .set(authHeader(admin.token))
      .send(payload({ min_order_amount: MAX_MONEY_VALUE + 1 }));
    expect(res.status).toBe(422);
  });

  it('rejects a max_discount_amount beyond the DECIMAL(15,2) column cap', async () => {
    const res = await request(app)
      .post('/api/admin/vouchers')
      .set(authHeader(admin.token))
      .send(payload({ max_discount_amount: MAX_MONEY_VALUE + 1 }));
    expect(res.status).toBe(422);
  });

  it('rejects a max_discount_amount of 0 (must be strictly positive)', async () => {
    const res = await request(app)
      .post('/api/admin/vouchers')
      .set(authHeader(admin.token))
      .send(payload({ max_discount_amount: 0 }));
    expect(res.status).toBe(422);
  });

  it('accepts a valid voucher within all limits', async () => {
    const res = await request(app)
      .post('/api/admin/vouchers')
      .set(authHeader(admin.token))
      .send(payload({ discount_type: 'FIXED', discount_value: 30000, min_order_amount: 200000, max_discount_amount: null }));
    expect(res.status).toBe(201);
    expect(res.body.data.code).toBeTruthy();
  });

  it('rejects creating a voucher with a duplicate code', async () => {
    const body = payload();
    const first = await request(app).post('/api/admin/vouchers').set(authHeader(admin.token)).send(body);
    expect(first.status).toBe(201);
    const second = await request(app).post('/api/admin/vouchers').set(authHeader(admin.token)).send(body);
    expect(second.status).toBe(422);
  });

  it('PUT adminUpdate merges with the EXISTING record before validating (partial update)', async () => {
    // Ho hoi: doi discount_type PERCENT -> FIXED, discount_value cu (10) van con nguyen ->
    // neu chi soi body vua gui (thieu discount_value) se khong bat duoc "giam 10 dong" vo ly,
    // nhung neu gop sai chieu se tao ra "giam 500000%". Test nay chi xac nhan luong merge
    // khong lam validate crash/lot qua khi chi doi 1 truong.
    const createRes = await request(app)
      .post('/api/admin/vouchers')
      .set(authHeader(admin.token))
      .send(payload({ discount_type: 'FIXED', discount_value: 500000 }));
    expect(createRes.status).toBe(201);

    const updateRes = await request(app)
      .put(`/api/admin/vouchers/${createRes.body.data.id}`)
      .set(authHeader(admin.token))
      .send({ discount_type: 'PERCENT' });
    // discount_value cu (500000) gop voi discount_type moi (PERCENT) -> 500000% -> phai bi chan.
    expect(updateRes.status).toBe(422);
  });
});
