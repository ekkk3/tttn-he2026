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

// --- Complaints (UC 2.2.11 Khieu nai) ---
// Frontend adaptBackendComplaint doc { data } voi order/product/resolver long + resolution_note.
const COMPLAINT_SELECT = `
  SELECT c.*, o.order_no, o.status AS order_status, o.total_amount AS order_total_amount,
         p.name AS product_name, p.sku AS product_sku, ru.full_name AS resolver_name
  FROM complaints c
  LEFT JOIN orders o ON o.id = c.order_id
  LEFT JOIN products p ON p.id = c.product_id
  LEFT JOIN users ru ON ru.id = c.resolved_by_user_id
`;
function serializeComplaint(row) {
  return {
    id: row.id,
    reason: row.reason,
    content: row.content,
    image_url: row.image_url,
    status: row.status,
    resolution_note: row.resolution_note,
    created_at: row.created_at,
    order: row.order_id ? { id: row.order_id, order_no: row.order_no, status: row.order_status, total_amount: Number(row.order_total_amount || 0) } : null,
    product: row.product_id ? { id: row.product_id, name: row.product_name, sku: row.product_sku } : null,
    resolver: row.resolved_by_user_id ? { full_name: row.resolver_name } : null,
  };
}
export const listComplaints = asyncHandler(async (req, res) => {
  const rows = await query(`${COMPLAINT_SELECT} WHERE c.user_id = ? ORDER BY c.id DESC`, [req.user.id]);
  res.json({ data: rows.map(serializeComplaint) });
});
export const storeComplaint = asyncHandler(async (req, res) => {
  const { order_id, product_id, reason, content, image_url } = req.body;
  if (!reason || !content) return res.status(422).json({ message: 'Ly do va noi dung la bat buoc.' });
  const result = await query(
    "INSERT INTO complaints (order_id, user_id, product_id, reason, content, image_url, status) VALUES (?, ?, ?, ?, ?, ?, 'OPEN')",
    [order_id || null, req.user.id, product_id || null, reason, content, image_url || null]
  );
  // Thong bao Admin co khieu nai moi (UC 2.2.18 Quan ly khieu nai).
  const admins = await query("SELECT id FROM users WHERE role = 'ADMIN' AND is_deleted = 0");
  for (const admin of admins) {
    await query(
      "INSERT INTO notifications (user_id, type, title, message, link_url) VALUES (?, 'COMPLAINT', 'Khieu nai moi', ?, '/admin/complaints')",
      [admin.id, `Co khieu nai moi: ${reason}`]
    );
  }
  const [row] = await query(`${COMPLAINT_SELECT} WHERE c.id = ?`, [result.insertId]);
  res.status(201).json({ data: serializeComplaint(row) });
});

// --- Admin: quan ly khieu nai (UC 2.2.18). Backend-ready; frontend chua co trang admin rieng. ---
export const adminListComplaints = asyncHandler(async (req, res) => {
  const rows = await query(`${COMPLAINT_SELECT} ORDER BY c.id DESC`);
  res.json({ data: rows.map(serializeComplaint) });
});
export const adminResolveComplaint = asyncHandler(async (req, res) => {
  const { resolution_note, status = 'RESOLVED' } = req.body;
  await query(
    'UPDATE complaints SET status = ?, resolution_note = ?, resolved_by_user_id = ?, resolved_at = NOW() WHERE id = ?',
    [status, resolution_note || null, req.user.id, req.params.complaint]
  );
  const [row] = await query(`${COMPLAINT_SELECT} WHERE c.id = ?`, [req.params.complaint]);
  if (row) {
    await query(
      "INSERT INTO notifications (user_id, type, title, message, link_url) VALUES (?, 'COMPLAINT_RESOLVED', 'Khieu nai da duoc xu ly', ?, '/account/disputes')",
      [row.user_id, resolution_note || 'Khieu nai cua ban da duoc xu ly.']
    );
  }
  res.json({ data: row ? serializeComplaint(row) : null });
});

// --- Support tickets --- (operations store adaptTicket doc { data })
function serializeTicket(t) {
  return { id: t.id, subject: t.subject, message: t.message, channel: t.channel, status: t.status, created_at: t.created_at };
}
export const listSupportTickets = asyncHandler(async (req, res) => {
  // WAREHOUSE_STAFF/ADMIN xem toan bo; khach hang chi xem cua minh.
  const isStaff = ['ADMIN', 'WAREHOUSE_STAFF'].includes(req.user.role);
  const rows = isStaff
    ? await query('SELECT * FROM support_tickets ORDER BY id DESC')
    : await query('SELECT * FROM support_tickets WHERE user_id = ? ORDER BY id DESC', [req.user.id]);
  res.json({ data: rows.map(serializeTicket) });
});
export const storeSupportTicket = asyncHandler(async (req, res) => {
  const { subject, message, channel = 'WEB' } = req.body;
  const result = await query(
    'INSERT INTO support_tickets (user_id, subject, message, channel) VALUES (?, ?, ?, ?)',
    [req.user.id, subject, message, channel]
  );
  const [row] = await query('SELECT * FROM support_tickets WHERE id = ?', [result.insertId]);
  res.status(201).json({ data: serializeTicket(row) });
});
export const resolveSupportTicket = asyncHandler(async (req, res) => {
  await query(
    "UPDATE support_tickets SET status = 'RESOLVED', resolved_by_user_id = ?, resolved_at = NOW() WHERE id = ?",
    [req.user.id, req.params.ticket]
  );
  const [row] = await query('SELECT * FROM support_tickets WHERE id = ?', [req.params.ticket]);
  res.json({ data: row ? serializeTicket(row) : null });
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
