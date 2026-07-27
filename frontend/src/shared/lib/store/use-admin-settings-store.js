import { create } from "zustand";
import { apiRequest, isUnauthorizedApiError } from "@/shared/api/backend-client";
import { useAuthStore } from "@/shared/lib/store/use-auth-store";
import { registerProtectedSessionCleanup } from "@/shared/lib/store/protected-session";
const initialSettings = {
    storeName: "Heritage Harvest",
    supportEmail: "",
    supportPhone: "",
    lowStockThreshold: 5,
    dashboardRefreshSeconds: 60,
    orderAutoConfirm: false,
    sendDailySummary: true,
    maintenanceMode: false,
    notes: "",
    updatedAt: null,
};
const SESSION_EXPIRED_MESSAGE = "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
// Backend trả snake_case (store_name, low_stock_threshold...) — chuyển sang camelCase
// để khớp quy ước đặt tên phía frontend trước khi đưa vào state.
function adaptSettings(settings) {
    return {
        storeName: settings.store_name,
        supportEmail: settings.support_email ?? "",
        supportPhone: settings.support_phone ?? "",
        lowStockThreshold: settings.low_stock_threshold,
        dashboardRefreshSeconds: settings.dashboard_refresh_seconds,
        orderAutoConfirm: settings.order_auto_confirm,
        sendDailySummary: settings.send_daily_summary,
        maintenanceMode: settings.maintenance_mode,
        notes: settings.notes ?? "",
        updatedAt: settings.updated_at,
    };
}
export const useAdminSettingsStore = create()((set) => ({
    settings: initialSettings,
    isLoading: false,
    isSaving: false,
    error: null,
    loadSettings: async () => {
        const token = useAuthStore.getState().accessToken;
        if (!token) {
            return {
                success: false,
                error: "Bạn cần đăng nhập admin để tải cấu hình.",
            };
        }
        set({
            isLoading: true,
            error: null,
        });
        try {
            const response = await apiRequest("/admin/settings", {
                token,
            });
            const settings = adaptSettings(response.data);
            set({
                settings,
                isLoading: false,
                error: null,
            });
            return {
                success: true,
                data: settings,
            };
        }
        catch (error) {
            if (isUnauthorizedApiError(error)) {
                useAuthStore.getState().clearSession();
                return {
                    success: false,
                    error: SESSION_EXPIRED_MESSAGE,
                };
            }
            const message = error instanceof Error ? error.message : "Không thể tải cấu hình admin.";
            set({
                isLoading: false,
                error: message,
            });
            return {
                success: false,
                error: message,
            };
        }
    },
    saveSettings: async (payload) => {
        const token = useAuthStore.getState().accessToken;
        if (!token) {
            return {
                success: false,
                error: "Bạn cần đăng nhập admin để lưu cấu hình.",
            };
        }
        set({
            isSaving: true,
            error: null,
        });
        try {
            const response = await apiRequest("/admin/settings", {
                method: "PUT",
                token,
                body: {
                    store_name: payload.storeName.trim(),
                    support_email: payload.supportEmail.trim() || null,
                    support_phone: payload.supportPhone.trim() || null,
                    low_stock_threshold: payload.lowStockThreshold,
                    dashboard_refresh_seconds: payload.dashboardRefreshSeconds,
                    order_auto_confirm: payload.orderAutoConfirm,
                    send_daily_summary: payload.sendDailySummary,
                    maintenance_mode: payload.maintenanceMode,
                    notes: payload.notes.trim() || null,
                },
            });
            const settings = adaptSettings(response.data);
            set({
                settings,
                isSaving: false,
                error: null,
            });
            return {
                success: true,
                data: settings,
            };
        }
        catch (error) {
            if (isUnauthorizedApiError(error)) {
                useAuthStore.getState().clearSession();
                return {
                    success: false,
                    error: SESSION_EXPIRED_MESSAGE,
                };
            }
            const message = error instanceof Error ? error.message : "Không thể lưu cấu hình admin.";
            set({
                isSaving: false,
                error: message,
            });
            return {
                success: false,
                error: message,
            };
        }
    },
    reset: () => set({
        settings: initialSettings,
        isLoading: false,
        isSaving: false,
        error: null,
    }),
}));
registerProtectedSessionCleanup(() => {
    useAdminSettingsStore.getState().reset();
});
