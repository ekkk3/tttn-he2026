import { query } from '../config/db.js';

// Ghi 1 thông báo cho user (đặt hàng, hủy đơn, cập nhật trạng thái, kết quả thanh toán, ...).
// Dùng chung bởi orderController (khách hàng), paymentController (webhook cổng thanh toán)
// và admin/orders.controller (admin thao tác đơn) — trước đây mỗi nơi tự INSERT riêng.
export async function notifyUser(userId, type, title, message, linkUrl = null) {
  await query(
    'INSERT INTO notifications (user_id, type, title, message, link_url) VALUES (?, ?, ?, ?, ?)',
    [userId, type, title, message, linkUrl]
  );
}
