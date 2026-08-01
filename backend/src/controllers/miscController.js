import { query } from '../config/db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { markOrderRefunded } from '../services/paymentService.js';

// File này gom các nhóm route nhỏ (không cần riêng 1 file/controller) để dễ đối chiếu
// với routes/api.php của Laravel: Notifications, Complaints, Support tickets, Newsletter, Posts.

// --- Notifications --- (frontend adaptBackendNotification đọc { data } với
// channel/status/sent_at; bảng notifications không có sẵn nên suy ra từ type/read_at).
function serializeNotification(row) {
  return {
    id: row.id,
    title: row.title,
    message: row.message,
    channel: row.type || 'SYSTEM',
    // Bảng notifications không có cột status riêng — SUY RA "đã đọc hay chưa" từ việc
    // read_at có giá trị hay còn NULL, thay vì lưu thêm 1 cột trạng thái trùng lặp thông tin.
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

// --- Complaints (UC 2.2.11 Khiếu nại) ---
// Frontend adaptBackendComplaint đọc { data } với order/product/resolver lồng + resolution_note.
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
  if (!reason || !content) return res.status(422).json({ message: 'Lý do và nội dung là bắt buộc.' });

  // UC 2.2.11 điều kiện tiên quyết 2 & 3: khiếu nại phải gắn với đơn CỦA CHÍNH khách hàng
  // và đơn đó đã giao thành công.
  // Trước đây `order_id` được lấy thẳng từ body và ghi vào DB không kiểm tra gì, nên:
  //   - khách A gửi được khiếu nại lên đơn của khách B (IDOR), và response còn trả về luôn
  //     mã đơn + tổng tiền của nạn nhân qua COMPLAINT_SELECT bên dưới;
  //   - khiếu nại được nhận cả trên đơn vừa đặt xong, chưa hề giao (trái luồng phụ A4).
  if (order_id) {
    const [order] = await query('SELECT id, status FROM orders WHERE id = ? AND user_id = ?', [order_id, req.user.id]);
    // Trả 404 (không phải 403) khi đơn không thuộc về mình: không xác nhận cho người gọi
    // biết mã đơn đó có tồn tại trong hệ thống hay không.
    if (!order) return res.status(404).json({ message: 'Không tìm thấy đơn hàng.' });
    if (order.status !== 'DELIVERED') {
      return res.status(422).json({ message: 'Đơn hàng không đủ điều kiện để gửi khiếu nại (chỉ khiếu nại đơn đã giao thành công).' });
    }
    // Sản phẩm bị khiếu nại (nếu có chọn) phải nằm trong chính đơn hàng đó.
    if (product_id) {
      const [line] = await query('SELECT id FROM order_items WHERE order_id = ? AND product_id = ?', [order_id, product_id]);
      if (!line) return res.status(422).json({ message: 'Sản phẩm không có trong đơn hàng này.' });
    }
  }

  const result = await query(
    "INSERT INTO complaints (order_id, user_id, product_id, reason, content, image_url, status) VALUES (?, ?, ?, ?, ?, ?, 'OPEN')",
    [order_id || null, req.user.id, product_id || null, reason, content, image_url || null]
  );
  // Thông báo Admin có khiếu nại mới (UC 2.2.18 Quản lý khiếu nại).
  const admins = await query("SELECT id FROM users WHERE role = 'ADMIN' AND is_deleted = 0");
  for (const admin of admins) {
    await query(
      "INSERT INTO notifications (user_id, type, title, message, link_url) VALUES (?, 'COMPLAINT', 'Khiếu nại mới', ?, '/admin/complaints')",
      [admin.id, `Có khiếu nại mới: ${reason}`]
    );
  }
  const [row] = await query(`${COMPLAINT_SELECT} WHERE c.id = ?`, [result.insertId]);
  res.status(201).json({ data: serializeComplaint(row) });
});

