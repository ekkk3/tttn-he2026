import axios from 'axios';
import 'dotenv/config';

const ghn = axios.create({
  baseURL: process.env.GHN_API_URL || 'https://online-gateway.ghn.vn/shiip/public-api',
  headers: { Token: process.env.GHN_TOKEN || '' },
});

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

// TODO: implement phi van chuyen thuc te qua POST /v2/shipping-order/fee
// va tao van don qua POST /v2/shipping-order/create (can GHN_SHOP_ID + dia chi lay hang).
// Xem controllers/admin/admin.controller.js -> storeShipment() la noi can goi ham nay.
