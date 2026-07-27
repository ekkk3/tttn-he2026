import { query } from '../config/db.js';
import { notifyUser } from './notificationService.js';

// ==================================================================
// Xử lý kết quả thanh toán online (UC 2.2.9 / 2.2.25) — logic nghiệp vụ thuần túy,
// tách khỏi paymentController.js để controller chỉ còn lo parse/verify request cổng
// thanh toán (VNPay, MoMo) rồi gọi service này cập nhật DB.
// applyPaymentResult() là điểm cập nhật DB chung, idempotent (không xử lý 2 lần).
// ==================================================================
export async function applyPaymentResult({ orderId, success, transactionCode, gatewayName, rawPayload }) {
  if (!orderId) return { ok: false, reason: 'NO_ORDER_ID' };
  const [order] = await query('SELECT * FROM orders WHERE id = ?', [orderId]);
  if (!order) return { ok: false, reason: 'ORDER_NOT_FOUND' };
  const [payment] = await query('SELECT * FROM payments WHERE order_id = ? ORDER BY id DESC LIMIT 1', [orderId]);
  if (!payment) return { ok: false, reason: 'PAYMENT_NOT_FOUND', order };

  // Idempotent: nếu đã SUCCESS thì thôi, tránh ghi trùng khi cả Return và IPN cùng gọi.
  if (payment.payment_status === 'SUCCESS') {
    return { ok: true, alreadyProcessed: true, order, success: true };
  }

  const newStatus = success ? 'SUCCESS' : 'FAILED';
  // paid_at cần gọi hàm SQL NOW() (không phải 1 giá trị JS truyền qua tham số ?), nên phải
  // ghép thẳng vào chuỗi câu lệnh thay vì đưa vào mảng params như các cột khác.
  const paidAtSql = success ? 'NOW()' : 'NULL';
  await query(
    `UPDATE payments SET payment_status = ?, transaction_code = ?, gateway_name = COALESCE(?, gateway_name),
       raw_payload = ?, paid_at = ${paidAtSql} WHERE id = ?`,
    [newStatus, transactionCode ?? null, gatewayName ?? null, rawPayload ? JSON.stringify(rawPayload) : null, payment.id]
  );
  await query(
    'INSERT INTO payment_status_history (order_id, from_status, to_status, note) VALUES (?, ?, ?, ?)',
    [orderId, payment.payment_status, newStatus,
      success ? 'Cổng thanh toán xác nhận thành công' : 'Cổng thanh toán báo thất bại']
  );

  // Thanh toán thành công -> chuyển đơn PENDING sang CONFIRMED (đã thanh toán, chờ xử lý).
  if (success && order.status === 'PENDING') {
    await query("UPDATE orders SET status = 'CONFIRMED' WHERE id = ?", [orderId]);
    await query(
      "INSERT INTO order_status_history (order_id, from_status, to_status, note) VALUES (?, 'PENDING', 'CONFIRMED', 'Thanh toán online thành công')",
      [orderId]
    );
  }

  await notifyUser(
    order.user_id,
    success ? 'PAYMENT_SUCCESS' : 'PAYMENT_FAILED',
    success ? 'Thanh toán thành công' : 'Thanh toán thất bại',
    success ? `Đơn hàng ${order.order_no} đã được thanh toán.` : `Thanh toán đơn ${order.order_no} không thành công.`,
    `/account/orders/${orderId}`
  );

  // ok: đã xử lý xong không lỗi hệ thống (khác với `success` — success là kết quả THANH TOÁN
  // do cổng trả về, ok là kết quả gọi HÀM NÀY). Controller gọi hàm này (paymentController.js)
  // dựa vào `ok`/`reason` để quyết định trả 200 hay lỗi cho cổng thanh toán.
  return { ok: true, order, success };
}
