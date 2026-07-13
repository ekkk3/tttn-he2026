import { asyncHandler } from '../utils/asyncHandler.js';
import { getProvinces, getDistricts, getWards, calculateFee, ghnConfigured } from '../utils/ghn.js';

// Frontend (use-ghn-location-store.js) doc { data }. Neu chua cau hinh GHN_TOKEN,
// goi GHN se loi -> tra 200 voi mang rong de UI khong sap (chi la khong co lua chon).
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

// POST /api/shipping/ghn/fee — tinh phi GHN thoi gian thuc cho trang checkout.
// Body: { to_district_id, to_ward_code, weight?, insurance_value? }.
// Neu chua cau hinh GHN (hoac loi) -> tra { configured:false, fee:null } de UI dung
// bang phi noi bo (calculateShippingFee ben orderController) — khong lam sap checkout.
export const fee = asyncHandler(async (req, res) => {
  const { to_district_id, to_ward_code, weight, insurance_value } = req.body;
  if (!ghnConfigured()) return res.json({ data: { configured: false, fee: null } });
  if (!to_district_id || !to_ward_code) {
    return res.status(422).json({ message: 'Thieu to_district_id hoac to_ward_code.' });
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
