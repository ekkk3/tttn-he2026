import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import app from '../../app.js';
import { createCustomer, uniquePhone, uniqueSuffix } from '../helpers.js';

describe('POST /api/register', () => {
  function validPayload(overrides = {}) {
    return {
      full_name: 'Nguyễn Văn A',
      email: `dangky${uniqueSuffix()}@example.test`,
      phone: uniquePhone(),
      password: 'Test@1234',
      ...overrides,
    };
  }

  it('creates an account and returns a usable access_token', async () => {
    const res = await request(app).post('/api/register').send(validPayload());
    expect(res.status).toBe(201);
    expect(res.body.access_token).toBeTruthy();
    expect(res.body.user.role).toBe('CUSTOMER');
  });

  it('rejects a whitespace-only full_name instead of silently trimming to blank', async () => {
    // Ho hai that: chuoi toan khoang trang la truthy trong JS nen lot qua "if (!full_name)".
    const res = await request(app).post('/api/register').send(validPayload({ full_name: '   ' }));
    expect(res.status).toBe(422);
    expect(res.body.message).toMatch(/họ và tên/i);
  });

  it('rejects an invalid email format', async () => {
    const res = await request(app).post('/api/register').send(validPayload({ email: 'not-an-email' }));
    expect(res.status).toBe(422);
  });

  it('rejects an invalid phone format', async () => {
    const res = await request(app).post('/api/register').send(validPayload({ phone: 'abcxyz' }));
    expect(res.status).toBe(422);
  });

  it('rejects a password shorter than 8 characters', async () => {
    const res = await request(app).post('/api/register').send(validPayload({ password: 'short1' }));
    expect(res.status).toBe(422);
  });

  it('rejects a missing required field', async () => {
    const payload = validPayload();
    delete payload.phone;
    const res = await request(app).post('/api/register').send(payload);
    expect(res.status).toBe(422);
  });

  it('rejects a duplicate email even if the phone number is new', async () => {
    const payload = validPayload();
    const first = await request(app).post('/api/register').send(payload);
    expect(first.status).toBe(201);

    const second = await request(app)
      .post('/api/register')
      .send(validPayload({ email: payload.email }));
    expect(second.status).toBe(422);
  });
});

describe('POST /api/login', () => {
  let account;

  beforeAll(async () => {
    account = await createCustomer({ email: `dangnhap${uniqueSuffix()}@example.test`, password: 'Test@1234' });
  });

  it('logs in with correct credentials', async () => {
    const res = await request(app).post('/api/login').send({ email: account.email, password: account.password });
    expect(res.status).toBe(200);
    expect(res.body.access_token).toBeTruthy();
    expect(res.body.user.email).toBe(account.email);
    // password_hash khong duoc lo ra ngoai response.
    expect(res.body.user.password_hash).toBeUndefined();
  });

  it('rejects a wrong password with 401 (not 500)', async () => {
    const res = await request(app).post('/api/login').send({ email: account.email, password: 'SaiMatKhau1' });
    expect(res.status).toBe(401);
  });

  it('rejects a missing password with 401 instead of crashing into bcrypt.compare (L09)', async () => {
    const res = await request(app).post('/api/login').send({ email: account.email });
    expect(res.status).toBe(401);
  });

  it('rejects a non-string password (e.g. a number) with 401 instead of 500', async () => {
    const res = await request(app).post('/api/login').send({ email: account.email, password: 12345678 });
    expect(res.status).toBe(401);
  });

  it('rejects an email that does not exist with the same generic message (no user enumeration)', async () => {
    const res = await request(app).post('/api/login').send({ email: 'khong-ton-tai@example.test', password: 'Test@1234' });
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Sai email hoặc mật khẩu.');
  });

  it('rejects a deactivated account with 403', async () => {
    const disabled = await createCustomer({ email: `bikhoa${uniqueSuffix()}@example.test`, password: 'Test@1234', isActive: 0 });
    const res = await request(app).post('/api/login').send({ email: disabled.email, password: disabled.password });
    expect(res.status).toBe(403);
  });
});
