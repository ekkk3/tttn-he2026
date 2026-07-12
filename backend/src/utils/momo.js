import crypto from 'crypto';
import axios from 'axios';
import 'dotenv/config';

// Tao yeu cau thanh toan MoMo (captureWallet) theo dung chuan chu ky HMAC-SHA256 cua MoMo.
// Can dang ky merchant sandbox va dien cac bien MOMO_* trong .env.
export async function createMomoPayment({ orderId, amount }) {
  if (!process.env.MOMO_PARTNER_CODE || !process.env.MOMO_SECRET_KEY) {
    console.warn('[momo] Chua cau hinh MOMO_PARTNER_CODE/MOMO_SECRET_KEY — tra ve null.');
    return null;
  }
  const requestId = `${Date.now()}`;
  const orderIdMomo = `${orderId}-${requestId}`;
  const requestType = 'captureWallet';
  const extraData = '';
  const orderInfo = `Thanh toan don hang ${orderId}`;

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
