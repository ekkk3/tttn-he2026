import { query } from '../../config/db.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { POST_SELECT, serializePost, loadPostComments } from '../miscController.js';

// ---------------- Admin posts CRUD ---------------- (frontend đọc { data } + comments)
async function loadAdminPost(id) {
  const [row] = await query(`${POST_SELECT} WHERE p.id = ?`, [id]);
  if (!row) return null;
  return serializePost(row, await loadPostComments(id, true)); // includeHidden để admin kiểm duyệt
}
export const listAdminPosts = asyncHandler(async (req, res) => {
  const rows = await query(`${POST_SELECT} ORDER BY p.id DESC`);
  const data = [];
  for (const row of rows) data.push(serializePost(row, await loadPostComments(row.id, true)));
  res.json({ data });
});
export const storePost = asyncHandler(async (req, res) => {
  const { title, excerpt, body, cover_image_url, status = 'DRAFT' } = req.body;
  if (!title || !body) return res.status(422).json({ message: 'Tiêu đề và nội dung là bắt buộc.' });
  const result = await query(
    `INSERT INTO posts (created_by_user_id, title, excerpt, body, cover_image_url, status, published_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [req.user.id, title, excerpt || null, body, cover_image_url || null, status, status === 'PUBLISHED' ? new Date() : null]
  );
  res.status(201).json({ data: await loadAdminPost(result.insertId) });
});
export const updatePost = asyncHandler(async (req, res) => {
  const { title, excerpt, body, status } = req.body;
  // Khi chuyển sang PUBLISHED mà chưa có published_at thì set thời điểm xuất bản.
  await query(
    `UPDATE posts SET title = COALESCE(?, title), excerpt = COALESCE(?, excerpt),
       body = COALESCE(?, body), status = COALESCE(?, status),
       published_at = CASE WHEN ? = 'PUBLISHED' AND published_at IS NULL THEN NOW() ELSE published_at END
     WHERE id = ?`,
    [title ?? null, excerpt ?? null, body ?? null, status ?? null, status ?? null, req.params.post]
  );
  res.json({ data: await loadAdminPost(req.params.post) });
});
export const destroyPost = asyncHandler(async (req, res) => {
  await query('DELETE FROM posts WHERE id = ?', [req.params.post]);
  res.json({ data: { id: Number(req.params.post) } });
});
export const updateCommentVisibility = asyncHandler(async (req, res) => {
  const { status } = req.body; // 'VISIBLE' | 'HIDDEN'
  await query(
    'UPDATE post_comments SET status = ?, hidden_by_user_id = ?, hidden_at = NOW() WHERE id = ?',
    [status, req.user.id, req.params.comment]
  );
  const [row] = await query(
    'SELECT c.*, u.full_name AS author_name FROM post_comments c LEFT JOIN users u ON u.id = c.user_id WHERE c.id = ?',
    [req.params.comment]
  );
  res.json({ data: row ? { id: row.id, post_id: row.post_id, content: row.content, status: row.status, created_at: row.created_at, author: { full_name: row.author_name } } : null });
});