// --- Admin: quản lý khiếu nại (UC 2.2.18). Backend-ready; frontend chưa có trang admin riêng. ---
export const adminListComplaints = asyncHandler(async (req, res) => {
  const rows = await query(`${COMPLAINT_SELECT} ORDER BY c.id DESC`);
  res.json({ data: rows.map(serializeComplaint) });
});
// action: 'REFUND' (hoàn tiền) | 'REPLACE' (đổi sản phẩm mới) | 'REJECT' (từ chối) —
// đúng 3 phương án xử lý khiếu nại đã chấp nhận theo UC 2.2.18. Giữ tương thích ngược:
// nếu FE cũ gọi thẳng `status` (không có `action`) thì vẫn dùng như trước.
const COMPLAINT_ACTION_STATUS = { REFUND: 'REFUNDED', REPLACE: 'REPLACED', REJECT: 'REJECTED' };
const COMPLAINT_OUTCOME_MESSAGE = {
  REFUNDED: 'Khiếu nại của bạn đã được xử lý: đơn hàng đã được hoàn tiền.',
  REPLACED: 'Khiếu nại của bạn đã được xử lý: sản phẩm sẽ được đổi mới cho bạn.',
  REJECTED: 'Rất tiếc, khiếu nại của bạn không được chấp nhận.',
};
export const adminResolveComplaint = asyncHandler(async (req, res) => {
  const { resolution_note, action } = req.body;
  const [complaint] = await query('SELECT * FROM complaints WHERE id = ?', [req.params.complaint]);
  if (!complaint) return res.status(404).json({ message: 'Không tìm thấy khiếu nại.' });

  const status = COMPLAINT_ACTION_STATUS[action] || req.body.status || 'RESOLVED';

  // Chỉ nhánh "Hoàn tiền" mới đụng tới payments/payment_status_history — "Đổi sản phẩm" và
  // "Từ chối" chỉ là đổi trạng thái khiếu nại (không có luồng tạo đơn đổi hàng mới, ngoài
  // phạm vi UC hiện tại — xem ghi chú resolution_note để nhân viên tự phối hợp thủ công).
  if (status === 'REFUNDED') {
    if (!complaint.order_id) {
      return res.status(422).json({ message: 'Khiếu nại này không gắn với đơn hàng nào để hoàn tiền.' });
    }
    const refunded = await markOrderRefunded({ orderId: complaint.order_id, note: resolution_note, actorUserId: req.user.id });
    if (!refunded.ok) {
      const message = refunded.reason === 'PAYMENT_NOT_REFUNDABLE'
        ? `Không thể hoàn tiền: đơn hàng đang ở trạng thái thanh toán "${refunded.paymentStatus}", chỉ hoàn được đơn đã thanh toán thành công.`
        : 'Không thể hoàn tiền cho đơn hàng này (không tìm thấy giao dịch thanh toán).';
      return res.status(422).json({ message });
    }
  }

  await query(
    'UPDATE complaints SET status = ?, resolution_note = ?, resolved_by_user_id = ?, resolved_at = NOW() WHERE id = ?',
    [status, resolution_note || null, req.user.id, req.params.complaint]
  );
  const [row] = await query(`${COMPLAINT_SELECT} WHERE c.id = ?`, [req.params.complaint]);
  if (row) {
    await query(
      "INSERT INTO notifications (user_id, type, title, message, link_url) VALUES (?, 'COMPLAINT_RESOLVED', 'Khiếu nại đã được xử lý', ?, '/account/disputes')",
      [row.user_id, resolution_note || COMPLAINT_OUTCOME_MESSAGE[status] || 'Khiếu nại của bạn đã được xử lý.']
    );
  }
  res.json({ data: row ? serializeComplaint(row) : null });
});

// --- Support tickets --- (operations store adaptTicket doc { data })
function serializeTicket(t) {
  return { id: t.id, subject: t.subject, message: t.message, channel: t.channel, status: t.status, created_at: t.created_at };
}
export const listSupportTickets = asyncHandler(async (req, res) => {
  // WAREHOUSE_STAFF/ADMIN xem toàn bộ; khách hàng chỉ xem của mình.
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
  // Cùng quyền xem với listSupportTickets: staff được xử lý mọi ticket, khách hàng
  // chỉ được đóng ticket của chính mình (tránh IDOR qua id dễ đoán).
  const isStaff = ['ADMIN', 'WAREHOUSE_STAFF'].includes(req.user.role);
  const [ticket] = await query('SELECT * FROM support_tickets WHERE id = ?', [req.params.ticket]);
  if (!ticket) return res.status(404).json({ message: 'Không tìm thấy yêu cầu hỗ trợ.' });
  if (!isStaff && ticket.user_id !== req.user.id) {
    return res.status(403).json({ message: 'Bạn chỉ có thể xử lý yêu cầu hỗ trợ của mình.' });
  }
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
  res.status(201).json({ message: 'Đã đăng ký nhận tin.' });
});

