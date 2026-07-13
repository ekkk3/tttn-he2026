import axios from 'axios';
import 'dotenv/config';

const ghn = axios.create({
  baseURL: process.env.GHN_API_URL || 'https://online-gateway.ghn.vn/shiip/public-api',
  headers: { Token: process.env.GHN_TOKEN || '' },
});

// GHN service_type_id = 2: hang nhe / giao hang tieu chuan (phu hop dac san dong goi nho).
const SERVICE_TYPE_ID = 2;
// Kich thuoc & khoi luong mac dinh cho 1 kien dac san khi admin khong nhap tay.
const DEFAULT_PARCEL = { weight: 500, length: 20, width: 20, height: 10 };

// Da du token + shop id de goi API tinh phi / tao van don that chua?
export function ghnConfigured() {
  return Boolean(process.env.GHN_TOKEN && process.env.GHN_SHOP_ID);
}

function shopHeaders() {
  return { headers: { ShopId: process.env.GHN_SHOP_ID } };
}

export async function getProvinces() {
  const { data } = await ghn.get('/master-data/province');
  return data.data;
}

export async function getDistricts(provinceId) {
  const { data } = await ghn.get('/master-data/district', { params: { province_id: provinceId } });
  return data.data;
}

export async function getWards(districtId) {
  const { data } = await ghn.get('/master-data/ward', { params: { district_id: districtId } });
  return data.data;
}

// Tinh phi van chuyen GHN theo quan/huyen + phuong/xa nhan. Tra ve null neu chua cau hinh
// (caller se fallback ve bang phi noi bo). GHN_FROM_DISTRICT_ID = quan/huyen kho lay hang.
export async function calculateFee({ toDistrictId, toWardCode, weight, length, width, height, insuranceValue = 0 }) {
  if (!ghnConfigured()) return null;
  const body = {
    service_type_id: SERVICE_TYPE_ID,
    from_district_id: Number(process.env.GHN_FROM_DISTRICT_ID) || undefined,
    to_district_id: Number(toDistrictId),
    to_ward_code: String(toWardCode),
    weight: weight || DEFAULT_PARCEL.weight,
    length: length || DEFAULT_PARCEL.length,
    width: width || DEFAULT_PARCEL.width,
    height: height || DEFAULT_PARCEL.height,
    insurance_value: Math.round(insuranceValue || 0),
  };
  const { data } = await ghn.post('/v2/shipping-order/fee', body, shopHeaders());
  return data.data; // { total, service_fee, insurance_fee, ... }
}

// Tao van don GHN that. Tra ve null neu chua cau hinh -> caller tao van don thu cong.
export async function createShippingOrder({
  order, toDistrictId, toWardCode, items,
  weight, length, width, height, codAmount, insuranceValue = 0,
  requiredNote = 'KHONGCHOXEMHANG',
}) {
  if (!ghnConfigured()) return null;
  const body = {
    payment_type_id: 1, // shop tra phi (COD thu ho rieng qua cod_amount).
    required_note: requiredNote,
    to_name: order.recipient_name,
    to_phone: order.recipient_phone,
    to_address: order.shipping_address,
    to_ward_code: String(toWardCode),
    to_district_id: Number(toDistrictId),
    cod_amount: Math.round(codAmount || 0),
    insurance_value: Math.round(insuranceValue || 0),
    weight: weight || DEFAULT_PARCEL.weight,
    length: length || DEFAULT_PARCEL.length,
    width: width || DEFAULT_PARCEL.width,
    height: height || DEFAULT_PARCEL.height,
    service_type_id: SERVICE_TYPE_ID,
    items: items && items.length ? items : [{ name: order.order_no, quantity: 1, weight: DEFAULT_PARCEL.weight }],
  };
  const { data } = await ghn.post('/v2/shipping-order/create', body, shopHeaders());
  return data.data; // { order_code, total_fee, expected_delivery_time, ... }
}

// Tra cuu trang thai van don GHN theo order_code (dung khi admin bam "Dong bo").
export async function getShippingOrderDetail(orderCode) {
  if (!ghnConfigured()) return null;
  const { data } = await ghn.post('/v2/shipping-order/detail', { order_code: orderCode }, shopHeaders());
  return data.data; // { status, log, leadtime, ... }
}

// Huy van don GHN (khi admin xoa van don). Tra ve null neu chua cau hinh.
export async function cancelShippingOrder(orderCode) {
  if (!ghnConfigured()) return null;
  const { data } = await ghn.post('/v2/switch-status/cancel', { order_codes: [orderCode] }, shopHeaders());
  return data.data;
}
