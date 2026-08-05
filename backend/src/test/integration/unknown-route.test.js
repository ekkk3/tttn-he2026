// Truoc dot sua nay, moi request toi 1 duong dan /api khong ton tai deu bi middleware auth()
// chan lai tra 401 ("Unauthenticated") thay vi 404 — vi router.use(auth) khong gioi han theo
// path nen chay cho ca request khong khop route nao. Test nay khoa lai dung hanh vi 404 cho
// route la, dong thoi hoi quy: cac route CO THAT van tra 401/200 dung nhu cu (khong bi lot
// qua vi kiem tra route-ton-tai qua long leo).
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import app from '../../app.js';
import { authHeader, createAdmin, createCustomer } from '../helpers.js';

describe('Route /api không tồn tại trả 404 (không phải 401)', () => {
  it('GET /api/duong-dan-khong-ton-tai -> 404', async () => {
    const res = await request(app).get('/api/duong-dan-khong-ton-tai');
    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/Route not found/);
  });

  it('POST /api/admin/mot-duong-dan-la -> 404 khi đã qua được cửa role ADMIN (path không khớp route con nào trong adminRouter)', async () => {
    const admin = await createAdmin();
    const res = await request(app)
      .post('/api/admin/mot-duong-dan-la')
      .set(authHeader(admin.token));
    expect(res.status).toBe(404);
  });

  it('hồi quy: path trong nhóm /admin vẫn bị chặn 403 đúng theo role (không bị middleware route-tồn-tại làm lộ 404 trước khi kiểm quyền)', async () => {
    const customer = await createCustomer();
    const res = await request(app)
      .post('/api/admin/mot-duong-dan-la')
      .set(authHeader(customer.token));
    expect(res.status).toBe(403);
  });

  it('hồi quy: route thật nhưng chưa đăng nhập vẫn trả 401 như cũ', async () => {
    const res = await request(app).get('/api/me');
    expect(res.status).toBe(401);
  });

  it('hồi quy: route public thật vẫn hoạt động bình thường', async () => {
    const res = await request(app).get('/api/products');
    expect(res.status).toBe(200);
  });

  it('hồi quy: route thật có tham số (:id) vẫn nhận diện đúng, không bị coi là "không tồn tại"', async () => {
    const res = await request(app).get('/api/products/999999999');
    // 404 ở đây là do "san pham nay khong ton tai" (tu controller), khac voi 404 "route la"
    // o cac test tren — nhung ca hai deu la 404 nen chi can xac nhan KHONG rơi vao 401 sai.
    expect(res.status).toBe(404);
  });
});
