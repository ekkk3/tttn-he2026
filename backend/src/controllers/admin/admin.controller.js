import bcrypt from 'bcryptjs';
import { query } from '../../config/db.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

// Tat ca cac handler duoi day tuong ung 1-1 voi cac Controller trong
// app/Http/Controllers/Api/Admin/*.php cua repo Laravel goc, giu nguyen duong dan route
// (xem src/routes/api.routes.js) de frontend khong phai sua gi.

// ---------------- Dashboard ----------------
export const dashboard = asyncHandler(async (req, res) => {
  const [[{ total_orders }]] = [await query('SELECT COUNT(*) AS total_orders FROM orders')];
  const [[{ total_revenue }]] = [
    await query("SELECT COALESCE(SUM(total_amount),0) AS total_revenue FROM orders WHERE status NOT IN ('CANCELLED')"),
  ];
  const [[{ total_users }]] = [await query('SELECT COUNT(*) AS total_users FROM users WHERE is_deleted = 0')];
  const [[{ total_products }]] = [await query('SELECT COUNT(*) AS total_products FROM products WHERE is_deleted = 0')];
  const recentOrders = await query('SELECT * FROM orders ORDER BY id DESC LIMIT 10');
  res.json({ total_orders, total_revenue, total_users, total_products, recent_orders: recentOrders });
});

// ---------------- Users ----------------
// Ghi chu: frontend (use-admin-user-store.js, da co san tu truoc) doc { data: [...] }
// va can them cot tinh toan "orders_count" tren tung user — khong co san trong DB nen
// JOIN dem tu bang orders. Xem PLAN_3_TUAN.md muc "Sua backend cho khop frontend".
const USER_LIST_SELECT = `
  SELECT u.*, COALESCE(o.orders_count, 0) AS orders_count
  FROM users u
  LEFT JOIN (SELECT user_id, COUNT(*) AS orders_count FROM orders GROUP BY user_id) o
    ON o.user_id = u.id
`;

function stripPasswordHash(user) {
  if (!user) return user;
  const { password_hash, ...rest } = user;
  return rest;
}

export const listUsers = asyncHandler(async (req, res) => {
  const rows = await query(`${USER_LIST_SELECT} WHERE u.is_deleted = 0 ORDER BY u.id DESC`);
  res.json({ data: rows.map(stripPasswordHash) });
});
export const showUser = asyncHandler(async (req, res) => {
  const [user] = await query(`${USER_LIST_SELECT} WHERE u.id = ?`, [req.params.user]);
  if (!user) return res.status(404).json({ message: 'Khong tim thay nguoi dung.' });
  res.json({ data: stripPasswordHash(user) });
});
export const userOrders = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const perPage = Math.max(1, Number(req.query.per_page) || 5);
  const [[{ total }]] = [await query('SELECT COUNT(*) AS total FROM orders WHERE user_id = ?', [req.params.user])];
  const rows = await query(
    'SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC LIMIT ? OFFSET ?',
    [req.params.user, perPage, (page - 1) * perPage]
  );
  res.json({
    data: rows,
    current_page: page,
    last_page: Math.max(1, Math.ceil(total / perPage)),
    per_page: perPage,
    total,
  });
});
export const storeUser = asyncHandler(async (req, res) => {
  const { full_name, email, phone, password, role = 'CUSTOMER' } = req.body;
  if (!full_name || !email || !phone || !password) {
    return res.status(422).json({ message: 'full_name, email, phone, password la bat buoc.' });
  }
  const password_hash = await bcrypt.hash(password, 10);
  const result = await query(
    'INSERT INTO users (full_name, email, phone, password_hash, role, created_by_admin_id) VALUES (?, ?, ?, ?, ?, ?)',
    [full_name, email, phone, password_hash, role, req.user.id]
  );
  const [user] = await query(`${USER_LIST_SELECT} WHERE u.id = ?`, [result.insertId]);
  res.status(201).json({ data: stripPasswordHash(user) });
});
export const updateUser = asyncHandler(async (req, res) => {
  const {
    full_name, phone, role, is_active, address, city, favorite_region, avatar_url,
    newsletter, sms_alerts, order_email, security_alerts, reward_points, reward_tier, next_tier_points,
  } = req.body;
  await query(
    `UPDATE users SET full_name = COALESCE(?, full_name), phone = COALESCE(?, phone),
       role = COALESCE(?, role), is_active = COALESCE(?, is_active),
       address = COALESCE(?, address), city = COALESCE(?, city),
       favorite_region = COALESCE(?, favorite_region), avatar_url = COALESCE(?, avatar_url),
       newsletter = COALESCE(?, newsletter), sms_alerts = COALESCE(?, sms_alerts),
       order_email = COALESCE(?, order_email), security_alerts = COALESCE(?, security_alerts),
       reward_points = COALESCE(?, reward_points), reward_tier = COALESCE(?, reward_tier),
       next_tier_points = COALESCE(?, next_tier_points)
     WHERE id = ?`,
    [full_name, phone, role, is_active, address, city, favorite_region, avatar_url,
      newsletter, sms_alerts, order_email, security_alerts, reward_points, reward_tier, next_tier_points,
      req.params.user]
  );
  const [user] = await query(`${USER_LIST_SELECT} WHERE u.id = ?`, [req.params.user]);
  res.json({ data: stripPasswordHash(user) });
});
export const destroyUser = asyncHandler(async (req, res) => {
  await query('UPDATE users SET is_active = 0 WHERE id = ?', [req.params.user]);
  const [user] = await query(`${USER_LIST_SELECT} WHERE u.id = ?`, [req.params.user]);
  res.json({ data: stripPasswordHash(user) });
});

