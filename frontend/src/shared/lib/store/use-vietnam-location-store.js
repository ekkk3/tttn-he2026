import axios from "axios";
import { create } from "zustand";
// LƯU Ý: store này gọi 1 API CÔNG KHAI CỦA BÊN THỨ BA (provinces.open-api.vn), KHÔNG phải
// backend của dự án — cung cấp danh sách tỉnh/thành/quận huyện/phường xã đầy đủ của Việt
// Nam để tham khảo/đối chiếu tên. Đây là nguồn khác với use-ghn-location-store.js (gọi
// qua backend, dữ liệu lấy từ GHN — dùng để tính phí/tạo vận đơn thật).
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
// adapter:"fetch" + env:{Request:null} là 1 workaround để axios dùng fetch() của trình
// duyệt thay vì XMLHttpRequest mặc định — cần thiết khi gọi domain ngoài từ 1 số môi
// trường preview/sandbox chặn XHR trực tiếp tới host lạ.
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
            const message = locationErrorMessage(error, "Không thể tải danh sách tỉnh/thành.");
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
            const message = locationErrorMessage(error, "Không thể tải danh sách quận/huyện.");
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
            const message = locationErrorMessage(error, "Không thể tải danh sách phường/xã.");
            set({ isLoadingWards: false, error: message });
            return { success: false, error: message };
        }
    },
    reset: () => set(initialState),
}));
