import bcrypt from 'bcryptjs';
import { query } from '../../config/db.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

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
