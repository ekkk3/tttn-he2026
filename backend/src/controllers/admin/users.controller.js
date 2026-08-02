import bcrypt from 'bcryptjs';
import { query } from '../../config/db.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { validateEmail, validatePhone, validateOptionalPhone } from '../../utils/validators.js';

// Đúng 4 giá trị của cột users.role (ENUM trong schema.sql). Phải tự kiểm ở tầng ứng dụng vì
// MariaDB không bật strict mode sẽ âm thầm ép giá trị lạ thành CHUỖI RỖNG thay vì báo lỗi —
// kết quả là tài khoản có role = '' không thuộc vai trò nào.
const USER_ROLES = ['CUSTOMER', 'ADMIN', 'WAREHOUSE_STAFF', 'SUPPLIER'];

// ---------------- Users ----------------
// Ghi chú: frontend (use-admin-user-store.js, đã có sẵn từ trước) đọc { data: [...] }
// và cần thêm cột tính toán "orders_count" trên từng user — không có sẵn trong DB nên
// JOIN đếm từ bảng orders. Xem PLAN_3_TUAN.md mục "Sửa backend cho khớp frontend".
const USER_LIST_SELECT = `
  SELECT u.*, COALESCE(o.orders_count, 0) AS orders_count
  FROM users u
  LEFT JOIN (SELECT user_id, COUNT(*) AS orders_count FROM orders GROUP BY user_id) o
    ON o.user_id = u.id
`;

// Tách password_hash ra khỏi object bằng destructuring rồi CHỈ giữ lại phần còn lại
// (...rest) — đảm bảo hash mật khẩu không bao giờ lọt vào response trả về frontend,
// dù câu SELECT phía trên dùng `u.*` (lấy hết mọi cột).
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
  if (!user) return res.status(404).json({ message: 'Không tìm thấy người dùng.' });
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
    return res.status(422).json({ message: 'full_name, email, phone, password là bắt buộc.' });
  }
  // Cùng bộ quy tắc với form đăng ký công khai (authController#register) — tài khoản do
  // Admin tạo cũng là tài khoản đăng nhập thật, không có lý do gì lỏng hơn.
  const invalidEmail = validateEmail(email);
  if (invalidEmail) return res.status(422).json({ message: invalidEmail });
  const invalidPhone = validatePhone(phone);
  if (invalidPhone) return res.status(422).json({ message: invalidPhone });
  if (String(password).length < 8) {
    return res.status(422).json({ message: 'Mật khẩu phải có ít nhất 8 ký tự.' });
  }
  if (!USER_ROLES.includes(role)) {
    return res.status(422).json({ message: `Vai trò không hợp lệ (chỉ nhận: ${USER_ROLES.join(', ')}).` });
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
  const invalidPhone = validateOptionalPhone(phone);
  if (invalidPhone) return res.status(422).json({ message: invalidPhone });
  if (role !== undefined && role !== null && !USER_ROLES.includes(role)) {
    return res.status(422).json({ message: `Vai trò không hợp lệ (chỉ nhận: ${USER_ROLES.join(', ')}).` });
  }
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
