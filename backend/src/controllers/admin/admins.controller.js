import bcrypt from 'bcryptjs';
import { query } from '../../config/db.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

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
  await query('UPDATE users SET is_active = ? WHERE id = ?', [req.body.is_active ? 1 : 0, req.params.admin]);
  res.json({ data: await loadAdmin(req.params.admin) });
});
export const updateAdminPassword = asyncHandler(async (req, res) => {
  const password_hash = await bcrypt.hash(req.body.password, 10);
  await query('UPDATE users SET password_hash = ? WHERE id = ?', [password_hash, req.params.admin]);
  res.json({ data: await loadAdmin(req.params.admin) });
});
