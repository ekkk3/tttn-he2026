import { asyncHandler } from '../utils/asyncHandler.js';
import { getProvinces, getDistricts, getWards } from '../utils/ghn.js';

export const provinces = asyncHandler(async (req, res) => {
  res.json({ provinces: await getProvinces() });
});

export const districts = asyncHandler(async (req, res) => {
  res.json({ districts: await getDistricts(req.query.province_id) });
});

export const wards = asyncHandler(async (req, res) => {
  res.json({ wards: await getWards(req.query.district_id) });
});
