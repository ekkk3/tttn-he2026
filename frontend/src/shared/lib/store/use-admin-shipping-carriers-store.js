import { create } from "zustand";
import { apiRequest, isUnauthorizedApiError } from "@/shared/api/backend-client";
import { useAuthStore } from "@/shared/lib/store/use-auth-store";
import { registerProtectedSessionCleanup } from "@/shared/lib/store/protected-session";
const initialState = {
    carriers: [],
    isLoading: false,
    isSaving: false,
    error: null,
};
const SESSION_EXPIRED_MESSAGE = "Phien dang nhap da het han. Vui long dang nhap lai.";
function token() {
    return useAuthStore.getState().accessToken;
}
function listPath(options) {
    const params = new URLSearchParams();
    params.set("per_page", "100");
    if (options?.activeOnly) {
        params.set("active_only", "1");
    }
    return `/admin/shipping-carriers?${params.toString()}`;
}
export const useAdminShippingCarriersStore = create()((set) => ({
    ...initialState,
    loadCarriers: async (options) => {
        const accessToken = token();
        if (!accessToken) {
            return { success: false, error: "Ban can dang nhap admin de tai don vi van chuyen." };
        }
        set({ isLoading: true, error: null });
        try {
            const response = await apiRequest(listPath(options), {
                token: accessToken,
            });
            set({
                carriers: response.data,
                isLoading: false,
                error: null,
            });
            return { success: true, data: response.data };
        }
        catch (error) {
            if (isUnauthorizedApiError(error)) {
                useAuthStore.getState().clearSession();
                set({ isLoading: false, error: SESSION_EXPIRED_MESSAGE });
                return { success: false, error: SESSION_EXPIRED_MESSAGE };
            }
            const message = error instanceof Error ? error.message : "Khong the tai don vi van chuyen.";
            set({ isLoading: false, error: message });
            return { success: false, error: message };
        }
    },
    createCarrier: async (payload) => {
        const accessToken = token();
        if (!accessToken) {
            return { success: false, error: "Ban can dang nhap admin de tao don vi van chuyen." };
        }
        set({ isSaving: true, error: null });
        try {
            const response = await apiRequest("/admin/shipping-carriers", {
                method: "POST",
                token: accessToken,
                body: payload,
            });
            set((state) => ({
                carriers: [response.data, ...state.carriers],
                isSaving: false,
                error: null,
            }));
            return { success: true, data: response.data };
        }
        catch (error) {
            if (isUnauthorizedApiError(error)) {
                useAuthStore.getState().clearSession();
                set({ isSaving: false, error: SESSION_EXPIRED_MESSAGE });
                return { success: false, error: SESSION_EXPIRED_MESSAGE };
            }
            const message = error instanceof Error ? error.message : "Khong the tao don vi van chuyen.";
            set({ isSaving: false, error: message });
            return { success: false, error: message };
        }
    },
    updateCarrier: async (carrierId, payload) => {
        const accessToken = token();
        if (!accessToken) {
            return { success: false, error: "Ban can dang nhap admin de cap nhat don vi van chuyen." };
        }
        set({ isSaving: true, error: null });
        try {
            const response = await apiRequest(`/admin/shipping-carriers/${carrierId}`, {
                method: "PUT",
                token: accessToken,
                body: payload,
            });
            set((state) => ({
                carriers: state.carriers.map((carrier) => (carrier.id === carrierId ? response.data : carrier)),
                isSaving: false,
                error: null,
            }));
            return { success: true, data: response.data };
        }
        catch (error) {
            if (isUnauthorizedApiError(error)) {
                useAuthStore.getState().clearSession();
                set({ isSaving: false, error: SESSION_EXPIRED_MESSAGE });
                return { success: false, error: SESSION_EXPIRED_MESSAGE };
            }
            const message = error instanceof Error ? error.message : "Khong the cap nhat don vi van chuyen.";
            set({ isSaving: false, error: message });
            return { success: false, error: message };
        }
    },
    deleteCarrier: async (carrierId) => {
        const accessToken = token();
        if (!accessToken) {
            return { success: false, error: "Ban can dang nhap admin de an don vi van chuyen." };
        }
        set({ isSaving: true, error: null });
        try {
            const response = await apiRequest(`/admin/shipping-carriers/${carrierId}`, {
                method: "DELETE",
                token: accessToken,
            });
            set((state) => ({
                carriers: state.carriers.map((carrier) => (carrier.id === carrierId ? response.data : carrier)),
                isSaving: false,
                error: null,
            }));
            return { success: true, data: response.data };
        }
        catch (error) {
            if (isUnauthorizedApiError(error)) {
                useAuthStore.getState().clearSession();
                set({ isSaving: false, error: SESSION_EXPIRED_MESSAGE });
                return { success: false, error: SESSION_EXPIRED_MESSAGE };
            }
            const message = error instanceof Error ? error.message : "Khong the an don vi van chuyen.";
            set({ isSaving: false, error: message });
            return { success: false, error: message };
        }
    },
    reset: () => set(initialState),
}));
registerProtectedSessionCleanup(() => {
    useAdminShippingCarriersStore.getState().reset();
});
