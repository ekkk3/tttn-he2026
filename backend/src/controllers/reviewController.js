import { query } from '../config/db.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// UC 2.2.10 Đánh giá sản phẩm + 2.2.10a Kiểm duyệt đánh giá.

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

// GET /api/products/:id/reviews (public) — chỉ review đã duyệt (VISIBLE).
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

// POST /api/products/:id/reviews (auth) — khách gửi đánh giá.
export const store = asyncHandler(async (req, res) => {
  const { rating, comment } = req.body;
  const numRating = Number(rating);
  if (!numRating || numRating < 1 || numRating > 5) {
    return res.status(422).json({ message: 'Điểm đánh giá phải từ 1 đến 5.' });
  }
  const [product] = await query('SELECT id FROM products WHERE id = ? AND is_deleted = 0', [req.params.id]);
  if (!product) return res.status(404).json({ message: 'Không tìm thấy sản phẩm.' });

  // UC 2.2.10 điều kiện tiên quyết: "Khách hàng đã mua và nhận sản phẩm từ đơn hàng đã mua
  // trước đó". Trước đây không hề kiểm tra, nên một tài khoản vừa đăng ký xong (chưa có đơn
  // nào) vẫn gửi được đánh giá 5 sao — mở đường cho spam và thổi/dìm điểm sản phẩm.
  // Lấy luôn đơn ĐÃ GIAO gần nhất có chứa sản phẩm này để ghi vào cột order_id: cột này có
  // sẵn trong schema từ đầu nhưng chưa bao giờ được ghi, chính nó là bằng chứng "đánh giá
  // này gắn với một lần mua thật" (và là căn cứ để sau này hiện nhãn "Đã mua hàng").
  const [purchased] = await query(
    `SELECT o.id FROM orders o
     JOIN order_items oi ON oi.order_id = o.id
     WHERE o.user_id = ? AND oi.product_id = ? AND o.status = 'DELIVERED'
     ORDER BY o.id DESC LIMIT 1`,
    [req.user.id, req.params.id]
  );
  if (!purchased) {
    return res.status(422).json({ message: 'Bạn cần mua và nhận sản phẩm này trước khi đánh giá.' });
  }

  // Mỗi khách chỉ đánh giá 1 lần cho 1 sản phẩm — trước đây gửi bao nhiêu lần cũng được,
  // 1 người có thể tự kéo điểm trung bình của sản phẩm đi bất kỳ đâu.
  const [existing] = await query(
    'SELECT id FROM product_reviews WHERE product_id = ? AND user_id = ? LIMIT 1',
    [req.params.id, req.user.id]
  );
  if (existing) {
    return res.status(422).json({ message: 'Bạn đã đánh giá sản phẩm này rồi.' });
  }

  const result = await query(
    "INSERT INTO product_reviews (product_id, user_id, order_id, rating, comment, status) VALUES (?, ?, ?, ?, ?, 'VISIBLE')",
    [req.params.id, req.user.id, purchased.id, numRating, comment || null]
  );
  const [row] = await query(`${REVIEW_SELECT} WHERE rv.id = ?`, [result.insertId]);
  res.status(201).json({ data: serializeReview(row) });
});

// --- Admin kiểm duyệt (UC 2.2.10a) ---
export const adminList = asyncHandler(async (req, res) => {
  const rows = await query(`${REVIEW_SELECT} ORDER BY rv.id DESC`);
  res.json({ data: rows.map(serializeReview) });
});
export const adminModerate = asyncHandler(async (req, res) => {
  const { status } = req.body; // 'VISIBLE' | 'HIDDEN'
  if (!['VISIBLE', 'HIDDEN'].includes(status)) {
    return res.status(422).json({ message: 'status phải là VISIBLE hoặc HIDDEN.' });
  }
  await query(
    'UPDATE product_reviews SET status = ?, moderated_by_user_id = ?, moderated_at = NOW() WHERE id = ?',
    [status, req.user.id, req.params.id]
  );
  const [row] = await query(`${REVIEW_SELECT} WHERE rv.id = ?`, [req.params.id]);
  res.json({ data: row ? serializeReview(row) : null });
});
