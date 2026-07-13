import { asyncHandler } from '../utils/asyncHandler.js';
import { getProvinces, getDistricts, getWards } from '../utils/ghn.js';

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
