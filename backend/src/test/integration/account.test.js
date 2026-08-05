import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import app from '../../app.js';
import { authHeader, createCustomer, createProduct } from '../helpers.js';
import { query } from '../../config/db.js';

describe('GET/PUT /api/account/profile', () => {
  let customer;

  beforeAll(async () => {
    customer = await createCustomer();
  });

  it('returns the logged-in user profile', async () => {
    const res = await request(app).get('/api/account/profile').set(authHeader(customer.token));
    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe(customer.email);
  });

  it('requires auth', async () => {
    const res = await request(app).get('/api/account/profile');
    expect(res.status).toBe(401);
  });

  it('updates only the fields sent (partial update)', async () => {
    const res = await request(app)
      .put('/api/account/profile')
      .set(authHeader(customer.token))
      .send({ city: 'Hà Nội' });
    expect(res.status).toBe(200);
    expect(res.body.data.city).toBe('Hà Nội');
    expect(res.body.data.name).toBeTruthy(); // full_name khong bi xoa mat du khong gui len.
  });

  it('rejects an invalid phone format on update', async () => {
    const res = await request(app)
      .put('/api/account/profile')
      .set(authHeader(customer.token))
      .send({ phone: 'khong-phai-sdt' });
    expect(res.status).toBe(422);
  });
});

describe('PATCH /api/account/password', () => {
  let customer;

  beforeAll(async () => {
    customer = await createCustomer({ password: 'Original@123' });
  });

  it('rejects when current_password is wrong', async () => {
    const res = await request(app)
      .patch('/api/account/password')
      .set(authHeader(customer.token))
      .send({ current_password: 'SaiRoi123', new_password: 'NewPass@123', new_password_confirmation: 'NewPass@123' });
    expect(res.status).toBe(422);
  });

  it('rejects a missing new_password instead of crashing bcrypt.hash(undefined) (L10)', async () => {
    const res = await request(app)
      .patch('/api/account/password')
      .set(authHeader(customer.token))
      .send({ current_password: customer.password });
    expect(res.status).toBe(422);
  });

  it('rejects a mismatched confirmation', async () => {
    const res = await request(app)
      .patch('/api/account/password')
      .set(authHeader(customer.token))
      .send({ current_password: customer.password, new_password: 'NewPass@123', new_password_confirmation: 'Different@123' });
    expect(res.status).toBe(422);
  });

  it('changes the password and the OLD password stops working', async () => {
    const res = await request(app)
      .patch('/api/account/password')
      .set(authHeader(customer.token))
      .send({ current_password: customer.password, new_password: 'NewPass@123', new_password_confirmation: 'NewPass@123' });
    expect(res.status).toBe(200);

    const oldLogin = await request(app).post('/api/login').send({ email: customer.email, password: customer.password });
    expect(oldLogin.status).toBe(401);

    const newLogin = await request(app).post('/api/login').send({ email: customer.email, password: 'NewPass@123' });
    expect(newLogin.status).toBe(200);
  });
});

describe('Account addresses (ownership enforced)', () => {
  let owner;
  let intruder;
  let addressId;

  beforeAll(async () => {
    owner = await createCustomer();
    intruder = await createCustomer();
    const res = await request(app)
      .post('/api/account/addresses')
      .set(authHeader(owner.token))
      .send({ recipient: 'Nguyễn Văn A', phone: '0912345678', line1: '123 Đường ABC', city: 'Hà Nội' });
    expect(res.status).toBe(201);
    addressId = res.body.data.addresses[0].id;
  });

  it('rejects creating an address without recipient/line1', async () => {
    const res = await request(app).post('/api/account/addresses').set(authHeader(owner.token)).send({ phone: '0912345678' });
    expect(res.status).toBe(422);
  });

  it('rejects an invalid recipient phone', async () => {
    const res = await request(app)
      .post('/api/account/addresses')
      .set(authHeader(owner.token))
      .send({ recipient: 'A', phone: 'abc', line1: 'xyz' });
    expect(res.status).toBe(422);
  });

  it("404s when another user tries to update someone else's address (not a silent 200)", async () => {
    const res = await request(app)
      .put(`/api/account/addresses/${addressId}`)
      .set(authHeader(intruder.token))
      .send({ label: 'Hacked' });
    expect(res.status).toBe(404);
  });

  it("404s when another user tries to delete someone else's address", async () => {
    const res = await request(app).delete(`/api/account/addresses/${addressId}`).set(authHeader(intruder.token));
    expect(res.status).toBe(404);
  });

  it("confirms the intruder's attempts did NOT change the data", async () => {
    const [row] = await query('SELECT label FROM user_addresses WHERE id = ?', [addressId]);
    expect(row.label).not.toBe('Hacked');
  });

  it('lets the OWNER update their own address', async () => {
    const res = await request(app).put(`/api/account/addresses/${addressId}`).set(authHeader(owner.token)).send({ label: 'Nhà riêng' });
    expect(res.status).toBe(200);
  });

  it('lets the owner set the address as default', async () => {
    const res = await request(app).patch(`/api/account/addresses/${addressId}/default`).set(authHeader(owner.token));
    expect(res.status).toBe(200);
    expect(res.body.data.addresses.find((a) => a.id === addressId).is_default).toBe(true);
  });

  it('lets the owner delete their own address', async () => {
    const res = await request(app).delete(`/api/account/addresses/${addressId}`).set(authHeader(owner.token));
    expect(res.status).toBe(200);
  });
});

