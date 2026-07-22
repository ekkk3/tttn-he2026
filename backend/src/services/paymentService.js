import { query } from '../config/db.js';
import { notifyUser } from './notificationService.js';

// ==================================================================
// Xu ly ket qua thanh toan online (UC 2.2.9 / 2.2.25) — logic nghiep vu thuan tuy,
// tach khoi paymentController.js de controller chi con lo parse/verify request cong
// thanh toan (VNPay, MoMo) roi goi service nay cap nhat DB.
// applyPaymentResult() la diem cap nhat DB chung, idempotent (khong xu ly 2 lan).
// ==================================================================
export async function applyPaymentResult({ orderId, success, transactionCode, gatewayName, rawPayload }) {
  if (!orderId) return { ok: false, reason: 'NO_ORDER_ID' };
  const [order] = await query('SELECT * FROM orders WHERE id = ?', [orderId]);
  if (!order) return { ok: false, reason: 'ORDER_NOT_FOUND' };
  const [payment] = await query('SELECT * FROM payments WHERE order_id = ? ORDER BY id DESC LIMIT 1', [orderId]);
  if (!payment) return { ok: false, reason: 'PAYMENT_NOT_FOUND', order };

  // Idempotent: neu da SUCCESS thi thoi, tranh ghi trung khi ca Return va IPN cung goi.
  if (payment.payment_status === 'SUCCESS') {
    return { ok: true, alreadyProcessed: true, order, success: true };
  }

  const newStatus = success ? 'SUCCESS' : 'FAILED';
  const paidAtSql = success ? 'NOW()' : 'NULL';
  await query(
    `UPDATE payments SET payment_status = ?, transaction_code = ?, gateway_name = COALESCE(?, gateway_name),
       raw_payload = ?, paid_at = ${paidAtSql} WHERE id = ?`,
    [newStatus, transactionCode ?? null, gatewayName ?? null, rawPayload ? JSON.stringify(rawPayload) : null, payment.id]
  );
  await query(
    'INSERT INTO payment_status_history (order_id, from_status, to_status, note) VALUES (?, ?, ?, ?)',
    [orderId, payment.payment_status, newStatus,
      success ? 'Cong thanh toan xac nhan thanh cong' : 'Cong thanh toan bao that bai']
  );

  // Thanh toan thanh cong -> chuyen don PENDING sang CONFIRMED (da thanh toan, cho xu ly).
  if (success && order.status === 'PENDING') {
    await query("UPDATE orders SET status = 'CONFIRMED' WHERE id = ?", [orderId]);
    await query(
      "INSERT INTO order_status_history (order_id, from_status, to_status, note) VALUES (?, 'PENDING', 'CONFIRMED', 'Thanh toan online thanh cong')",
      [orderId]
    );
  }

  await notifyUser(
    order.user_id,
    success ? 'PAYMENT_SUCCESS' : 'PAYMENT_FAILED',
    success ? 'Thanh toan thanh cong' : 'Thanh toan that bai',
    success ? `Don hang ${order.order_no} da duoc thanh toan.` : `Thanh toan don ${order.order_no} khong thanh cong.`,
    `/account/orders/${orderId}`
  );

  return { ok: true, order, success };
}
