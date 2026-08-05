// GHN_TOKEN rong trong .env.test (khong co sandbox that de goi) -> ca 4 endpoint phai
// GRACEFUL FALLBACK thay vi lam sap request cua khach dang checkout.
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import app from '../../app.js';

describe('GET /api/shipping/ghn/* (GHN not configured in test env)', () => {
  it('provinces falls back to an empty list instead of erroring', async () => {
    const res = await request(app).get('/api/shipping/ghn/provinces');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('districts falls back to an empty list', async () => {
    const res = await request(app).get('/api/shipping/ghn/districts').query({ province_id: 1 });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('wards falls back to an empty list', async () => {
    const res = await request(app).get('/api/shipping/ghn/wards').query({ district_id: 1 });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('fee reports configured:false instead of crashing checkout', async () => {
    const res = await request(app)
      .post('/api/shipping/ghn/fee')
      .send({ to_district_id: 1, to_ward_code: '00001' });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ configured: false, fee: null });
  });
});
