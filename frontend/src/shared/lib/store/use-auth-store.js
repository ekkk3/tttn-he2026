import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { apiRequest, isUnauthorizedApiError } from "@/shared/api/backend-client";
import { adaptBackendUserToSession } from "@/shared/api/storefront-adapters";
import { routes } from "@/shared/config/routes";
import { useAccountStore } from "@/shared/lib/store/use-account-store";
import { runProtectedSessionCleanup } from "@/shared/lib/store/protected-session";
import { useShopStore } from "@/shared/lib/store/use-shop-store";
// Store Zustand quản lý phiên đăng nhập, dùng middleware `persist` để tự lưu vào
// localStorage (xem cấu hình persist() ở cuối file) — refresh trang vẫn còn đăng nhập.
// Danh sách tài khoản demo hiển thị trên trang login (chỉ để gợi ý nhanh vai trò/redirect
// đích tương ứng) — việc đăng nhập THẬT vẫn luôn đi qua API backend (/login) bên dưới,
// mảng này không tự xác thực offline.
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
        displayName: "Nhà cung cấp",
        email: "supplieruser@shop.local",
        password: "password123",
        redirectTo: routes.supplierOrders,
    },
    {
        id: "seed-warehouse",
        role: "warehouse",
        displayName: "Nhân viên kho",
        email: "warehouse@shop.local",
        password: "password123",
        redirectTo: routes.warehouseInventory,
    },
    {
        id: "seed-customer",
        role: "customer",
        displayName: "Khách hàng",
        email: "customer1@shop.local",
        password: "password123",
        redirectTo: routes.accountProfile,
    },
];
// Không có expiresAt (vd chưa đăng nhập) coi như "chưa hết hạn" — để các nơi gọi hàm
// này không tự ý đăng xuất khi chưa có đủ thông tin để kết luận.
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
// Dùng chung cho logout() và mọi trường hợp phiên không còn hợp lệ (hết hạn, 401 từ
// server...): xóa sạch state đăng nhập + dọn thêm dữ liệu "nhạy cảm" ở các store khác
// (giỏ hàng, thông tin tài khoản...) qua runProtectedSessionCleanup().
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
// Dùng chung cho login() và register() — cả 2 đều nhận cùng shape response từ backend
// (user + access_token + expires_at) nên xử lý sau khi xác thực thành công là như nhau.
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
    // Chỉ khách hàng (customer) mới có profile/wishlist riêng cần tải ngay sau khi đăng
    // nhập — admin/supplier/warehouse dùng các store dữ liệu khác.
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
// Mọi action bên dưới trả về shape { success, error? } thống nhất (thay vì throw) để
// component gọi (login-page.jsx...) hiển thị lỗi trực tiếp mà không cần try/catch riêng.
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
        // Token đã hết hạn thì gọi API logout cũng vô nghĩa (server sẽ từ chối) -> dọn state
        // ngay tại chỗ, khỏi cần round-trip mạng.
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
                // JWT là stateless (xem backend/utils/jwt.js) — server không có gì để hủy,
                // nên dù request logout lỗi (mất mạng...) vẫn cứ đăng xuất phía client.
            }
        }
        clearAuthState(set);
    },
    // LƯU Ý: hàm này CHƯA thực sự đổi mật khẩu qua API — chỉ validate độ dài cục bộ rồi
    // luôn trả về lỗi hướng dẫn dùng API tài khoản thật (account-security-page.jsx gọi
    // API riêng qua accountController, không qua store này).
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
    // Gọi lúc app khởi động (app-bootstrap.jsx) để khôi phục phiên từ token đã persist
    // trong localStorage — vì localStorage chỉ lưu token, chưa chắc token còn hợp lệ nên
    // phải gọi /me để xác nhận lại với server.
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
            // 401 = token bị server từ chối (hết hạn/thu hồi) -> coi như đăng xuất.
            // Lỗi khác (vd mất mạng tạm thời) -> giữ nguyên session cũ, chỉ tắt cờ loading.
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
    // partialize: CHỈ những field liệt kê ở đây mới được ghi vào localStorage — isSubmitting/
    // isHydrating là trạng thái loading tạm thời, không có ý nghĩa gì sau khi reload trang
    // nên cố tình KHÔNG persist (mặc định sẽ về lại initialState sau khi hydrate lại store).
    partialize: (state) => ({
        session: state.session,
        accessToken: state.accessToken,
        accessTokenExpiresAt: state.accessTokenExpiresAt,
        authSource: state.authSource,
    }),
}));
