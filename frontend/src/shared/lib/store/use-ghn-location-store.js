import { create } from "zustand";
import { apiRequest } from "@/shared/api/backend-client";
const initialState = {
    provinces: [],
    districtsByProvince: {},
    wardsByDistrict: {},
    isLoadingProvinces: false,
    isLoadingDistricts: false,
    isLoadingWards: false,
    error: null,
};
export const useGhnLocationStore = create()((set, get) => ({
    ...initialState,
    loadProvinces: async () => {
        const cached = get().provinces;
        if (cached.length > 0) {
            return { success: true, data: cached };
        }
        set({ isLoadingProvinces: true, error: null });
        try {
            const response = await apiRequest("/shipping/ghn/provinces");
            set({
                provinces: response.data,
                isLoadingProvinces: false,
                error: null,
            });
            return { success: true, data: response.data };
        }
        catch (error) {
            const message = error instanceof Error ? error.message : "Khong the tai tinh/thanh GHN.";
            set({ isLoadingProvinces: false, error: message });
            return { success: false, error: message };
        }
    },
    loadDistricts: async (provinceId) => {
        const key = String(provinceId);
        const cached = get().districtsByProvince[key];
        if (cached?.length) {
            return { success: true, data: cached };
        }
        set({ isLoadingDistricts: true, error: null });
        try {
            const response = await apiRequest(`/shipping/ghn/districts?province_id=${encodeURIComponent(provinceId)}`);
            set((state) => ({
                districtsByProvince: {
                    ...state.districtsByProvince,
                    [key]: response.data,
                },
                isLoadingDistricts: false,
                error: null,
            }));
            return { success: true, data: response.data };
        }
        catch (error) {
            const message = error instanceof Error ? error.message : "Khong the tai quan/huyen GHN.";
            set({ isLoadingDistricts: false, error: message });
            return { success: false, error: message };
        }
    },
    loadWards: async (districtId) => {
        const key = String(districtId);
        const cached = get().wardsByDistrict[key];
        if (cached?.length) {
            return { success: true, data: cached };
        }
        set({ isLoadingWards: true, error: null });
        try {
            const response = await apiRequest(`/shipping/ghn/wards?district_id=${encodeURIComponent(districtId)}`);
            set((state) => ({
                wardsByDistrict: {
                    ...state.wardsByDistrict,
                    [key]: response.data,
                },
                isLoadingWards: false,
                error: null,
            }));
            return { success: true, data: response.data };
        }
        catch (error) {
            const message = error instanceof Error ? error.message : "Khong the tai phuong/xa GHN.";
            set({ isLoadingWards: false, error: message });
            return { success: false, error: message };
        }
    },
    reset: () => set(initialState),
}));
