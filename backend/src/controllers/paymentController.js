import { asyncHandler } from '../utils/asyncHandler.js';
import { verifyVnpayReturn } from '../utils/vnpay.js';
import { verifyMomoCallback } from '../utils/momo.js';
import { applyPaymentResult } from '../services/paymentService.js';

// ==================================================================
// Xu ly ket qua thanh toan online (UC 2.2.9 / 2.2.25).
// Cong thanh toan goi ve 2 kenh:
//   - ReturnUrl/redirectUrl: trinh duyet khach quay ve (hien ket qua cho khach).
//   - IPN (server->server): nguon cap nhat CHINH THUC, dam bao du khach dong tab.
// Logic cap nhat DB (idempotent) nam trong services/paymentService.js#applyPaymentResult,
// controller o day chi lo verify chu ky + adapt response theo tung cong thanh toan.
// ==================================================================

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
