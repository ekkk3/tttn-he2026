import { asyncHandler } from '../utils/asyncHandler.js';
import { getProvinces, getDistricts, getWards, calculateFee, ghnConfigured } from '../utils/ghn.js';

// Frontend (use-ghn-location-store.js) đọc { data }. Nếu chưa cấu hình GHN_TOKEN,
// gọi GHN sẽ lỗi -> trả 200 với mảng rỗng để UI không sập (chỉ là không có lựa chọn).
export const provinces = asyncHandler(async (req, res) => {
  try {
    res.json({ data: await getProvinces() });
  } catch {
    res.json({ data: [] });
  }
});

export const districts = asyncHandler(async (req, res) => {
  try {
    res.json({ data: await getDistricts(req.query.province_id) });
  } catch {
    res.json({ data: [] });
  }
});

export const wards = asyncHandler(async (req, res) => {
  try {
    res.json({ data: await getWards(req.query.district_id) });
  } catch {
    res.json({ data: [] });
  }
});

// POST /api/shipping/ghn/fee — tính phí GHN thời gian thực cho trang checkout.
// Body: { to_district_id, to_ward_code, weight?, insurance_value? }.
// Nếu chưa cấu hình GHN (hoặc lỗi) -> trả { configured:false, fee:null } để UI dùng
// bảng phí nội bộ (calculateShippingFee bên orderController) — không làm sập checkout.
export const fee = asyncHandler(async (req, res) => {
  const { to_district_id, to_ward_code, weight, insurance_value } = req.body;
  if (!ghnConfigured()) return res.json({ data: { configured: false, fee: null } });
  if (!to_district_id || !to_ward_code) {
    return res.status(422).json({ message: 'Thiếu to_district_id hoặc to_ward_code.' });
  }
  try {
    const result = await calculateFee({
      toDistrictId: to_district_id, toWardCode: to_ward_code, weight, insuranceValue: insurance_value,
    });
    res.json({ data: { configured: true, fee: result?.total != null ? Number(result.total) : null, detail: result } });
  } catch (err) {
    res.json({ data: { configured: false, fee: null, error: err.response?.data?.message || err.message } });
  }
});
