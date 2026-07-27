import crypto from 'crypto';
import 'dotenv/config';

// VNPay yêu cầu chuỗi dữ liệu đem đi ký HMAC phải có các tham số xếp theo thứ tự
// ALPHABET của tên field — hàm này tạo lại object với key đã sort để dùng chung cho cả
// lúc tạo URL thanh toán (buildVnpayUrl) lẫn lúc xác minh callback (verifyVnpayReturn).
function sortObject(obj) {
  const sorted = {};
  Object.keys(obj)
    .sort()
    .forEach((key) => {
      sorted[key] = obj[key];
    });
  return sorted;
}

// Xây dựng URL redirect sang VNPay theo đúng chuẩn chữ ký HMAC-SHA512 của VNPay.
// Cần đăng ký merchant sandbox và điền VNPAY_TMN_CODE / VNPAY_HASH_SECRET trong .env.
export function buildVnpayUrl({ orderId, amount, ipAddr }) {
  if (!process.env.VNPAY_TMN_CODE || !process.env.VNPAY_HASH_SECRET) {
    console.warn('[vnpay] Chưa cấu hình VNPAY_TMN_CODE/VNPAY_HASH_SECRET — trả về null.');
    return null;
  }
  const createDate = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);

  let vnpParams = {
    vnp_Version: '2.1.0',
    vnp_Command: 'pay',
    vnp_TmnCode: process.env.VNPAY_TMN_CODE,
    vnp_Locale: 'vn',
    vnp_CurrCode: 'VND',
    vnp_TxnRef: String(orderId),
    vnp_OrderInfo: `Thanh toan don hang ${orderId}`,
    vnp_OrderType: 'other',
    vnp_Amount: Math.round(amount) * 100,
    vnp_ReturnUrl: process.env.VNPAY_RETURN_URL,
    vnp_IpAddr: ipAddr || '127.0.0.1',
    vnp_CreateDate: createDate,
  };

  // Sắp xếp field, nối thành query string, rồi ký HMAC-SHA512 trên chuỗi đó bằng
  // HASH_SECRET — đây là "chữ ký" chứng minh URL này thực sự do server tạo ra, VNPay sẽ
  // kiểm tra lại chữ ký này khi redirect về (verifyVnpayReturn) để chống giả mạo tham số.
  vnpParams = sortObject(vnpParams);
  const signData = new URLSearchParams(vnpParams).toString();
  const hmac = crypto.createHmac('sha512', process.env.VNPAY_HASH_SECRET);
  const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');
  vnpParams.vnp_SecureHash = signed;

  // Trả về URL đầy đủ (kèm chữ ký) để backend redirect trình duyệt khách sang cổng VNPay.
  return `${process.env.VNPAY_URL}?${new URLSearchParams(vnpParams).toString()}`;
}

// Xác minh chữ ký trên query trả về từ VNPay (ReturnUrl hoặc IPN). Tính lại HMAC-SHA512
// trên các tham số còn lại (sau khi bỏ vnp_SecureHash) và so với chữ ký VNPay gửi.
export function verifyVnpayReturn(queryParams) {
  if (!process.env.VNPAY_HASH_SECRET) return { valid: false, reason: 'NOT_CONFIGURED' };
  const params = { ...queryParams };
  // Tách chữ ký VNPay gửi kèm ra riêng, rồi XÓA khỏi params trước khi tự tính lại chữ ký
  // — vì bản thân vnp_SecureHash không nằm trong dữ liệu được ký lúc đầu.
  const secureHash = params.vnp_SecureHash;
  delete params.vnp_SecureHash;
  delete params.vnp_SecureHashType;

  const sorted = sortObject(params);
  const signData = new URLSearchParams(sorted).toString();
  const signed = crypto
    .createHmac('sha512', process.env.VNPAY_HASH_SECRET)
    .update(Buffer.from(signData, 'utf-8'))
    .digest('hex');

  return {
    valid: signed === secureHash,
    orderId: params.vnp_TxnRef ? Number(params.vnp_TxnRef) : null,
    // '00' = giao dịch thành công (cả mã phản hồi lẫn trạng thái giao dịch).
    success: params.vnp_ResponseCode === '00' && params.vnp_TransactionStatus === '00',
    responseCode: params.vnp_ResponseCode,
    transactionCode: params.vnp_TransactionNo || null,
    amount: params.vnp_Amount ? Number(params.vnp_Amount) / 100 : null,
  };
}
