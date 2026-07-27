import { create } from "zustand";
import { apiRequest, isUnauthorizedApiError } from "@/shared/api/backend-client";
import { registerProtectedSessionCleanup } from "@/shared/lib/store/protected-session";
import { useAuthStore } from "@/shared/lib/store/use-auth-store";

const SESSION_EXPIRED_MESSAGE = "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";

const initialState = {
    admins: [],
    isLoading: false,
    isSaving: false,
    error: null,
};

function token() {
    return useAuthStore.getState().accessToken;
}

// Cập nhật lạc quan (optimistic): thay/thêm admin vào ĐẦU danh sách ngay khi API trả về,
// để UI phản hồi tức thì — dù ngay sau đó saveAdmin()/updateAdminStatus() vẫn gọi thêm
// loadAdmins() để đồng bộ lại thứ tự/dữ liệu chính xác từ server.
function upsertAdmin(admins, nextAdmin) {
    const remaining = admins.filter((admin) => admin.id !== nextAdmin.id);
    return [nextAdmin, ...remaining];
}

export const useAdminAdminsStore = create()((set, get) => ({
    ...initialState,
    loadAdmins: async () => {
        const accessToken = token();
        if (!accessToken) {
            return { success: false, error: "Bạn cần đăng nhập admin để tải danh sách admin." };
        }

        set({ isLoading: true, error: null });

        try {
            const response = await apiRequest("/admin/admins?per_page=200", {
                token: accessToken,
            });

            set({
                admins: response.data,
                isLoading: false,
                error: null,
            });

            return { success: true };
        }
        catch (error) {
            if (isUnauthorizedApiError(error)) {
                useAuthStore.getState().clearSession();
                return { success: false, error: SESSION_EXPIRED_MESSAGE };
            }

            const message = error instanceof Error ? error.message : "Không thể tải danh sách admin.";
            set({ isLoading: false, error: message });
            return { success: false, error: message };
        }
    },
    saveAdmin: async (payload) => {
        const accessToken = token();
        if (!accessToken) {
            return { success: false, error: "Bạn cần đăng nhập admin để lưu tài khoản admin." };
        }

        set({ isSaving: true, error: null });

        try {
            const body = {
                full_name: payload.fullName.trim(),
                email: payload.email.trim(),
                phone: payload.phone.trim(),
                is_active: payload.isActive,
                is_deleted: false,
            };

            // Tạo mới (!payload.id) luôn cần password; sửa admin có sẵn thì chỉ gửi password
            // khi người dùng thực sự nhập gì đó — bỏ trống nghĩa là giữ nguyên mật khẩu cũ.
            if (!payload.id || payload.password.trim()) {
                body.password = payload.password;
            }

            const response = await apiRequest(payload.id ? `/admin/admins/${payload.id}` : "/admin/admins", {
                method: payload.id ? "PUT" : "POST",
                token: accessToken,
                body,
            });

            set((state) => ({
                admins: upsertAdmin(state.admins, response.data),
                isSaving: false,
                error: null,
            }));

            await get().loadAdmins();

            return { success: true, data: response.data };
        }
        catch (error) {
            if (isUnauthorizedApiError(error)) {
                useAuthStore.getState().clearSession();
                return { success: false, error: SESSION_EXPIRED_MESSAGE };
            }

            const message = error instanceof Error ? error.message : "Không thể lưu tài khoản admin.";
            set({ isSaving: false, error: message });
            return { success: false, error: message };
        }
    },
    updateAdminStatus: async (adminId, isActive) => {
        const accessToken = token();
        if (!accessToken) {
            return { success: false, error: "Bạn cần đăng nhập admin để cập nhật trạng thái." };
        }

        set({ isSaving: true, error: null });

        try {
            const response = await apiRequest(`/admin/admins/${adminId}/status`, {
                method: "PATCH",
                token: accessToken,
                body: {
                    is_active: isActive,
                    ...(isActive ? { is_deleted: false } : { is_deleted: true }),
                },
            });

            set((state) => ({
                admins: upsertAdmin(state.admins, response.data),
                isSaving: false,
                error: null,
            }));

            await get().loadAdmins();

            return { success: true, data: response.data };
        }
        catch (error) {
            if (isUnauthorizedApiError(error)) {
                useAuthStore.getState().clearSession();
                return { success: false, error: SESSION_EXPIRED_MESSAGE };
            }

            const message = error instanceof Error ? error.message : "Không thể cập nhật trạng thái admin.";
            set({ isSaving: false, error: message });
            return { success: false, error: message };
        }
    },
    updateAdminPassword: async (adminId, password) => {
        const accessToken = token();
        if (!accessToken) {
            return { success: false, error: "Bạn cần đăng nhập admin để đổi mật khẩu." };
        }

        set({ isSaving: true, error: null });

        try {
            await apiRequest(`/admin/admins/${adminId}/password`, {
                method: "PATCH",
                token: accessToken,
                body: { password },
            });

            set({ isSaving: false, error: null });
            return { success: true };
        }
        catch (error) {
            if (isUnauthorizedApiError(error)) {
                useAuthStore.getState().clearSession();
                return { success: false, error: SESSION_EXPIRED_MESSAGE };
            }

            const message = error instanceof Error ? error.message : "Không thể đổi mật khẩu admin.";
            set({ isSaving: false, error: message });
            return { success: false, error: message };
        }
    },
    reset: () => set(initialState),
}));

registerProtectedSessionCleanup(() => {
    useAdminAdminsStore.getState().reset();
});
