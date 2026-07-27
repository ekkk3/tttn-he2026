import { create } from "zustand";
import { apiRequest, isUnauthorizedApiError } from "@/shared/api/backend-client";
import { registerProtectedSessionCleanup } from "@/shared/lib/store/protected-session";
import { useAuthStore } from "@/shared/lib/store/use-auth-store";
// 4 field "...ByCustomerId" là các map KEYED THEO customerId (không phải mảng dùng chung)
// — vì trang admin có thể mở lịch sử đơn của NHIỀU khách khác nhau (drawer/panel riêng cho
// từng khách), mỗi khách cần trạng thái loading/error/pagination/dữ liệu riêng biệt, tránh
// dữ liệu của khách này đè lên khách kia khi xem gần như đồng thời.
const initialState = {
    customers: [],
    customerOrdersByCustomerId: {},
    customerOrdersPaginationByCustomerId: {},
    customerOrdersLoadingByCustomerId: {},
    customerOrdersErrorByCustomerId: {},
    isLoading: false,
    isSaving: false,
    error: null,
};
const SESSION_EXPIRED_MESSAGE = "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
function token() {
    return useAuthStore.getState().accessToken;
}
function paginationFromOrdersResponse(response) {
    const nestedPagination = response.pagination;
    return {
        currentPage: response.current_page ?? nestedPagination?.current_page ?? 1,
        lastPage: response.last_page ?? nestedPagination?.last_page ?? 1,
        perPage: response.per_page ?? nestedPagination?.per_page ?? response.data.length,
        total: response.total ?? nestedPagination?.total ?? response.data.length,
    };
}
function upsertCustomer(customers, nextCustomer) {
    const nextCustomers = customers.filter((customer) => customer.id !== nextCustomer.id);
    return [nextCustomer, ...nextCustomers];
}
export const useAdminUserStore = create()((set, get) => ({
    ...initialState,
    loadCustomers: async () => {
        const accessToken = token();
        if (!accessToken) {
            return {
                success: false,
                error: "Bạn cần đăng nhập admin để tải danh sách users.",
            };
        }
        set({ isLoading: true, error: null });
        try {
            const response = await apiRequest("/admin/users?per_page=200", { token: accessToken });
            set({ customers: response.data, isLoading: false, error: null });
            return { success: true };
        }
        catch (error) {
            if (isUnauthorizedApiError(error)) {
                useAuthStore.getState().clearSession();
                return { success: false, error: SESSION_EXPIRED_MESSAGE };
            }
            const message = error instanceof Error ? error.message : "Không thể tải danh sách users.";
            set({ isLoading: false, error: message });
            return { success: false, error: message };
        }
    },
    loadCustomer: async (customerId) => {
        const cached = get().customers.find((customer) => customer.id === customerId);
        if (cached) {
            return { success: true, data: cached };
        }
        const accessToken = token();
        if (!accessToken) {
            return {
                success: false,
                error: "Bạn cần đăng nhập admin để xem user này.",
            };
        }
        set({ isLoading: true, error: null });
        try {
            const response = await apiRequest(`/admin/users/${customerId}`, {
                token: accessToken,
            });
            set((state) => ({
                customers: upsertCustomer(state.customers, response.data),
                isLoading: false,
                error: null,
            }));
            return { success: true, data: response.data };
        }
        catch (error) {
            if (isUnauthorizedApiError(error)) {
                useAuthStore.getState().clearSession();
                set({ isLoading: false, error: SESSION_EXPIRED_MESSAGE });
                return { success: false, error: SESSION_EXPIRED_MESSAGE };
            }
            const message = error instanceof Error ? error.message : "Không thể tải user.";
            set({ isLoading: false, error: message });
            return { success: false, error: message };
        }
    },
    loadCustomerOrders: async (customerId, page = 1, perPage = 5) => {
        const accessToken = token();
        if (!accessToken) {
            return {
                success: false,
                error: "Bạn cần đăng nhập admin để xem lịch sử đơn hàng.",
            };
        }
        set((state) => ({
            customerOrdersLoadingByCustomerId: {
                ...state.customerOrdersLoadingByCustomerId,
                [customerId]: true,
            },
            customerOrdersErrorByCustomerId: {
                ...state.customerOrdersErrorByCustomerId,
                [customerId]: null,
            },
        }));
        try {
            const response = await apiRequest(`/admin/users/${customerId}/orders?page=${page}&per_page=${perPage}`, { token: accessToken });
            set((state) => ({
                customerOrdersByCustomerId: {
                    ...state.customerOrdersByCustomerId,
                    [customerId]: response.data,
                },
                customerOrdersPaginationByCustomerId: {
                    ...state.customerOrdersPaginationByCustomerId,
                    [customerId]: paginationFromOrdersResponse(response),
                },
                customerOrdersLoadingByCustomerId: {
                    ...state.customerOrdersLoadingByCustomerId,
                    [customerId]: false,
                },
                customerOrdersErrorByCustomerId: {
                    ...state.customerOrdersErrorByCustomerId,
                    [customerId]: null,
                },
            }));
            return { success: true, data: response.data };
        }
        catch (error) {
            if (isUnauthorizedApiError(error)) {
                useAuthStore.getState().clearSession();
                set((state) => ({
                    customerOrdersLoadingByCustomerId: {
                        ...state.customerOrdersLoadingByCustomerId,
                        [customerId]: false,
                    },
                    customerOrdersErrorByCustomerId: {
                        ...state.customerOrdersErrorByCustomerId,
                        [customerId]: SESSION_EXPIRED_MESSAGE,
                    },
                }));
                return { success: false, error: SESSION_EXPIRED_MESSAGE };
            }
            const message = error instanceof Error ? error.message : "Không thể tải lịch sử đơn hàng.";
            set((state) => ({
                customerOrdersLoadingByCustomerId: {
                    ...state.customerOrdersLoadingByCustomerId,
                    [customerId]: false,
                },
                customerOrdersErrorByCustomerId: {
                    ...state.customerOrdersErrorByCustomerId,
                    [customerId]: message,
                },
            }));
            return { success: false, error: message };
        }
    },
    createCustomer: async (payload) => {
        const accessToken = token();
        if (!accessToken)
            return { success: false, error: "Bạn cần đăng nhập admin để tạo user." };
        set({ isSaving: true, error: null });
        try {
            const response = await apiRequest("/admin/users", {
                method: "POST",
                token: accessToken,
                body: payload,
            });
            set((state) => ({
                customers: [response.data, ...state.customers],
                isSaving: false,
                error: null,
            }));
            await get().loadCustomers();
            return { success: true, data: response.data };
        }
        catch (error) {
            if (isUnauthorizedApiError(error)) {
                useAuthStore.getState().clearSession();
                return { success: false, error: SESSION_EXPIRED_MESSAGE };
            }
            const message = error instanceof Error ? error.message : "Không thể tạo user.";
            set({ isSaving: false, error: message });
            return { success: false, error: message };
        }
    },
    updateCustomer: async (customerId, payload) => {
        const accessToken = token();
        if (!accessToken)
            return { success: false, error: "Bạn cần đăng nhập admin để cập nhật user." };
        // Tách password ra khỏi payload trước khi gửi update thường — đổi mật khẩu user khác
        // đi qua 1 luồng riêng (không nằm trong store này), tránh vô tình gửi password rỗng
        // ghi đè mật khẩu hiện tại nếu form không có field đó.
        const { password: _password, ...body } = payload;
        set({ isSaving: true, error: null });
        try {
            const response = await apiRequest(`/admin/users/${customerId}`, {
                method: "PUT",
                token: accessToken,
                body,
            });
            set((state) => ({
                customers: upsertCustomer(state.customers, response.data),
                isSaving: false,
                error: null,
            }));
            await get().loadCustomers();
            return { success: true, data: response.data };
        }
        catch (error) {
            if (isUnauthorizedApiError(error)) {
                useAuthStore.getState().clearSession();
                return { success: false, error: SESSION_EXPIRED_MESSAGE };
            }
            const message = error instanceof Error ? error.message : "Không thể cập nhật user.";
            set({ isSaving: false, error: message });
            return { success: false, error: message };
        }
    },
    blockCustomer: async (customerId) => {
        const accessToken = token();
        if (!accessToken)
            return { success: false, error: "Bạn cần đăng nhập admin để khóa user." };
        set({ isSaving: true, error: null });
        try {
            const response = await apiRequest(`/admin/users/${customerId}`, {
                method: "DELETE",
                token: accessToken,
            });
            set((state) => ({
                customers: upsertCustomer(state.customers, response.data),
                isSaving: false,
                error: null,
            }));
            await get().loadCustomers();
            return { success: true, data: response.data };
        }
        catch (error) {
            if (isUnauthorizedApiError(error)) {
                useAuthStore.getState().clearSession();
                return { success: false, error: SESSION_EXPIRED_MESSAGE };
            }
            const message = error instanceof Error ? error.message : "Không thể khóa user.";
            set({ isSaving: false, error: message });
            return { success: false, error: message };
        }
    },
    reset: () => set(initialState),
}));
registerProtectedSessionCleanup(() => {
    useAdminUserStore.getState().reset();
});
