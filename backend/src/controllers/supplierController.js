import { query } from '../config/db.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const index = asyncHandler(async (req, res) => {
  const rows = await query('SELECT * FROM suppliers WHERE is_active = 1 AND is_deleted = 0 ORDER BY name');
  res.json({ suppliers: rows });
});

export const show = asyncHandler(async (req, res) => {
  const [supplier] = await query('SELECT * FROM suppliers WHERE id = ? AND is_deleted = 0', [req.params.supplier]);
  if (!supplier) return res.status(404).json({ message: 'Khong tim thay nha cung cap.' });
  res.json({ supplier });
});

export const getProducts = asyncHandler(async (req, res) => {
  const rows = await query(
    'SELECT * FROM products WHERE supplier_id = ? AND is_active = 1 AND is_deleted = 0 ORDER BY id DESC',
    [req.params.supplier]
  );
  res.json({ products: rows });
});

// --- Admin ---
export const adminIndex = asyncHandler(async (req, res) => {
  const rows = await query('SELECT * FROM suppliers WHERE is_deleted = 0 ORDER BY id DESC');
  res.json({ suppliers: rows });
});

export const store = asyncHandler(async (req, res) => {
  const { supplier_code, name, contact_name, phone, email, address } = req.body;
  const result = await query(
    'INSERT INTO suppliers (supplier_code, name, contact_name, phone, email, address) VALUES (?, ?, ?, ?, ?, ?)',
    [supplier_code, name, contact_name || null, phone, email || null, address || null]
  );
  res.status(201).json({ id: result.insertId });
});

export const update = asyncHandler(async (req, res) => {
  const { name, contact_name, phone, email, address, is_active } = req.body;
  await query(
    `UPDATE suppliers SET name = COALESCE(?, name), contact_name = COALESCE(?, contact_name),
       phone = COALESCE(?, phone), email = COALESCE(?, email), address = COALESCE(?, address),
       is_active = COALESCE(?, is_active) WHERE id = ?`,
    [name, contact_name, phone, email, address, is_active, req.params.supplier]
  );
  res.json({ message: 'Da cap nhat nha cung cap.' });
});

export const destroy = asyncHandler(async (req, res) => {
  await query('UPDATE suppliers SET is_deleted = 1 WHERE id = ?', [req.params.supplier]);
  res.json({ message: 'Da xoa nha cung cap.' });
});
