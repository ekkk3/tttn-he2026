import { query } from '../../config/db.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

// ---------------- Community (moi NCC + kiem duyet bai viet) ----------------
// Frontend doc { data: { suppliers, customers, invitations } } (admin-community-page.jsx).
export const listCommunity = asyncHandler(async (req, res) => {
  const suppliers = await query(
    `SELECT s.id, s.name, s.contact_name, s.email, s.phone, s.address, s.status, s.is_active, s.is_deleted,
            (SELECT COUNT(*) FROM products p WHERE p.supplier_id = s.id AND p.is_deleted = 0) AS product_count
     FROM suppliers s WHERE s.is_deleted = 0 ORDER BY s.id DESC`
  );
  const customers = await query(
    `SELECT u.id, u.full_name, u.email, u.phone, u.city, u.favorite_region, u.is_active, u.is_deleted,
            (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id) AS order_count,
            (SELECT COALESCE(SUM(o.total_amount),0) FROM orders o WHERE o.user_id = u.id AND o.status = 'DELIVERED') AS total_spend
     FROM users u WHERE u.role = 'CUSTOMER' AND u.is_deleted = 0 ORDER BY u.id DESC`
  );
  const invitationRows = await query('SELECT * FROM supplier_invitations ORDER BY id DESC');
  // supplier_invitations khong co cot status/categories -> bo sung mac dinh cho frontend.
  const invitations = invitationRows.map((inv) => ({
    ...inv, status: inv.status ?? 'PENDING', categories: [],
  }));
  res.json({ data: { suppliers, customers, invitations } });
});
export const storeInvitation = asyncHandler(async (req, res) => {
  const { supplier_name, contact_name, email, note } = req.body;
  const result = await query(
    'INSERT INTO supplier_invitations (supplier_name, contact_name, email, note, created_by_user_id) VALUES (?, ?, ?, ?, ?)',
    [supplier_name, contact_name, email, note || null, req.user.id]
  );
  const [row] = await query('SELECT * FROM supplier_invitations WHERE id = ?', [result.insertId]);
  res.status(201).json({ data: { ...row, status: row.status ?? 'PENDING', categories: [] } });
});
