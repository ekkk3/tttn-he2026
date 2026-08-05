import { query } from '../config/db.js';
import { notifyUser } from './notificationService.js';
import { PAYMENT_TRANSITIONS } from './orderTransitions.js';

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

// ==================================================================
// Hoàn tiền do Admin xử lý khiếu nại chấp nhận hoàn tiền (UC 2.2.18 Quản lý khiếu nại)
// — khác với applyPaymentResult() ở trên (được cổng thanh toán gọi tự động qua callback),
// hàm này do CON NGƯỜI (Admin) chủ động kích hoạt. Chỉ cập nhật trạng thái/lịch sử thanh
// toán nội bộ — KHÔNG gọi API hoàn tiền thật của VNPay/MoMo (dự án không có sandbox thật,
// xem [[tmdt-3-integrations-completed]]); đây là ghi nhận quyết định hoàn tiền để vận hành
// đối soát thủ công, giống cách "Chờ xác nhận chuyển khoản" đã xử lý cho COD/bank transfer.
// ==================================================================
export async function markOrderRefunded({ orderId, note, actorUserId }) {
  const [order] = await query('SELECT * FROM orders WHERE id = ?', [orderId]);
  if (!order) return { ok: false, reason: 'ORDER_NOT_FOUND' };
  const [payment] = await query('SELECT * FROM payments WHERE order_id = ? ORDER BY id DESC LIMIT 1', [orderId]);
  if (!payment) return { ok: false, reason: 'PAYMENT_NOT_FOUND' };
  // Theo PAYMENT_TRANSITIONS (orderTransitions.js): chỉ SUCCESS mới được chuyển REFUNDED —
  // tránh hoàn tiền cho đơn chưa từng thanh toán thành công (vd COD chưa thu tiền).
  if (payment.payment_status !== 'SUCCESS') {
    return { ok: false, reason: 'PAYMENT_NOT_REFUNDABLE', paymentStatus: payment.payment_status };
  }
  if (payment.payment_status === 'REFUNDED') {
    return { ok: true, alreadyProcessed: true, order };
  }
  await query('UPDATE payments SET payment_status = ? WHERE id = ?', ['REFUNDED', payment.id]);
  await query(
    'INSERT INTO payment_status_history (order_id, from_status, to_status, note, changed_by_user_id) VALUES (?, ?, ?, ?, ?)',
    [orderId, payment.payment_status, 'REFUNDED', note || 'Hoàn tiền theo kết quả xử lý khiếu nại', actorUserId]
  );
  await notifyUser(
    order.user_id,
    'PAYMENT_REFUNDED',
    'Đơn hàng đã được hoàn tiền',
    `Đơn hàng ${order.order_no} đã được hoàn tiền theo kết quả xử lý khiếu nại.`,
    `/account/orders/${orderId}`
  );
  return { ok: true, order };
}

// ==================================================================
// COD: tiền được shipper thu trực tiếp lúc giao hàng, không đi qua cổng thanh toán nào nên
// không có callback tự động nào gọi applyPaymentResult() ở trên như VNPay/MoMo. Nếu không tự
// cập nhật ở đây, mọi đơn COD sau khi giao xong vẫn mãi kẹt ở payment_status=PENDING cho tới
// khi Admin tự tay bấm "Đã thanh toán" (admin/orders.controller.js#updatePaymentStatus) — dễ
// sót, khiến báo cáo/đối soát tưởng nhầm là "chưa thu được tiền" dù thực tế khách đã trả tiền
// mặt cho shipper rồi. Gọi hàm này từ MỌI nơi có thể đưa đơn sang DELIVERED (admin đổi trạng
// thái đơn lẻ/hàng loạt, nhân viên kho cập nhật giao hàng, khách tự xác nhận đã nhận hàng).
// Không làm gì (bỏ qua êm) nếu: không phải đơn COD, chưa có payment, hoặc trạng thái thanh
// toán hiện tại không được phép nhảy thẳng sang SUCCESS (đã SUCCESS/REFUNDED từ trước — tái
// dùng chính PAYMENT_TRANSITIONS thay vì hardcode "chỉ PENDING" để không lệch với state machine
// dùng chung nơi khác).
export async function markCodOrderPaidIfDelivered(orderId) {
  const [order] = await query('SELECT payment_method FROM orders WHERE id = ?', [orderId]);
  if (!order || order.payment_method !== 'COD') return;
  const [payment] = await query(
    'SELECT id, payment_status FROM payments WHERE order_id = ? ORDER BY id DESC LIMIT 1',
    [orderId]
  );
  if (!payment || !(PAYMENT_TRANSITIONS[payment.payment_status] ?? []).includes('SUCCESS')) return;
  await query("UPDATE payments SET payment_status = 'SUCCESS', paid_at = NOW() WHERE id = ?", [payment.id]);
  await query(
    "INSERT INTO payment_status_history (order_id, from_status, to_status, note) VALUES (?, ?, 'SUCCESS', ?)",
    [orderId, payment.payment_status, 'Tự động xác nhận đã thu tiền COD khi giao hàng thành công']
  );
}
