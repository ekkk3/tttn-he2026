import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import app from '../../app.js';
import { createProduct } from '../helpers.js';

describe('GET /api/products?keyword= (LIKE wildcard escaping)', () => {
  beforeAll(async () => {
    // Ton tai san co it nhat 1 san pham trong CSDL test de phan biet "tim dung ra 0 vi
    // khong co gi ca" voi "tim dung ra 0 vi escape lam hong ca tim kiem hop le".
    await createProduct({ name: 'Nước mắm Phú Quốc test' });
  });

  it('treats a bare "_" as a LITERAL underscore, not "match any character"', async () => {
    // Bug that: LIKE '%_%' (chua escape) khop MOI san pham vi '_' la wildcard 1 ky tu.
    // Sau khi escape dung, "_" chi con khop ten san pham co dau gach duoi that su (khong co
    // san pham nao trong fixture) -> phai ra 0, KHONG PHAI toan bo danh sach.
    const res = await request(app).get('/api/products').query({ keyword: '_', per_page: 50 });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('treats a bare "%" as a LITERAL percent sign, not "match anything"', async () => {
    const res = await request(app).get('/api/products').query({ keyword: '%', per_page: 50 });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('still matches a real keyword normally (escaping does not break legitimate search)', async () => {
    const res = await request(app).get('/api/products').query({ keyword: 'Phú Quốc test', per_page: 50 });
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
  });
});
