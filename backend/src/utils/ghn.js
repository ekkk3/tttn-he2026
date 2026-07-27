import axios from 'axios';
import 'dotenv/config';

// Instance axios dùng chung cho mọi lời gọi GHN: baseURL + header Token (API key GHN) đã
// gắn sẵn nên các hàm bên dưới chỉ cần gọi ghn.get()/ghn.post() với path tương đối.
const ghn = axios.create({
  baseURL: process.env.GHN_API_URL || 'https://online-gateway.ghn.vn/shiip/public-api',
  headers: { Token: process.env.GHN_TOKEN || '' },
});

// GHN service_type_id = 2: hàng nhẹ / giao hàng tiêu chuẩn (phù hợp đặc sản đóng gói nhỏ).
const SERVICE_TYPE_ID = 2;
// Kích thước & khối lượng mặc định cho 1 kiện đặc sản khi admin không nhập tay.
const DEFAULT_PARCEL = { weight: 500, length: 20, width: 20, height: 10 };

// Đã đủ token + shop id để gọi API tính phí / tạo vận đơn thật chưa?
export function ghnConfigured() {
  return Boolean(process.env.GHN_TOKEN && process.env.GHN_SHOP_ID);
}

// Một số API GHN (tính phí, tạo/hủy vận đơn) cần thêm header ShopId ngoài Token chung —
// header riêng theo từng request nên tách thành hàm helper thay vì gắn cố định vào `ghn`.
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

// Tính phí vận chuyển GHN theo quận/huyện + phường/xã nhận. Trả về null nếu chưa cấu hình
// (caller sẽ fallback về bảng phí nội bộ). GHN_FROM_DISTRICT_ID = quận/huyện kho lấy hàng.
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

// Tạo vận đơn GHN thật. Trả về null nếu chưa cấu hình -> caller tạo vận đơn thủ công.
export async function createShippingOrder({
  order, toDistrictId, toWardCode, items,
  weight, length, width, height, codAmount, insuranceValue = 0,
  requiredNote = 'KHONGCHOXEMHANG',
}) {
  if (!ghnConfigured()) return null;
  const body = {
    payment_type_id: 1, // shop trả phí (COD thu hộ riêng qua cod_amount).
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

// Tra cứu trạng thái vận đơn GHN theo order_code (dùng khi admin bấm "Đồng bộ").
export async function getShippingOrderDetail(orderCode) {
  if (!ghnConfigured()) return null;
  const { data } = await ghn.post('/v2/shipping-order/detail', { order_code: orderCode }, shopHeaders());
  return data.data; // { status, log, leadtime, ... }
}

// Hủy vận đơn GHN (khi admin xóa vận đơn). Trả về null nếu chưa cấu hình.
export async function cancelShippingOrder(orderCode) {
  if (!ghnConfigured()) return null;
  const { data } = await ghn.post('/v2/switch-status/cancel', { order_codes: [orderCode] }, shopHeaders());
  return data.data;
}