// --- Posts (blog / community) — frontend đọc { data } với likes_count, comments_count,
// comments[] và author lồng (xem use-post-store.js + story-page.jsx). ---
export const POST_SELECT = `
  SELECT p.*, u.full_name AS author_name,
    (SELECT COUNT(*) FROM post_likes pl WHERE pl.post_id = p.id) AS likes_count,
    (SELECT COUNT(*) FROM post_comments pc WHERE pc.post_id = p.id AND pc.status = 'VISIBLE') AS comments_count
  FROM posts p LEFT JOIN users u ON u.id = p.created_by_user_id
`;
export async function loadPostComments(postId, includeHidden = false) {
  const rows = await query(
    `SELECT c.*, u.full_name AS author_name FROM post_comments c LEFT JOIN users u ON u.id = c.user_id
     WHERE c.post_id = ? ${includeHidden ? '' : "AND c.status = 'VISIBLE'"} ORDER BY c.id DESC`,
    [postId]
  );
  return rows.map((r) => ({
    id: r.id, post_id: r.post_id, content: r.content, status: r.status, created_at: r.created_at,
    author: { full_name: r.author_name },
  }));
}
export function serializePost(row, comments = []) {
  return {
    id: row.id, title: row.title, excerpt: row.excerpt, body: row.body,
    cover_image_url: row.cover_image_url, status: row.status,
    published_at: row.published_at, created_at: row.created_at,
    likes_count: Number(row.likes_count || 0), comments_count: Number(row.comments_count || 0),
    // Bài viết seed sẵn (không gắn created_by_user_id) hiện tên tác giả mặc định "Admin"
    // thay vì để trống.
    author: row.created_by_user_id ? { full_name: row.author_name } : { full_name: 'Admin' },
    comments,
  };
}
export const listPosts = asyncHandler(async (req, res) => {
  const rows = await query(`${POST_SELECT} WHERE p.status = 'PUBLISHED' ORDER BY p.published_at DESC`);
  const data = [];
  for (const row of rows) data.push(serializePost(row, await loadPostComments(row.id)));
  res.json({ data });
});
export const myLikedPosts = asyncHandler(async (req, res) => {
  const rows = await query('SELECT post_id FROM post_likes WHERE user_id = ?', [req.user.id]);
  res.json({ data: { post_ids: rows.map((r) => r.post_id) } });
});
export const storeComment = asyncHandler(async (req, res) => {
  const { content } = req.body;
  if (!content || content.trim().length < 2) return res.status(422).json({ message: 'Bình luận quá ngắn.' });
  const result = await query(
    "INSERT INTO post_comments (post_id, user_id, content, status) VALUES (?, ?, ?, 'VISIBLE')",
    [req.params.post, req.user.id, content.trim()]
  );
  const [row] = await query(
    'SELECT c.*, u.full_name AS author_name FROM post_comments c LEFT JOIN users u ON u.id = c.user_id WHERE c.id = ?',
    [result.insertId]
  );
  const [{ cnt }] = await query("SELECT COUNT(*) AS cnt FROM post_comments WHERE post_id = ? AND status = 'VISIBLE'", [req.params.post]);
  res.status(201).json({
    data: { id: row.id, post_id: row.post_id, content: row.content, status: row.status, created_at: row.created_at, author: { full_name: row.author_name } },
    meta: { comments_count: cnt },
  });
});
async function likesCount(postId) {
  const [{ cnt }] = await query('SELECT COUNT(*) AS cnt FROM post_likes WHERE post_id = ?', [postId]);
  return cnt;
}
export const likePost = asyncHandler(async (req, res) => {
  await query('INSERT IGNORE INTO post_likes (post_id, user_id) VALUES (?, ?)', [req.params.post, req.user.id]);
  res.status(201).json({ data: { likes_count: await likesCount(req.params.post), liked: true } });
});
export const unlikePost = asyncHandler(async (req, res) => {
  await query('DELETE FROM post_likes WHERE post_id = ? AND user_id = ?', [req.params.post, req.user.id]);
  res.json({ data: { likes_count: await likesCount(req.params.post), liked: false } });
});
