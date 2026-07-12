import { query } from '../config/db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { PRODUCT_SELECT, serializeProducts } from '../utils/serializers.js';

// Frontend doc { data: [...] } cho danh sach danh muc.
export const index = asyncHandler(async (req, res) => {
  const rows = await query('SELECT * FROM categories WHERE is_active = 1 AND is_deleted = 0 ORDER BY name');
  res.json({ data: rows });
});

export const show = asyncHandler(async (req, res) => {
  const [category] = await query('SELECT * FROM categories WHERE id = ? AND is_deleted = 0', [req.params.category]);
  if (!category) return res.status(404).json({ message: 'Khong tim thay danh muc.' });
  res.json({ data: category });
});

export const getProducts = asyncHandler(async (req, res) => {
  const rows = await query(
    `${PRODUCT_SELECT} WHERE p.category_id = ? AND p.is_active = 1 AND p.is_deleted = 0 ORDER BY p.id DESC`,
    [req.params.category]
  );
  res.json({ data: serializeProducts(rows) });
});

// --- Admin (protected, mounted duoi /api/admin/categories) ---
export const adminIndex = asyncHandler(async (req, res) => {
  const rows = await query('SELECT * FROM categories WHERE is_deleted = 0 ORDER BY id DESC');
  res.json({ data: rows });
});

export const store = asyncHandler(async (req, res) => {
  const { name, description, is_active = true } = req.body;
  if (!name) return res.status(422).json({ message: 'Ten danh muc la bat buoc.' });
  const result = await query('INSERT INTO categories (name, description, is_active) VALUES (?, ?, ?)', [
    name, description || null, is_active ? 1 : 0,
  ]);
  const [category] = await query('SELECT * FROM categories WHERE id = ?', [result.insertId]);
  res.status(201).json({ data: category });
});

export const update = asyncHandler(async (req, res) => {
  const { name, description, is_active, is_deleted } = req.body;
  await query(
    `UPDATE categories SET name = COALESCE(?, name), description = COALESCE(?, description),
       is_active = COALESCE(?, is_active), is_deleted = COALESCE(?, is_deleted) WHERE id = ?`,
    [name ?? null, description ?? null, is_active === undefined ? null : (is_active ? 1 : 0),
      is_deleted === undefined ? null : (is_deleted ? 1 : 0), req.params.category]
  );
  const [category] = await query('SELECT * FROM categories WHERE id = ?', [req.params.category]);
  res.json({ data: category });
});

export const destroy = asyncHandler(async (req, res) => {
  await query('UPDATE categories SET is_active = 0 WHERE id = ?', [req.params.category]);
  const [category] = await query('SELECT * FROM categories WHERE id = ?', [req.params.category]);
  res.json({ data: category });
});
