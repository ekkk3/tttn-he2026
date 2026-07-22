import { query } from '../config/db.js';

// Ghi 1 thong bao cho user (dat hang, huy don, cap nhat trang thai, ket qua thanh toan, ...).
// Dung chung boi orderController (khach hang), paymentController (webhook cong thanh toan)
// va admin/orders.controller (admin thao tac don) — truoc day moi noi tu INSERT rieng.
export async function notifyUser(userId, type, title, message, linkUrl = null) {
  await query(
    'INSERT INTO notifications (user_id, type, title, message, link_url) VALUES (?, ?, ?, ?, ?)',
    [userId, type, title, message, linkUrl]
  );
}
