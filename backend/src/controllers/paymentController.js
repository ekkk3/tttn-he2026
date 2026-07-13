import { query } from '../config/db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { verifyVnpayReturn } from '../utils/vnpay.js';
import { verifyMomoCallback } from '../utils/momo.js';

// ==================================================================
// Xu ly ket qua thanh toan online (UC 2.2.9 / 2.2.25).
// Cong thanh toan goi ve 2 kenh:
//   - ReturnUrl/redirectUrl: trinh duyet khach quay ve (hien ket qua cho khach).
//   - IPN (server->server): nguon cap nhat CHINH THUC, dam bao du khach dong tab.
// applyPaymentResult() la diem cap nhat DB chung, idempotent (khong xu ly 2 lan).
// ==================================================================

async function applyPaymentResult({ orderId, success, transactionCode, gatewayName, rawPayload }) {
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

  await query(
    'INSERT INTO notifications (user_id, type, title, message, link_url) VALUES (?, ?, ?, ?, ?)',
    [order.user_id,
      success ? 'PAYMENT_SUCCESS' : 'PAYMENT_FAILED',
      success ? 'Thanh toan thanh cong' : 'Thanh toan that bai',
      success ? `Don hang ${order.order_no} da duoc thanh toan.` : `Thanh toan don ${order.order_no} khong thanh cong.`,
      `/account/orders/${orderId}`]
  );

  return { ok: true, order, success };
}

// ---------------- VNPay ----------------
// GET /api/payments/vnpay/return — trinh duyet khach quay ve tu VNPay.
export const vnpayReturn = asyncHandler(async (req, res) => {
  const result = verifyVnpayReturn(req.query);
  if (result.reason === 'NOT_CONFIGURED') {
    return res.status(503).json({ data: { verified: false, message: 'VNPay chua duoc cau hinh.' } });
  }
  if (!result.valid) {
    return res.status(400).json({ data: { verified: false, message: 'Chu ky VNPay khong hop le.' } });
  }
  const applied = await applyPaymentResult({
    orderId: result.orderId, success: result.success,
    transactionCode: result.transactionCode, gatewayName: 'VNPay', rawPayload: req.query,
  });
  res.json({
    data: {
      verified: true,
      success: result.success && applied.ok,
      order_id: result.orderId,
      response_code: result.responseCode,
      message: result.success ? 'Thanh toan VNPay thanh cong.' : 'Thanh toan VNPay khong thanh cong.',
    },
  });
});

// GET /api/payments/vnpay/ipn — VNPay goi server->server. Tra dung format { RspCode, Message }.
export const vnpayIpn = asyncHandler(async (req, res) => {
  const result = verifyVnpayReturn(req.query);
  if (!result.valid) return res.json({ RspCode: '97', Message: 'Invalid signature' });
  const applied = await applyPaymentResult({
    orderId: result.orderId, success: result.success,
    transactionCode: result.transactionCode, gatewayName: 'VNPay', rawPayload: req.query,
  });
  if (!applied.ok) return res.json({ RspCode: '01', Message: 'Order not found' });
  return res.json({ RspCode: '00', Message: 'Confirm Success' });
});

// ---------------- MoMo ----------------
// POST /api/payments/momo/ipn — nguon cap nhat chinh thuc (MoMo goi server->server).
export const momoIpn = asyncHandler(async (req, res) => {
  const result = verifyMomoCallback(req.body);
  if (!result.valid) return res.status(204).end();
  await applyPaymentResult({
    orderId: result.orderId, success: result.success,
    transactionCode: result.transactionCode, gatewayName: 'MoMo', rawPayload: req.body,
  });
  // MoMo chi can HTTP 204/200 la coi nhu da nhan IPN.
  return res.status(204).end();
});

// GET /api/payments/momo/return — trinh duyet khach quay ve tu MoMo.
export const momoReturn = asyncHandler(async (req, res) => {
  const result = verifyMomoCallback(req.query);
  if (result.reason === 'NOT_CONFIGURED') {
    return res.status(503).json({ data: { verified: false, message: 'MoMo chua duoc cau hinh.' } });
  }
  if (!result.valid) {
    return res.status(400).json({ data: { verified: false, message: 'Chu ky MoMo khong hop le.' } });
  }
  const applied = await applyPaymentResult({
    orderId: result.orderId, success: result.success,
    transactionCode: result.transactionCode, gatewayName: 'MoMo', rawPayload: req.query,
  });
  res.json({
    data: {
      verified: true,
      success: result.success && applied.ok,
      order_id: result.orderId,
      message: result.success ? 'Thanh toan MoMo thanh cong.' : 'Thanh toan MoMo khong thanh cong.',
    },
  });
});
