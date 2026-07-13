import crypto from 'crypto';
import 'dotenv/config';

function sortObject(obj) {
  const sorted = {};
  Object.keys(obj)
    .sort()
    .forEach((key) => {
      sorted[key] = obj[key];
    });
  return sorted;
}

// Xay dung URL redirect sang VNPay theo dung chuan chu ky HMAC-SHA512 cua VNPay.
// Can dang ky merchant sandbox va dien VNPAY_TMN_CODE / VNPAY_HASH_SECRET trong .env.
export function buildVnpayUrl({ orderId, amount, ipAddr }) {
  if (!process.env.VNPAY_TMN_CODE || !process.env.VNPAY_HASH_SECRET) {
    console.warn('[vnpay] Chua cau hinh VNPAY_TMN_CODE/VNPAY_HASH_SECRET — tra ve null.');
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

  vnpParams = sortObject(vnpParams);
  const signData = new URLSearchParams(vnpParams).toString();
  const hmac = crypto.createHmac('sha512', process.env.VNPAY_HASH_SECRET);
  const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');
  vnpParams.vnp_SecureHash = signed;

  return `${process.env.VNPAY_URL}?${new URLSearchParams(vnpParams).toString()}`;
}

// Xac minh chu ky tren query tra ve tu VNPay (ReturnUrl hoac IPN). Tinh lai HMAC-SHA512
// tren cac tham so con lai (sau khi bo vnp_SecureHash) va so voi chu ky VNPay gui.
export function verifyVnpayReturn(queryParams) {
  if (!process.env.VNPAY_HASH_SECRET) return { valid: false, reason: 'NOT_CONFIGURED' };
  const params = { ...queryParams };
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
    // '00' = giao dich thanh cong (ca ma phan hoi lan trang thai giao dich).
    success: params.vnp_ResponseCode === '00' && params.vnp_TransactionStatus === '00',
    responseCode: params.vnp_ResponseCode,
    transactionCode: params.vnp_TransactionNo || null,
    amount: params.vnp_Amount ? Number(params.vnp_Amount) / 100 : null,
  };
}