describe('POST /api/account/rewards/redeem', () => {
  it('rejects a NEGATIVE points_cost instead of GRANTING points (the historic critical bug)', async () => {
    const customer = await createCustomer();
    await query('UPDATE users SET reward_points = 100 WHERE id = ?', [customer.id]);

    const res = await request(app)
      .post('/api/account/rewards/redeem')
      .set(authHeader(customer.token))
      .send({ title: 'Ưu đãi test', points_cost: -500000 });
    expect(res.status).toBe(422);

    const [row] = await query('SELECT reward_points FROM users WHERE id = ?', [customer.id]);
    expect(row.reward_points).toBe(100); // KHONG duoc tang len 600100.
  });

  it('rejects a non-integer points_cost', async () => {
    const customer = await createCustomer();
    await query('UPDATE users SET reward_points = 100 WHERE id = ?', [customer.id]);
    const res = await request(app)
      .post('/api/account/rewards/redeem')
      .set(authHeader(customer.token))
      .send({ title: 'x', points_cost: 10.5 });
    expect(res.status).toBe(422);
  });

  it('rejects redeeming more points than the balance', async () => {
    const customer = await createCustomer();
    await query('UPDATE users SET reward_points = 50 WHERE id = ?', [customer.id]);
    const res = await request(app)
      .post('/api/account/rewards/redeem')
      .set(authHeader(customer.token))
      .send({ title: 'x', points_cost: 100 });
    expect(res.status).toBe(422);
  });

  it('redeems successfully within balance and deducts exactly the cost', async () => {
    const customer = await createCustomer();
    await query('UPDATE users SET reward_points = 500 WHERE id = ?', [customer.id]);
    const res = await request(app)
      .post('/api/account/rewards/redeem')
      .set(authHeader(customer.token))
      .send({ title: 'Voucher 100k', points_cost: 300 });
    expect(res.status).toBe(201);
    expect(res.body.data.reward_snapshot.points).toBe(200);
  });
});

describe('Wishlist', () => {
  let customer;

  beforeAll(async () => {
    customer = await createCustomer();
  });

  it('404s adding a non-existent product instead of silently accepting it (INSERT IGNORE trap)', async () => {
    const res = await request(app)
      .post('/api/account/wishlist/items')
      .set(authHeader(customer.token))
      .send({ product_id: 999999999 });
    expect(res.status).toBe(404);
  });

  it('adds a real product and lists it back', async () => {
    const product = await createProduct();
    const res = await request(app).post('/api/account/wishlist/items').set(authHeader(customer.token)).send({ product_id: product.id });
    expect(res.status).toBe(201);
    expect(res.body.data.product_ids).toContain(product.id);
  });

  it('adding the same product twice does not error (idempotent "like")', async () => {
    const product = await createProduct();
    await request(app).post('/api/account/wishlist/items').set(authHeader(customer.token)).send({ product_id: product.id });
    const res = await request(app).post('/api/account/wishlist/items').set(authHeader(customer.token)).send({ product_id: product.id });
    expect(res.status).toBe(201);
  });

  it('removes an item from the wishlist', async () => {
    const product = await createProduct();
    await request(app).post('/api/account/wishlist/items').set(authHeader(customer.token)).send({ product_id: product.id });
    const res = await request(app).delete(`/api/account/wishlist/items/${product.id}`).set(authHeader(customer.token));
    expect(res.status).toBe(200);
    expect(res.body.data.product_ids).not.toContain(product.id);
  });
});