// ---------------- Admin accounts ----------------
export const listAdmins = asyncHandler(async (req, res) => {
  const rows = await query(
    `SELECT u.id, u.full_name, u.email, u.is_active, ar.name AS admin_role
     FROM users u LEFT JOIN admin_roles ar ON ar.id = u.admin_role_id
     WHERE u.role = 'ADMIN' AND u.is_deleted = 0 ORDER BY u.id DESC`
  );
  res.json({ admins: rows });
});
export const storeAdmin = asyncHandler(async (req, res) => {
  const { full_name, email, phone, password, admin_role_id } = req.body;
  const password_hash = await bcrypt.hash(password, 10);
  const result = await query(
    `INSERT INTO users (full_name, email, phone, password_hash, role, admin_role_id, created_by_admin_id)
     VALUES (?, ?, ?, ?, 'ADMIN', ?, ?)`,
    [full_name, email, phone, password_hash, admin_role_id || null, req.user.id]
  );
  res.status(201).json({ id: result.insertId });
});
export const updateAdmin = asyncHandler(async (req, res) => {
  const { full_name, admin_role_id } = req.body;
  await query(
    'UPDATE users SET full_name = COALESCE(?, full_name), admin_role_id = COALESCE(?, admin_role_id) WHERE id = ?',
    [full_name, admin_role_id, req.params.admin]
  );
  res.json({ message: 'Da cap nhat admin.' });
});
export const updateAdminStatus = asyncHandler(async (req, res) => {
  await query('UPDATE users SET is_active = ? WHERE id = ?', [req.body.is_active, req.params.admin]);
  res.json({ message: 'Da cap nhat trang thai admin.' });
});
export const updateAdminPassword = asyncHandler(async (req, res) => {
  const password_hash = await bcrypt.hash(req.body.password, 10);
  await query('UPDATE users SET password_hash = ? WHERE id = ?', [password_hash, req.params.admin]);
  res.json({ message: 'Da doi mat khau admin.' });
});

