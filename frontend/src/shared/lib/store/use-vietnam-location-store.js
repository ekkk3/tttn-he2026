import axios from "axios";
import { create } from "zustand";
const VIETNAM_LOCATION_API_BASE = "https://provinces.open-api.vn/api/v1";
const initialState = {
    provinces: [],
    districtsByProvince: {},
    wardsByDistrict: {},
    isLoadingProvinces: false,
    isLoadingDistricts: false,
    isLoadingWards: false,
    error: null,
};
function buildDistrictCache(provinces) {
    return provinces.reduce((cache, province) => {
        cache[String(province.code)] = province.districts ?? [];
        return cache;
    }, {});
}
function locationErrorMessage(error, fallback) {
    if (error instanceof Error && error.message && error.message !== "Failed to fetch") {
        return error.message;
    }
    return fallback;
}
async function locationRequest(path) {
    const response = await axios.get(`${VIETNAM_LOCATION_API_BASE}${path}`, {
        adapter: "fetch",
        env: {
            Request: null,
        },
        headers: {
            Accept: "application/json",
        },
    });
    return response.data;
}
export const useVietnamLocationStore = create()((set, get) => ({
    ...initialState,
    loadProvinces: async () => {
        const cached = get().provinces;
        if (cached.length > 0) {
            return { success: true, data: cached };
        }
        set({ isLoadingProvinces: true, error: null });
        try {
            const provinces = await locationRequest("/?depth=2");
            set({
                provinces,
                districtsByProvince: buildDistrictCache(provinces),
                isLoadingProvinces: false,
                error: null,
            });
            return { success: true, data: provinces };
        }
        catch (error) {
            const message = locationErrorMessage(error, "Khong the tai danh sach tinh/thanh.");
            set({ isLoadingProvinces: false, error: message });
            return { success: false, error: message };
        }
    },
    loadDistricts: async (provinceCode) => {
        const key = String(provinceCode);
        const cached = get().districtsByProvince[key];
        if (cached) {
            return { success: true, data: cached };
        }
        set({ isLoadingDistricts: true, error: null });
        try {
            if (get().provinces.length === 0) {
                const provincesResult = await get().loadProvinces();
                if (!provincesResult.success) {
                    set({ isLoadingDistricts: false });
                    return { success: false, error: provincesResult.error };
                }
            }
            const province = get().provinces.find((item) => item.code === provinceCode);
            const districts = province?.districts ?? [];
            set((state) => ({
                districtsByProvince: {
                    ...state.districtsByProvince,
                    [key]: districts,
                },
                isLoadingDistricts: false,
                error: null,
            }));
            return { success: true, data: districts };
        }
        catch (error) {
            const message = locationErrorMessage(error, "Khong the tai danh sach quan/huyen.");
            set({ isLoadingDistricts: false, error: message });
            return { success: false, error: message };
        }
    },
    loadWards: async (districtCode) => {
        const key = String(districtCode);
        const cached = get().wardsByDistrict[key];
        if (cached) {
            return { success: true, data: cached };
        }
        set({ isLoadingWards: true, error: null });
        try {
            const district = await locationRequest(`/d/${encodeURIComponent(districtCode)}?depth=2`);
            const wards = district.wards ?? [];
            set((state) => ({
                wardsByDistrict: {
                    ...state.wardsByDistrict,
                    [key]: wards,
                },
                isLoadingWards: false,
                error: null,
            }));
            return { success: true, data: wards };
        }
        catch (error) {
            const message = locationErrorMessage(error, "Khong the tai danh sach phuong/xa.");
            set({ isLoadingWards: false, error: message });
            return { success: false, error: message };
        }
    },
    reset: () => set(initialState),
}));
