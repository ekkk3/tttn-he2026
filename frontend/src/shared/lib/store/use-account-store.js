import { create } from "zustand";
import { apiRequest, isUnauthorizedApiError } from "@/shared/api/backend-client";
import { adaptBackendAccountProfile, adaptBackendComplaint, adaptBackendNotification, adaptBackendRewardSnapshot, } from "@/shared/api/storefront-adapters";
import { useAuthStore } from "@/shared/lib/store/use-auth-store";
import { registerProtectedSessionCleanup } from "@/shared/lib/store/protected-session";
function emptyProfile() {
    return {
        id: "",
        name: "",
        email: "",
        phone: "",
        address: "",
        city: "",
        favoriteRegion: "",
        avatar: "",
        memberSince: "",
        newsletter: false,
        smsAlerts: false,
        orderEmail: false,
        securityAlerts: false,
        addresses: [],
        rewardHistory: [],
    };
}
function emptyRewardSnapshot() {
    return {
        tier: "",
        points: 0,
        nextTierPoints: 0,
        perks: [],
    };
}
const initialState = {
    profile: emptyProfile(),
    rewardSnapshot: emptyRewardSnapshot(),
    notifications: [],
    complaints: [],
    isLoading: false,
    isSaving: false,
    isNotificationsLoading: false,
    isComplaintsLoading: false,
    error: null,
};
const SESSION_EXPIRED_MESSAGE = "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
function authState() {
    return useAuthStore.getState();
}
function customerToken() {
    const state = authState();
    if (state.authSource !== "backend" || state.session?.user.role !== "customer") {
        return null;
    }
    return state.accessToken;
}
function profilePayload(profile) {
    return {
        name: profile.name.trim(),
        phone: profile.phone.trim(),
        address: profile.address.trim(),
        city: profile.city.trim(),
        favorite_region: profile.favoriteRegion.trim(),
        avatar: profile.avatar.trim() || null,
        newsletter: profile.newsletter,
        sms_alerts: profile.smsAlerts,
        order_email: profile.orderEmail,
        security_alerts: profile.securityAlerts,
    };
}
function addressPayload(input) {
    return {
        label: input.label.trim(),
        recipient: input.recipient.trim(),
        phone: input.phone.trim(),
        line1: input.line1.trim(),
        city: input.city.trim(),
        ghn_province_id: input.ghnProvinceId ?? null,
        ghn_province_name: input.ghnProvinceName?.trim() || null,
        ghn_district_id: input.ghnDistrictId ?? null,
        ghn_district_name: input.ghnDistrictName?.trim() || null,
        ghn_ward_code: input.ghnWardCode?.trim() || null,
        ghn_ward_name: input.ghnWardName?.trim() || null,
        note: input.note?.trim() || null,
    };
}
function syncProfileResponse(set, response) {
    const profile = adaptBackendAccountProfile(response.data);
    const rewardSnapshot = adaptBackendRewardSnapshot(response.data.reward_snapshot);
    set({
        profile,
        rewardSnapshot,
        error: null,
    });
    return {
        profile,
        rewardSnapshot,
    };
}
export const useAccountStore = create()((set, get) => ({
    ...initialState,
    updateProfile: (updates) => set((state) => ({
        profile: {
            ...state.profile,
            ...updates,
        },
    })),
    loadProfile: async () => {
        const token = customerToken();
        if (!token) {
            return {
                success: false,
                error: "Bạn cần đăng nhập lại để xem thông tin tài khoản.",
            };
        }
        set({ isLoading: true, error: null });
        try {
            const response = await apiRequest("/account/profile", {
                token,
            });
            const { profile } = syncProfileResponse(set, response);
            set({ isLoading: false });
            return {
                success: true,
                data: profile,
            };
        }
        catch (error) {
            if (isUnauthorizedApiError(error)) {
                useAuthStore.getState().clearSession();
                set({ isLoading: false, error: SESSION_EXPIRED_MESSAGE });
                return { success: false, error: SESSION_EXPIRED_MESSAGE };
            }
            const message = error instanceof Error ? error.message : "Không thể tải thông tin tài khoản.";
            set({ isLoading: false, error: message });
            return { success: false, error: message };
        }
    },
    saveProfile: async (updates) => {
        const token = customerToken();
        if (!token) {
            return {
                success: false,
                error: "Bạn cần đăng nhập lại để cập nhật tài khoản.",
            };
        }
        const nextProfile = {
            ...get().profile,
            ...updates,
        };
        set({ isSaving: true, error: null });
        try {
            const response = await apiRequest("/account/profile", {
                method: "PUT",
                token,
                body: profilePayload(nextProfile),
            });
            const { profile } = syncProfileResponse(set, response);
            set({ isSaving: false });
            return {
                success: true,
                data: profile,
            };
        }
        catch (error) {
            if (isUnauthorizedApiError(error)) {
                useAuthStore.getState().clearSession();
                set({ isSaving: false, error: SESSION_EXPIRED_MESSAGE });
                return { success: false, error: SESSION_EXPIRED_MESSAGE };
            }
            const message = error instanceof Error ? error.message : "Không thể cập nhật tài khoản.";
            set({ isSaving: false, error: message });
            return { success: false, error: message };
        }
    },
    updateAvatar: (avatar) => get().saveProfile({ avatar }),
    removeAvatar: () => get().saveProfile({ avatar: "" }),
    addAddress: async (input) => {
        const token = customerToken();
        if (!token) {
            return { success: false, error: "Bạn cần đăng nhập lại để lưu địa chỉ." };
        }
        set({ isSaving: true, error: null });
        try {
            const response = await apiRequest("/account/addresses", {
                method: "POST",
                token,
                body: addressPayload(input),
            });
            const { profile } = syncProfileResponse(set, response);
            set({ isSaving: false });
            return { success: true, data: profile };
        }
        catch (error) {
            if (isUnauthorizedApiError(error)) {
                useAuthStore.getState().clearSession();
                set({ isSaving: false, error: SESSION_EXPIRED_MESSAGE });
                return { success: false, error: SESSION_EXPIRED_MESSAGE };
            }
            const message = error instanceof Error ? error.message : "Không thể thêm địa chỉ.";
            set({ isSaving: false, error: message });
            return { success: false, error: message };
        }
    },
    updateAddress: async (addressId, input) => {
        const token = customerToken();
        if (!token) {
            return { success: false, error: "Bạn cần đăng nhập lại để cập nhật địa chỉ." };
        }
        set({ isSaving: true, error: null });
        try {
            const response = await apiRequest(`/account/addresses/${addressId}`, {
                method: "PUT",
                token,
                body: addressPayload(input),
            });
            const { profile } = syncProfileResponse(set, response);
            set({ isSaving: false });
            return { success: true, data: profile };
        }
        catch (error) {
            if (isUnauthorizedApiError(error)) {
                useAuthStore.getState().clearSession();
                set({ isSaving: false, error: SESSION_EXPIRED_MESSAGE });
                return { success: false, error: SESSION_EXPIRED_MESSAGE };
            }
            const message = error instanceof Error ? error.message : "Không thể cập nhật địa chỉ.";
            set({ isSaving: false, error: message });
            return { success: false, error: message };
        }
    },
    removeAddress: async (addressId) => {
        const token = customerToken();
        if (!token) {
            return { success: false, error: "Bạn cần đăng nhập lại để xóa địa chỉ." };
        }
        set({ isSaving: true, error: null });
        try {
            const response = await apiRequest(`/account/addresses/${addressId}`, {
                method: "DELETE",
                token,
            });
            const { profile } = syncProfileResponse(set, response);
            set({ isSaving: false });
            return { success: true, data: profile };
        }
        catch (error) {
            if (isUnauthorizedApiError(error)) {
                useAuthStore.getState().clearSession();
                set({ isSaving: false, error: SESSION_EXPIRED_MESSAGE });
                return { success: false, error: SESSION_EXPIRED_MESSAGE };
            }
            const message = error instanceof Error ? error.message : "Không thể xóa địa chỉ.";
            set({ isSaving: false, error: message });
            return { success: false, error: message };
        }
    },
    setDefaultAddress: async (addressId) => {
        const token = customerToken();
        if (!token) {
            return { success: false, error: "Bạn cần đăng nhập lại để đặt địa chỉ mặc định." };
        }
        set({ isSaving: true, error: null });
        try {
            const response = await apiRequest(`/account/addresses/${addressId}/default`, {
                method: "PATCH",
                token,
            });
            const { profile } = syncProfileResponse(set, response);
            set({ isSaving: false });
            return { success: true, data: profile };
        }
        catch (error) {
            if (isUnauthorizedApiError(error)) {
                useAuthStore.getState().clearSession();
                set({ isSaving: false, error: SESSION_EXPIRED_MESSAGE });
                return { success: false, error: SESSION_EXPIRED_MESSAGE };
            }
            const message = error instanceof Error ? error.message : "Không thể cập nhật địa chỉ mặc định.";
            set({ isSaving: false, error: message });
            return { success: false, error: message };
        }
    },
    changePassword: async (currentPassword, nextPassword, confirmPassword) => {
        const token = customerToken();
        if (!token) {
            return { success: false, error: "Bạn cần đăng nhập lại để đổi mật khẩu." };
        }
        set({ isSaving: true, error: null });
        try {
            await apiRequest("/account/password", {
                method: "PATCH",
                token,
                body: {
                    current_password: currentPassword,
                    new_password: nextPassword,
                    new_password_confirmation: confirmPassword,
                },
            });
            set({ isSaving: false });
            return { success: true };
        }
        catch (error) {
            if (isUnauthorizedApiError(error)) {
                useAuthStore.getState().clearSession();
                set({ isSaving: false, error: SESSION_EXPIRED_MESSAGE });
                return { success: false, error: SESSION_EXPIRED_MESSAGE };
            }
            const message = error instanceof Error ? error.message : "Không thể đổi mật khẩu lúc này.";
            set({ isSaving: false, error: message });
            return { success: false, error: message };
        }
    },
    redeemReward: async (title, pointsCost) => {
        const token = customerToken();
        if (!token) {
            return { success: false, error: "Bạn cần đăng nhập lại để đổi thưởng." };
        }
        set({ isSaving: true, error: null });
        try {
            const response = await apiRequest("/account/rewards/redeem", {
                method: "POST",
                token,
                body: {
                    title,
                    points_cost: pointsCost,
                },
            });
            const { profile } = syncProfileResponse(set, response);
            set({ isSaving: false });
            return { success: true, data: profile };
        }
        catch (error) {
            if (isUnauthorizedApiError(error)) {
                useAuthStore.getState().clearSession();
                set({ isSaving: false, error: SESSION_EXPIRED_MESSAGE });
                return { success: false, error: SESSION_EXPIRED_MESSAGE };
            }
            const message = error instanceof Error ? error.message : "Không thể đổi thưởng.";
            set({ isSaving: false, error: message });
            return { success: false, error: message };
        }
    },
    loadNotifications: async () => {
        const token = customerToken();
        if (!token) {
            return { success: false, error: "Bạn cần đăng nhập lại để xem thông báo." };
        }
        set({ isNotificationsLoading: true, error: null });
        try {
            const response = await apiRequest("/notifications", {
                token,
            });
            const notifications = response.data.map(adaptBackendNotification);
            set({
                notifications,
                isNotificationsLoading: false,
            });
            return { success: true, data: notifications };
        }
        catch (error) {
            if (isUnauthorizedApiError(error)) {
                useAuthStore.getState().clearSession();
                set({ isNotificationsLoading: false, error: SESSION_EXPIRED_MESSAGE });
                return { success: false, error: SESSION_EXPIRED_MESSAGE };
            }
            const message = error instanceof Error ? error.message : "Không thể tải thông báo.";
            set({ isNotificationsLoading: false, error: message });
            return { success: false, error: message };
        }
    },
    markNotificationRead: async (notificationId) => {
        const token = customerToken();
        if (!token) {
            return { success: false, error: "Bạn cần đăng nhập lại để cập nhật thông báo." };
        }
        try {
            const response = await apiRequest(`/notifications/${notificationId}/read`, {
                method: "PATCH",
                token,
            });
            const notification = adaptBackendNotification(response.data);
            set((state) => ({
                notifications: state.notifications.map((item) => item.id === notification.id ? notification : item),
                error: null,
            }));
            return { success: true, data: notification };
        }
        catch (error) {
            if (isUnauthorizedApiError(error)) {
                useAuthStore.getState().clearSession();
                set({ error: SESSION_EXPIRED_MESSAGE });
                return { success: false, error: SESSION_EXPIRED_MESSAGE };
            }
            const message = error instanceof Error ? error.message : "Không thể cập nhật thông báo.";
            set({ error: message });
            return { success: false, error: message };
        }
    },
    loadComplaints: async () => {
        const token = customerToken();
        if (!token) {
            return { success: false, error: "Bạn cần đăng nhập lại để xem khiếu nại." };
        }
        set({ isComplaintsLoading: true, error: null });
        try {
            const response = await apiRequest("/complaints", {
                token,
            });
            const complaints = response.data.map(adaptBackendComplaint);
            set({
                complaints,
                isComplaintsLoading: false,
            });
            return { success: true, data: complaints };
        }
        catch (error) {
            if (isUnauthorizedApiError(error)) {
                useAuthStore.getState().clearSession();
                set({ isComplaintsLoading: false, error: SESSION_EXPIRED_MESSAGE });
                return { success: false, error: SESSION_EXPIRED_MESSAGE };
            }
            const message = error instanceof Error ? error.message : "Không thể tải khiếu nại.";
            set({ isComplaintsLoading: false, error: message });
            return { success: false, error: message };
        }
    },
    createComplaint: async (input) => {
        const token = customerToken();
        if (!token) {
            return { success: false, error: "Bạn cần đăng nhập lại để gửi khiếu nại." };
        }
        try {
            const response = await apiRequest("/complaints", {
                method: "POST",
                token,
                body: {
                    order_id: Number(input.orderId),
                    product_id: Number(input.productId),
                    reason: input.reason.trim(),
                    content: input.content.trim(),
                    image_url: input.imageUrl?.trim() || null,
                },
            });
            const complaint = adaptBackendComplaint(response.data);
            set((state) => ({
                complaints: [complaint, ...state.complaints],
                error: null,
            }));
            return { success: true, data: complaint };
        }
        catch (error) {
            if (isUnauthorizedApiError(error)) {
                useAuthStore.getState().clearSession();
                set({ error: SESSION_EXPIRED_MESSAGE });
                return { success: false, error: SESSION_EXPIRED_MESSAGE };
            }
            const message = error instanceof Error ? error.message : "Không thể gửi khiếu nại.";
            set({ error: message });
            return { success: false, error: message };
        }
    },
    reset: () => set(initialState),
}));
registerProtectedSessionCleanup(() => {
    useAccountStore.getState().reset();
});
