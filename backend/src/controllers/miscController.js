import { query } from '../config/db.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// File nay gom cac nhom route nho (khong can rieng 1 file/controller) de de doi chieu
// voi routes/api.php cua Laravel: Notifications, Complaints, Support tickets, Newsletter, Posts.

// --- Notifications --- (frontend adaptBackendNotification doc { data } voi
// channel/status/sent_at; bang notifications khong co san nen suy ra tu type/read_at).
function serializeNotification(row) {
  return {
    id: row.id,
    title: row.title,
    message: row.message,
    channel: row.type || 'SYSTEM',
    status: row.read_at ? 'READ' : 'UNREAD',
    sent_at: row.created_at,
    read_at: row.read_at,
    created_at: row.created_at,
    link_url: row.link_url,
  };
}
export const listNotifications = asyncHandler(async (req, res) => {
  const rows = await query('SELECT * FROM notifications WHERE user_id = ? ORDER BY id DESC', [req.user.id]);
  res.json({ data: rows.map(serializeNotification) });
});
export const markNotificationRead = asyncHandler(async (req, res) => {
  await query('UPDATE notifications SET read_at = NOW() WHERE id = ? AND user_id = ?', [
    req.params.notification, req.user.id,
  ]);
  const [row] = await query('SELECT * FROM notifications WHERE id = ? AND user_id = ?', [
    req.params.notification, req.user.id,
  ]);
  res.json({ data: row ? serializeNotification(row) : null });
});

// --- Complaints ---
export const listComplaints = asyncHandler(async (req, res) => {
  const rows = await query('SELECT * FROM complaints WHERE user_id = ? ORDER BY id DESC', [req.user.id]);
  res.json({ complaints: rows });
});
export const storeComplaint = asyncHandler(async (req, res) => {
  const { order_id, product_id, reason, content, image_url } = req.body;
  const result = await query(
    'INSERT INTO complaints (order_id, user_id, product_id, reason, content, image_url) VALUES (?, ?, ?, ?, ?, ?)',
    [order_id, req.user.id, product_id, reason, content, image_url || null]
  );
  res.status(201).json({ id: result.insertId });
});

// --- Support tickets ---
export const listSupportTickets = asyncHandler(async (req, res) => {
  const rows = await query('SELECT * FROM support_tickets WHERE user_id = ? ORDER BY id DESC', [req.user.id]);
  res.json({ tickets: rows });
});
export const storeSupportTicket = asyncHandler(async (req, res) => {
  const { subject, message, channel = 'WEB' } = req.body;
  const result = await query(
    'INSERT INTO support_tickets (user_id, subject, message, channel) VALUES (?, ?, ?, ?)',
    [req.user.id, subject, message, channel]
  );
  res.status(201).json({ id: result.insertId });
});
export const resolveSupportTicket = asyncHandler(async (req, res) => {
  await query(
    "UPDATE support_tickets SET status = 'RESOLVED', resolved_by_user_id = ?, resolved_at = NOW() WHERE id = ?",
    [req.user.id, req.params.ticket]
  );
  res.json({ message: 'Da xu ly yeu cau ho tro.' });
});

// --- Newsletter ---
export const subscribeNewsletter = asyncHandler(async (req, res) => {
  const { email, source = 'storefront' } = req.body;
  await query('INSERT IGNORE INTO newsletter_subscriptions (email, source) VALUES (?, ?)', [email, source]);
  res.status(201).json({ message: 'Da dang ky nhan tin.' });
});

// --- Posts (blog / community, public + tuong tac) ---
export const listPosts = asyncHandler(async (req, res) => {
  const rows = await query("SELECT * FROM posts WHERE status = 'PUBLISHED' ORDER BY published_at DESC");
  res.json({ posts: rows });
});
export const myLikedPosts = asyncHandler(async (req, res) => {
  const rows = await query('SELECT post_id FROM post_likes WHERE user_id = ?', [req.user.id]);
  res.json({ post_ids: rows.map((r) => r.post_id) });
});
export const storeComment = asyncHandler(async (req, res) => {
  const { content } = req.body;
  const result = await query('INSERT INTO post_comments (post_id, user_id, content) VALUES (?, ?, ?)', [
    req.params.post, req.user.id, content,
  ]);
  res.status(201).json({ id: result.insertId });
});
export const likePost = asyncHandler(async (req, res) => {
  await query('INSERT IGNORE INTO post_likes (post_id, user_id) VALUES (?, ?)', [req.params.post, req.user.id]);
  res.status(201).json({ message: 'Da thich bai viet.' });
});
export const unlikePost = asyncHandler(async (req, res) => {
  await query('DELETE FROM post_likes WHERE post_id = ? AND user_id = ?', [req.params.post, req.user.id]);
  res.json({ message: 'Da bo thich.' });
});
