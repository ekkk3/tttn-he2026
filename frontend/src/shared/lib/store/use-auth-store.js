import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { apiRequest, isUnauthorizedApiError } from "@/shared/api/backend-client";
import { adaptBackendUserToSession } from "@/shared/api/storefront-adapters";
import { routes } from "@/shared/config/routes";
import { useAccountStore } from "@/shared/lib/store/use-account-store";
import { runProtectedSessionCleanup } from "@/shared/lib/store/protected-session";
import { useShopStore } from "@/shared/lib/store/use-shop-store";
const seedCredentials = [
    {
        id: "seed-admin",
        role: "admin",
        displayName: "Admin Heritage Harvest",
        email: "admin@shop.local",
        password: "password123",
        redirectTo: routes.adminDashboard,
    },
    {
        id: "seed-supplier",
        role: "supplier",
        displayName: "Nha cung cap",
        email: "supplieruser@shop.local",
        password: "password123",
        redirectTo: routes.supplierOrders,
    },
    {
        id: "seed-warehouse",
        role: "warehouse",
        displayName: "Nhan vien kho",
        email: "warehouse@shop.local",
        password: "password123",
        redirectTo: routes.warehouseInventory,
    },
    {
        id: "seed-customer",
        role: "customer",
        displayName: "Khach hang",
        email: "customer1@shop.local",
        password: "password123",
        redirectTo: routes.accountProfile,
    },
];
function isExpired(expiresAt) {
    if (!expiresAt)
        return false;
    return Date.parse(expiresAt) <= Date.now();
}
const initialState = {
    credentials: seedCredentials,
    session: null,
    accessToken: null,
    accessTokenExpiresAt: null,
    authSource: null,
    isHydrating: false,
    isSubmitting: false,
};
function clearAuthState(set) {
    set({
        session: null,
        accessToken: null,
        accessTokenExpiresAt: null,
        authSource: null,
        isHydrating: false,
        isSubmitting: false,
    });
    runProtectedSessionCleanup();
}
async function applyAuthenticatedBackendSession(response, set) {
    const session = adaptBackendUserToSession(response.user);
    if (!session) {
        set({ isSubmitting: false });
        return {
            success: false,
            error: "Không thể xử lý thông tin tài khoản. Vui lòng thử lại.",
        };
    }
    set({
        session,
        accessToken: response.access_token,
        accessTokenExpiresAt: response.expires_at ?? null,
        authSource: "backend",
        isSubmitting: false,
    });
    if (session.user.role === "customer") {
        await useAccountStore.getState().loadProfile();
        await useShopStore.getState().loadWishlist();
    }
    return { success: true };
}
export function redirectForRole(role) {
    if (role === "customer")
        return routes.accountProfile;
    if (role === "admin")
        return routes.adminDashboard;
    if (role === "supplier")
        return routes.supplierOrders;
    if (role === "warehouse")
        return routes.warehouseInventory;
    return routes.home;
}
export const useAuthStore = create()(persist((set, get) => ({
    ...initialState,
    login: async (email, password) => {
        set({ isSubmitting: true });
        try {
            const response = await apiRequest("/login", {
                method: "POST",
                body: {
                    email: email.trim(),
                    password,
                },
            });
            return await applyAuthenticatedBackendSession(response, set);
        }
        catch (error) {
            set({ isSubmitting: false });
            return {
                success: false,
                error: error instanceof Error
                    ? error.message
                    : "Không thể đăng nhập. Vui lòng kiểm tra email và mật khẩu.",
            };
        }
    },
    register: async (payload) => {
        set({ isSubmitting: true });
        try {
            const response = await apiRequest("/register", {
                method: "POST",
                body: {
                    full_name: payload.fullName.trim(),
                    email: payload.email.trim(),
                    phone: payload.phone.trim(),
                    password: payload.password,
                    password_confirmation: payload.passwordConfirmation,
                },
            });
            return await applyAuthenticatedBackendSession(response, set);
        }
        catch (error) {
            set({ isSubmitting: false });
            return {
                success: false,
                error: error instanceof Error
                    ? error.message
                    : "Không thể đăng ký tài khoản lúc này. Vui lòng thử lại.",
            };
        }
    },
    logout: async () => {
        const currentToken = get().accessToken;
        const authSource = get().authSource;
        if (authSource === "backend" && isExpired(get().accessTokenExpiresAt)) {
            clearAuthState(set);
            return;
        }
        if (authSource === "backend" && currentToken) {
            try {
                await apiRequest("/logout", {
                    method: "POST",
                    token: currentToken,
                });
            }
            catch {
            }
        }
        clearAuthState(set);
    },
    changePassword: (currentPassword, nextPassword) => {
        const session = get().session;
        if (!session) {
            return { success: false, error: "Bạn cần đăng nhập trước." };
        }
        void currentPassword;
        if (nextPassword.trim().length < 6) {
            return {
                success: false,
                error: "Mật khẩu mới phải có ít nhất 6 ký tự.",
            };
        }
        return {
            success: false,
            error: "Vui lòng đổi mật khẩu qua API tài khoản.",
        };
    },
    hydrateSession: async () => {
        const currentToken = get().accessToken;
        const authSource = get().authSource;
        if (authSource === "backend" && isExpired(get().accessTokenExpiresAt)) {
            clearAuthState(set);
            return;
        }
        if (!currentToken || authSource !== "backend") {
            set({ isHydrating: false });
            return;
        }
        set({ isHydrating: true });
        try {
            const response = await apiRequest("/me", {
                token: currentToken,
            });
            const session = adaptBackendUserToSession(response.user);
            if (!session) {
                clearAuthState(set);
                return;
            }
            set({
                session,
                accessTokenExpiresAt: response.expires_at ?? get().accessTokenExpiresAt,
                authSource: "backend",
                isHydrating: false,
            });
            if (session.user.role === "customer") {
                await useAccountStore.getState().loadProfile();
                await useShopStore.getState().loadWishlist();
            }
        }
        catch (error) {
            if (isUnauthorizedApiError(error)) {
                clearAuthState(set);
                return;
            }
            set({ isHydrating: false });
        }
    },
    clearSession: () => clearAuthState(set),
    reset: () => set(initialState),
}), {
    name: "heritage-auth-store",
    storage: createJSONStorage(() => localStorage),
    partialize: (state) => ({
        session: state.session,
        accessToken: state.accessToken,
        accessTokenExpiresAt: state.accessTokenExpiresAt,
        authSource: state.authSource,
    }),
}));