// ---------------- Products (admin CRUD) ----------------
export const listProducts = asyncHandler(async (req, res) => {
  const rows = await query('SELECT * FROM products WHERE is_deleted = 0 ORDER BY id DESC');
  res.json({ products: rows });
});
export const showProduct = asyncHandler(async (req, res) => {
  const [product] = await query('SELECT * FROM products WHERE id = ?', [req.params.id]);
  if (!product) return res.status(404).json({ message: 'Khong tim thay san pham.' });
  res.json({ product });
});
export const storeProduct = asyncHandler(async (req, res) => {
  const {
    category_id, supplier_id, region_id, sku, slug, name, description,
    image_url, sale_price, stock_quantity = 0,
  } = req.body;
  const result = await query(
    `INSERT INTO products (category_id, supplier_id, region_id, sku, slug, name, description,
       image_url, sale_price, stock_quantity)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [category_id, supplier_id || null, region_id || null, sku, slug || null, name,
      description || null, image_url || null, sale_price, stock_quantity]
  );
  // TODO: index san pham nay vao Elasticsearch tai day (esClient.index) de fuzzy search cap nhat kip thoi.
  res.status(201).json({ id: result.insertId });
});
export const updateProduct = asyncHandler(async (req, res) => {
  const fields = ['category_id', 'supplier_id', 'region_id', 'name', 'description', 'image_url', 'sale_price', 'stock_quantity'];
  const updates = [];
  const params = [];
  for (const f of fields) {
    if (req.body[f] !== undefined) { updates.push(`${f} = ?`); params.push(req.body[f]); }
  }
  if (!updates.length) return res.status(422).json({ message: 'Khong co truong nao de cap nhat.' });
  params.push(req.params.id);
  await query(`UPDATE products SET ${updates.join(', ')} WHERE id = ?`, params);
  res.json({ message: 'Da cap nhat san pham.' });
});
export const updateProductStatus = asyncHandler(async (req, res) => {
  await query('UPDATE products SET is_active = ? WHERE id = ?', [req.body.is_active, req.params.id]);
  res.json({ message: 'Da cap nhat trang thai san pham.' });
});
export const destroyProduct = asyncHandler(async (req, res) => {
  await query('UPDATE products SET is_deleted = 1 WHERE id = ?', [req.params.id]);
  res.json({ message: 'Da xoa san pham.' });
});

// ---------------- Orders (admin) ----------------
export const listOrders = asyncHandler(async (req, res) => {
  const rows = await query('SELECT * FROM orders ORDER BY id DESC');
  res.json({ orders: rows });
});
export const showOrder = asyncHandler(async (req, res) => {
  const [order] = await query('SELECT * FROM orders WHERE id = ?', [req.params.order]);
  if (!order) return res.status(404).json({ message: 'Khong tim thay don hang.' });
  const items = await query('SELECT * FROM order_items WHERE order_id = ?', [order.id]);
  res.json({ order: { ...order, items } });
});
export const bulkUpdateStatus = asyncHandler(async (req, res) => {
  const { order_ids, status } = req.body;
  if (!order_ids?.length) return res.status(422).json({ message: 'order_ids la bat buoc.' });
  await query(
    `UPDATE orders SET status = ? WHERE id IN (${order_ids.map(() => '?').join(',')})`,
    [status, ...order_ids]
  );
  res.json({ message: 'Da cap nhat trang thai cac don hang.' });
});
export const updateOrderStatus = asyncHandler(async (req, res) => {
  const { status, note } = req.body;
  await query('UPDATE orders SET status = ? WHERE id = ?', [status, req.params.order]);
  await query(
    'INSERT INTO order_status_history (order_id, to_status, note, changed_by_user_id) VALUES (?, ?, ?, ?)',
    [req.params.order, status, note || null, req.user.id]
  );
  res.json({ message: 'Da cap nhat trang thai don hang.' });
});
export const updatePaymentStatus = asyncHandler(async (req, res) => {
  const { payment_status } = req.body;
  await query('UPDATE payments SET payment_status = ? WHERE order_id = ?', [payment_status, req.params.order]);
  res.json({ message: 'Da cap nhat trang thai thanh toan.' });
});

// ---------------- Order shipment ----------------
export const storeShipment = asyncHandler(async (req, res) => {
  const { shipping_carrier_id, weight, length, width, height } = req.body;
  const result = await query(
    `INSERT INTO order_shipments (order_id, shipping_carrier_id, provider, status, weight, length, width, height, created_by_user_id)
     VALUES (?, ?, 'GHN', 'created', ?, ?, ?, ?, ?)`,
    [req.params.order, shipping_carrier_id, weight, length, width, height, req.user.id]
  );
  // TODO: goi GHN "tao don hang" API tai day (utils/ghn.js) va luu tracking_code/tracking_url tra ve.
  res.status(201).json({ id: result.insertId });
});
export const syncShipment = asyncHandler(async (req, res) => {
  // TODO: goi GHN "chi tiet don hang" API de dong bo lai status/tracking.
  res.json({ message: 'Chua noi voi GHN — can bo sung goi API "order detail" tai day.' });
});
export const destroyShipment = asyncHandler(async (req, res) => {
  await query('DELETE FROM order_shipments WHERE order_id = ?', [req.params.order]);
  res.json({ message: 'Da xoa van don.' });
});

// ---------------- Shipping carriers ----------------
export const listShippingCarriers = asyncHandler(async (req, res) => {
  const rows = await query('SELECT * FROM shipping_carriers WHERE is_deleted = 0 ORDER BY id DESC');
  res.json({ shipping_carriers: rows });
});
export const storeShippingCarrier = asyncHandler(async (req, res) => {
  const { code, name, provider = 'MANUAL' } = req.body;
  const result = await query('INSERT INTO shipping_carriers (code, name, provider) VALUES (?, ?, ?)', [
    code, name, provider,
  ]);
  res.status(201).json({ id: result.insertId });
});
export const updateShippingCarrier = asyncHandler(async (req, res) => {
  const { name, is_active } = req.body;
  await query(
    'UPDATE shipping_carriers SET name = COALESCE(?, name), is_active = COALESCE(?, is_active) WHERE id = ?',
    [name, is_active, req.params.carrier]
  );
  res.json({ message: 'Da cap nhat don vi van chuyen.' });
});
export const destroyShippingCarrier = asyncHandler(async (req, res) => {
  await query('UPDATE shipping_carriers SET is_deleted = 1 WHERE id = ?', [req.params.carrier]);
  res.json({ message: 'Da xoa don vi van chuyen.' });
});

// ---------------- Settings ----------------
export const showSettings = asyncHandler(async (req, res) => {
  const [settings] = await query('SELECT * FROM admin_settings WHERE user_id = ?', [req.user.id]);
  res.json({ settings: settings || null });
});
export const updateSettings = asyncHandler(async (req, res) => {
  const { store_name, support_email, support_phone, low_stock_threshold } = req.body;
  await query(
    `INSERT INTO admin_settings (user_id, store_name, support_email, support_phone, low_stock_threshold)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE store_name = VALUES(store_name), support_email = VALUES(support_email),
       support_phone = VALUES(support_phone), low_stock_threshold = VALUES(low_stock_threshold)`,
    [req.user.id, store_name, support_email, support_phone, low_stock_threshold]
  );
  res.json({ message: 'Da cap nhat cai dat.' });
});

// ---------------- Community (moi NCC + kiem duyet bai viet) ----------------
export const listCommunity = asyncHandler(async (req, res) => {
  const invitations = await query('SELECT * FROM supplier_invitations ORDER BY id DESC');
  res.json({ invitations });
});
export const storeInvitation = asyncHandler(async (req, res) => {
  const { supplier_name, contact_name, email, note } = req.body;
  const result = await query(
    'INSERT INTO supplier_invitations (supplier_name, contact_name, email, note, created_by_user_id) VALUES (?, ?, ?, ?, ?)',
    [supplier_name, contact_name, email, note || null, req.user.id]
  );
  res.status(201).json({ id: result.insertId });
});

// ---------------- Admin posts CRUD ----------------
export const listAdminPosts = asyncHandler(async (req, res) => {
  const rows = await query('SELECT * FROM posts ORDER BY id DESC');
  res.json({ posts: rows });
});
export const storePost = asyncHandler(async (req, res) => {
  const { title, excerpt, body, cover_image_url, status = 'DRAFT' } = req.body;
  const result = await query(
    `INSERT INTO posts (created_by_user_id, title, excerpt, body, cover_image_url, status, published_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [req.user.id, title, excerpt || null, body, cover_image_url || null, status, status === 'PUBLISHED' ? new Date() : null]
  );
  res.status(201).json({ id: result.insertId });
});
export const updatePost = asyncHandler(async (req, res) => {
  const { title, excerpt, body, status } = req.body;
  await query(
    'UPDATE posts SET title = COALESCE(?, title), excerpt = COALESCE(?, excerpt), body = COALESCE(?, body), status = COALESCE(?, status) WHERE id = ?',
    [title, excerpt, body, status, req.params.post]
  );
  res.json({ message: 'Da cap nhat bai viet.' });
});
export const destroyPost = asyncHandler(async (req, res) => {
  await query('DELETE FROM posts WHERE id = ?', [req.params.post]);
  res.json({ message: 'Da xoa bai viet.' });
});
export const updateCommentVisibility = asyncHandler(async (req, res) => {
  const { status } = req.body; // 'VISIBLE' | 'HIDDEN'
  await query(
    'UPDATE post_comments SET status = ?, hidden_by_user_id = ?, hidden_at = NOW() WHERE id = ?',
    [status, req.user.id, req.params.comment]
  );
  res.json({ message: 'Da cap nhat trang thai binh luan.' });
});
