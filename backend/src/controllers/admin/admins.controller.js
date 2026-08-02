import bcrypt from 'bcryptjs';
import { query } from '../../config/db.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { validateEmail, validateOptionalPhone, validateNewPassword } from '../../utils/validators.js';

// ---------------- Admin accounts ----------------
const ADMIN_SELECT = `
  SELECT u.id, u.full_name, u.email, u.phone, u.is_active, u.admin_role_id, ar.name AS admin_role
  FROM users u LEFT JOIN admin_roles ar ON ar.id = u.admin_role_id
`;
async function loadAdmin(id) {
  const [row] = await query(`${ADMIN_SELECT} WHERE u.id = ?`, [id]);
  return row || null;
}
export const listAdmins = asyncHandler(async (req, res) => {
  const rows = await query(`${ADMIN_SELECT} WHERE u.role = 'ADMIN' AND u.is_deleted = 0 ORDER BY u.id DESC`);
  res.json({ data: rows });
});
export const storeAdmin = asyncHandler(async (req, res) => {
  const { full_name, email, phone, password, admin_role_id } = req.body;
  if (!full_name || !email || !password) return res.status(422).json({ message: 'full_name, email, password là bắt buộc.' });
  const invalidEmail = validateEmail(email);
  if (invalidEmail) return res.status(422).json({ message: invalidEmail });
  // Tài khoản quản trị thì SĐT là tùy chọn, nhưng đã nhập phải đúng định dạng.
  const invalidPhone = validateOptionalPhone(phone);
  if (invalidPhone) return res.status(422).json({ message: invalidPhone });
  const invalidPassword = validateNewPassword(password);
  if (invalidPassword) return res.status(422).json({ message: invalidPassword });
  const password_hash = await bcrypt.hash(password, 10);
  const result = await query(
    `INSERT INTO users (full_name, email, phone, password_hash, role, admin_role_id, created_by_admin_id)
     VALUES (?, ?, ?, ?, 'ADMIN', ?, ?)`,
    [full_name, email, phone || null, password_hash, admin_role_id || null, req.user.id]
  );
  res.status(201).json({ data: await loadAdmin(result.insertId) });
});
export const updateAdmin = asyncHandler(async (req, res) => {
  const { full_name, admin_role_id } = req.body;
  await query(
    'UPDATE users SET full_name = COALESCE(?, full_name), admin_role_id = COALESCE(?, admin_role_id) WHERE id = ?',
    [full_name ?? null, admin_role_id ?? null, req.params.admin]
  );
  res.json({ data: await loadAdmin(req.params.admin) });
});
export const updateAdminStatus = asyncHandler(async (req, res) => {
  // Cùng chốt chặn với admin/users.controller.js#updateUser: từ khi auth() kiểm tra is_active
  // theo từng request, tự khóa mình là mất quyền truy cập ngay và không tự mở lại được.
  if (String(req.params.admin) === String(req.user.id) && !req.body.is_active) {
    return res.status(422).json({ message: 'Bạn không thể tự khóa tài khoản của chính mình.' });
  }
  await query('UPDATE users SET is_active = ? WHERE id = ?', [req.body.is_active ? 1 : 0, req.params.admin]);
  res.json({ data: await loadAdmin(req.params.admin) });
});
export const updateAdminPassword = asyncHandler(async (req, res) => {
  // Cùng quy tắc với form đăng ký và với đổi mật khẩu của khách hàng (accountController):
  // trước đây hàm này băm thẳng req.body.password nên đặt được mật khẩu 1 ký tự, còn khi
  // không gửi password thì bcrypt.hash(undefined) ném lỗi -> HTTP 500.
  // Không có ô "nhập lại" ở màn hình này nên chỉ kiểm tra độ dài, không so khớp xác nhận.
  const invalidPassword = validateNewPassword(req.body.password, undefined, 'Mật khẩu mới');
  if (invalidPassword) return res.status(422).json({ message: invalidPassword });
  // Chỉ đặt lại mật khẩu cho tài khoản QUẢN TRỊ: id không tồn tại (hoặc là tài khoản khách
  // hàng/kho/NCC) thì trả 404 thay vì âm thầm chạy UPDATE không khớp dòng nào rồi trả 200.
  const [target] = await query("SELECT id FROM users WHERE id = ? AND role = 'ADMIN' AND is_deleted = 0", [req.params.admin]);
  if (!target) return res.status(404).json({ message: 'Không tìm thấy tài khoản quản trị.' });

  const password_hash = await bcrypt.hash(req.body.password, 10);
  await query('UPDATE users SET password_hash = ? WHERE id = ?', [password_hash, req.params.admin]);
  res.json({ data: await loadAdmin(req.params.admin) });
});
