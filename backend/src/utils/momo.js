import crypto from 'crypto';
import axios from 'axios';
import 'dotenv/config';

// Tạo yêu cầu thanh toán MoMo (captureWallet) theo đúng chuẩn chữ ký HMAC-SHA256 của MoMo.
// Cần đăng ký merchant sandbox và điền các biến MOMO_* trong .env.
export async function createMomoPayment({ orderId, amount }) {
  if (!process.env.MOMO_PARTNER_CODE || !process.env.MOMO_SECRET_KEY) {
    console.warn('[momo] Chưa cấu hình MOMO_PARTNER_CODE/MOMO_SECRET_KEY — trả về null.');
    return null;
  }
  const requestId = `${Date.now()}`;
  // MoMo yêu cầu orderId duy nhất cho mỗi request tạo thanh toán (kể cả khi thanh toán lại
  // cùng 1 đơn hàng nội bộ) -> ghép thêm requestId để không trùng; verifyMomoCallback() bên
  // dưới sẽ tách ngược lại để lấy orderId nội bộ thật.
  const orderIdMomo = `${orderId}-${requestId}`;
  const requestType = 'captureWallet';
  const extraData = '';
  const orderInfo = `Thanh toan don hang ${orderId}`;

  // MoMo yêu cầu ký HMAC trên 1 chuỗi ghép đúng theo THỨ TỰ TÊN TRƯỜNG cố định (alphabet)
  // được quy định trong tài liệu — sai thứ tự hoặc thiếu field sẽ khiến chữ ký không khớp
  // và MoMo từ chối request dù dữ liệu gửi lên đúng.
  const rawSignature =
    `accessKey=${process.env.MOMO_ACCESS_KEY}` +
    `&amount=${Math.round(amount)}` +
    `&extraData=${extraData}` +
    `&ipnUrl=${process.env.MOMO_NOTIFY_URL}` +
    `&orderId=${orderIdMomo}` +
    `&orderInfo=${orderInfo}` +
    `&partnerCode=${process.env.MOMO_PARTNER_CODE}` +
    `&redirectUrl=${process.env.MOMO_RETURN_URL}` +
    `&requestId=${requestId}` +
    `&requestType=${requestType}`;

  const signature = crypto
    .createHmac('sha256', process.env.MOMO_SECRET_KEY)
    .update(rawSignature)
    .digest('hex');

  // Gửi request tạo giao dịch lên MoMo kèm chữ ký vừa tính; MoMo trả về payUrl để
  // redirect trình duyệt khách sang trang thanh toán MoMo thật.
  const { data } = await axios.post(process.env.MOMO_ENDPOINT, {
    partnerCode: process.env.MOMO_PARTNER_CODE,
    accessKey: process.env.MOMO_ACCESS_KEY,
    requestId,
    amount: Math.round(amount),
    orderId: orderIdMomo,
    orderInfo,
    redirectUrl: process.env.MOMO_RETURN_URL,
    ipnUrl: process.env.MOMO_NOTIFY_URL,
    extraData,
    requestType,
    signature,
    lang: 'vi',
  });

  return data.payUrl || null;
}

// Xác minh chữ ký MoMo trả về (IPN POST hoặc redirectUrl GET). MoMo ký HMAC-SHA256 trên
// chuỗi rawSignature với các trường sắp xếp theo alphabet (theo tài liệu MoMo v2).
// orderId MoMo có dạng `${orderIdNoiBo}-${requestId}` -> tách lấy id nội bộ.
export function verifyMomoCallback(payload) {
  if (!process.env.MOMO_SECRET_KEY) return { valid: false, reason: 'NOT_CONFIGURED' };
  const raw =
    `accessKey=${process.env.MOMO_ACCESS_KEY}` +
    `&amount=${payload.amount}` +
    `&extraData=${payload.extraData}` +
    `&message=${payload.message}` +
    `&orderId=${payload.orderId}` +
    `&orderInfo=${payload.orderInfo}` +
    `&orderType=${payload.orderType}` +
    `&partnerCode=${payload.partnerCode}` +
    `&payType=${payload.payType}` +
    `&requestId=${payload.requestId}` +
    `&responseTime=${payload.responseTime}` +
    `&resultCode=${payload.resultCode}` +
    `&transId=${payload.transId}`;
  const signature = crypto.createHmac('sha256', process.env.MOMO_SECRET_KEY).update(raw).digest('hex');

  return {
    // So sánh chữ ký TỰ TÍNH LẠI với chữ ký MoMo gửi kèm — chỉ khớp khi request thực sự
    // đến từ MoMo (biết SECRET_KEY) và dữ liệu không bị sửa trên đường truyền.
    valid: signature === payload.signature,
    orderId: payload.orderId ? Number(String(payload.orderId).split('-')[0]) : null,
    // resultCode 0 = thành công (theo tài liệu MoMo).
    success: String(payload.resultCode) === '0',
    transactionCode: payload.transId ? String(payload.transId) : null,
    amount: payload.amount != null ? Number(payload.amount) : null,
  };
}
