import { query } from '../config/db.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// UC 2.2.10 Danh gia san pham + 2.2.10a Kiem duyet danh gia.

function serializeReview(r) {
  return {
    id: r.id,
    product_id: r.product_id,
    rating: r.rating,
    comment: r.comment,
    status: r.status,
    created_at: r.created_at,
    user: { id: r.user_id, full_name: r.reviewer_name },
    product: r.product_name ? { id: r.product_id, name: r.product_name } : null,
  };
}
const REVIEW_SELECT = `
  SELECT rv.*, u.full_name AS reviewer_name, p.name AS product_name
  FROM product_reviews rv
  LEFT JOIN users u ON u.id = rv.user_id
  LEFT JOIN products p ON p.id = rv.product_id
`;

// GET /api/products/:id/reviews (public) — chi review da duyet (VISIBLE).
export const listForProduct = asyncHandler(async (req, res) => {
  const rows = await query(
    `${REVIEW_SELECT} WHERE rv.product_id = ? AND rv.status = 'VISIBLE' ORDER BY rv.id DESC`,
    [req.params.id]
  );
  const [{ avg_rating, review_count }] = await query(
    "SELECT COALESCE(AVG(rating),0) AS avg_rating, COUNT(*) AS review_count FROM product_reviews WHERE product_id = ? AND status = 'VISIBLE'",
    [req.params.id]
  );
  res.json({
    data: rows.map(serializeReview),
    summary: { average_rating: Number(Number(avg_rating).toFixed(1)), review_count },
  });
});

// POST /api/products/:id/reviews (auth) — khach gui danh gia.
export const store = asyncHandler(async (req, res) => {
  const { rating, comment } = req.body;
  const numRating = Number(rating);
  if (!numRating || numRating < 1 || numRating > 5) {
    return res.status(422).json({ message: 'Diem danh gia phai tu 1 den 5.' });
  }
  const [product] = await query('SELECT id FROM products WHERE id = ? AND is_deleted = 0', [req.params.id]);
  if (!product) return res.status(404).json({ message: 'Khong tim thay san pham.' });

  const result = await query(
    "INSERT INTO product_reviews (product_id, user_id, rating, comment, status) VALUES (?, ?, ?, ?, 'VISIBLE')",
    [req.params.id, req.user.id, numRating, comment || null]
  );
  const [row] = await query(`${REVIEW_SELECT} WHERE rv.id = ?`, [result.insertId]);
  res.status(201).json({ data: serializeReview(row) });
});

// --- Admin kiem duyet (UC 2.2.10a) ---
export const adminList = asyncHandler(async (req, res) => {
  const rows = await query(`${REVIEW_SELECT} ORDER BY rv.id DESC`);
  res.json({ data: rows.map(serializeReview) });
});
export const adminModerate = asyncHandler(async (req, res) => {
  const { status } = req.body; // 'VISIBLE' | 'HIDDEN'
  if (!['VISIBLE', 'HIDDEN'].includes(status)) {
    return res.status(422).json({ message: 'status phai la VISIBLE hoac HIDDEN.' });
  }
  await query(
    'UPDATE product_reviews SET status = ?, moderated_by_user_id = ?, moderated_at = NOW() WHERE id = ?',
    [status, req.user.id, req.params.id]
  );
  const [row] = await query(`${REVIEW_SELECT} WHERE rv.id = ?`, [req.params.id]);
  res.json({ data: row ? serializeReview(row) : null });
});
