import { query } from '../config/db.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const index = asyncHandler(async (req, res) => {
  const rows = await query('SELECT * FROM categories WHERE is_active = 1 AND is_deleted = 0 ORDER BY name');
  res.json({ categories: rows });
});

export const show = asyncHandler(async (req, res) => {
  const [category] = await query('SELECT * FROM categories WHERE id = ? AND is_deleted = 0', [req.params.category]);
  if (!category) return res.status(404).json({ message: 'Khong tim thay danh muc.' });
  res.json({ category });
});

export const getProducts = asyncHandler(async (req, res) => {
  const rows = await query(
    'SELECT * FROM products WHERE category_id = ? AND is_active = 1 AND is_deleted = 0 ORDER BY id DESC',
    [req.params.category]
  );
  res.json({ products: rows });
});

// --- Admin (protected, mounted duoi /api/admin/categories) ---
export const adminIndex = asyncHandler(async (req, res) => {
  const rows = await query('SELECT * FROM categories WHERE is_deleted = 0 ORDER BY id DESC');
  res.json({ categories: rows });
});

export const store = asyncHandler(async (req, res) => {
  const { name, description, is_active = true } = req.body;
  const result = await query('INSERT INTO categories (name, description, is_active) VALUES (?, ?, ?)', [
    name, description || null, !!is_active,
  ]);
  res.status(201).json({ id: result.insertId });
});

export const update = asyncHandler(async (req, res) => {
  const { name, description, is_active } = req.body;
  await query(
    'UPDATE categories SET name = COALESCE(?, name), description = COALESCE(?, description), is_active = COALESCE(?, is_active) WHERE id = ?',
    [name, description, is_active, req.params.category]
  );
  res.json({ message: 'Da cap nhat danh muc.' });
});

export const destroy = asyncHandler(async (req, res) => {
  await query('UPDATE categories SET is_deleted = 1 WHERE id = ?', [req.params.category]);
  res.json({ message: 'Da xoa danh muc.' });
});
