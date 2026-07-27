import { asyncHandler } from '../utils/asyncHandler.js';
import { verifyVnpayReturn } from '../utils/vnpay.js';
import { verifyMomoCallback } from '../utils/momo.js';
import { applyPaymentResult } from '../services/paymentService.js';

// ==================================================================
// Xử lý kết quả thanh toán online (UC 2.2.9 / 2.2.25).
// Cổng thanh toán gọi về 2 kênh:
//   - ReturnUrl/redirectUrl: trình duyệt khách quay về (hiện kết quả cho khách).
//   - IPN (server->server): nguồn cập nhật CHÍNH THỨC, đảm bảo dù khách đóng tab.
// Logic cập nhật DB (idempotent) nằm trong services/paymentService.js#applyPaymentResult,
// controller ở đây chỉ lo verify chữ ký + adapt response theo từng cổng thanh toán.
// ==================================================================

// ---------------- VNPay ----------------
// GET /api/payments/vnpay/return — trình duyệt khách quay về từ VNPay.
export const vnpayReturn = asyncHandler(async (req, res) => {
  const result = verifyVnpayReturn(req.query);
  if (result.reason === 'NOT_CONFIGURED') {
    return res.status(503).json({ data: { verified: false, message: 'VNPay chưa được cấu hình.' } });
  }
  if (!result.valid) {
    return res.status(400).json({ data: { verified: false, message: 'Chữ ký VNPay không hợp lệ.' } });
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
      message: result.success ? 'Thanh toán VNPay thành công.' : 'Thanh toán VNPay không thành công.',
    },
  });
});

// GET /api/payments/vnpay/ipn — VNPay gọi server->server. Trả đúng format { RspCode, Message }.
export const vnpayIpn = asyncHandler(async (req, res) => {
  const result = verifyVnpayReturn(req.query);
  // RspCode là mã phản hồi THEO CHUẨN VNPay quy định (không phải HTTP status) — VNPay đọc
  // đúng field này để quyết định có coi IPN là "đã xử lý" hay sẽ gửi lại: '97' = sai chữ ký,
  // '01' = không tìm thấy đơn, '00' = xử lý thành công.
  if (!result.valid) return res.json({ RspCode: '97', Message: 'Invalid signature' });
  const applied = await applyPaymentResult({
    orderId: result.orderId, success: result.success,
    transactionCode: result.transactionCode, gatewayName: 'VNPay', rawPayload: req.query,
  });
  if (!applied.ok) return res.json({ RspCode: '01', Message: 'Order not found' });
  return res.json({ RspCode: '00', Message: 'Confirm Success' });
});

// ---------------- MoMo ----------------
// POST /api/payments/momo/ipn — nguồn cập nhật chính thức (MoMo gọi server->server).
export const momoIpn = asyncHandler(async (req, res) => {
  const result = verifyMomoCallback(req.body);
  if (!result.valid) return res.status(204).end();
  await applyPaymentResult({
    orderId: result.orderId, success: result.success,
    transactionCode: result.transactionCode, gatewayName: 'MoMo', rawPayload: req.body,
  });
  // MoMo chỉ cần HTTP 204/200 là coi như đã nhận IPN.
  return res.status(204).end();
});

// GET /api/payments/momo/return — trình duyệt khách quay về từ MoMo.
export const momoReturn = asyncHandler(async (req, res) => {
  const result = verifyMomoCallback(req.query);
  if (result.reason === 'NOT_CONFIGURED') {
    return res.status(503).json({ data: { verified: false, message: 'MoMo chưa được cấu hình.' } });
  }
  if (!result.valid) {
    return res.status(400).json({ data: { verified: false, message: 'Chữ ký MoMo không hợp lệ.' } });
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
      message: result.success ? 'Thanh toán MoMo thành công.' : 'Thanh toán MoMo không thành công.',
    },
  });
});
