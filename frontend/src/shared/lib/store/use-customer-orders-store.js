import { create } from "zustand";
import { apiRequest, isUnauthorizedApiError } from "@/shared/api/backend-client";
import { adaptBackendOrderDetail, adaptBackendOrderSummary, } from "@/shared/api/storefront-adapters";
import { useAuthStore } from "@/shared/lib/store/use-auth-store";
import { registerProtectedSessionCleanup } from "@/shared/lib/store/protected-session";
const initialState = {
    orders: [],
    orderDetails: {},
    pagination: null,
    isLoading: false,
    isSubmitting: false,
    error: null,
};
const SESSION_EXPIRED_MESSAGE = "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
function sessionToken() {
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
// Cùng lý do với use-admin-orders-store.js: checkout()/cancelOrder()/... trả về đối tượng
// "chi tiết đơn hàng" đầy đủ, nhưng mảng `orders` (trang lịch sử đơn) chỉ cần shape tóm
// tắt — rút gọn lại ở đây để cập nhật `orders` mà không cần gọi loadOrders() lại từ đầu.
function mergeSummary(detail) {
    return {
        id: detail.id,
        orderNo: detail.orderNo,
        paymentMethod: detail.paymentMethod,
        status: detail.status,
        subtotal: detail.subtotal,
        shippingFee: detail.shippingFee,
        discountAmount: detail.discountAmount,
        totalAmount: detail.totalAmount,
        itemCount: detail.itemCount,
        productNames: detail.productNames,
        payment: detail.payment,
        createdAt: detail.createdAt,
        updatedAt: detail.updatedAt,
    };
}
export const useCustomerOrdersStore = create()((set, get) => ({
    ...initialState,
    loadOrders: async (page = 1, perPage = 15) => {
        const token = sessionToken();
        if (!token) {
            set({
                orders: [],
                pagination: null,
            });
            return {
                success: false,
                error: "Bạn cần đăng nhập lại để xem đơn hàng.",
            };
        }
        set({
            isLoading: true,
            error: null,
        });
        try {
            const response = await apiRequest(`/orders?page=${page}&per_page=${perPage}`, { token });
            const orders = response.data.map(adaptBackendOrderSummary);
            const pagination = paginationFromOrdersResponse(response);
            set({
                orders,
                pagination,
                isLoading: false,
                error: null,
            });
            return { success: true, data: orders };
        }
        catch (error) {
            if (isUnauthorizedApiError(error)) {
                set({ isLoading: false, error: SESSION_EXPIRED_MESSAGE });
                useAuthStore.getState().clearSession();
                return { success: false, error: SESSION_EXPIRED_MESSAGE };
            }
            const message = error instanceof Error ? error.message : "Không thể tải lịch sử đơn hàng.";
            set({ isLoading: false, error: message });
            return { success: false, error: message };
        }
    },
    loadOrder: async (orderId) => {
        // Đã có sẵn trong cache (vd khách bấm lại vào đơn vừa xem) -> trả ngay, khỏi gọi API.
        const cached = get().orderDetails[orderId];
        if (cached) {
            return { success: true, data: cached };
        }
        const token = sessionToken();
        if (!token) {
            return {
                success: false,
                error: "Bạn cần đăng nhập lại để xem chi tiết đơn hàng.",
            };
        }
        set({ isLoading: true, error: null });
        try {
            const response = await apiRequest(`/orders/${orderId}`, { token });
            const order = adaptBackendOrderDetail(response.data);
            set((state) => ({
                isLoading: false,
                error: null,
                orderDetails: {
                    ...state.orderDetails,
                    [order.id]: order,
                },
            }));
            return { success: true, data: order };
        }
        catch (error) {
            if (isUnauthorizedApiError(error)) {
                set({ isLoading: false, error: SESSION_EXPIRED_MESSAGE });
                useAuthStore.getState().clearSession();
                return { success: false, error: SESSION_EXPIRED_MESSAGE };
            }
            const message = error instanceof Error ? error.message : "Không thể tải chi tiết đơn hàng.";
            set({ isLoading: false, error: message });
            return { success: false, error: message };
        }
    },
    checkout: async (payload) => {
        const token = sessionToken();
        if (!token) {
            return {
                success: false,
                error: "Bạn cần đăng nhập lại để tiếp tục đặt hàng.",
            };
        }
        set({ isSubmitting: true, error: null });
        try {
            const response = await apiRequest("/orders/checkout", {
                method: "POST",
                token,
                body: payload,
            });
            const order = adaptBackendOrderDetail(response.data);
            set((state) => ({
                isSubmitting: false,
                error: null,
                orders: [mergeSummary(order), ...state.orders],
                orderDetails: {
                    ...state.orderDetails,
                    [order.id]: order,
                },
            }));
            // payment_redirect_url: URL cổng thanh toán VNPay/MoMo (nếu chọn), để checkout redirect.
            return { success: true, data: order, paymentRedirectUrl: response.data?.payment_redirect_url ?? null };
        }
        catch (error) {
            if (isUnauthorizedApiError(error)) {
                set({ isSubmitting: false, error: SESSION_EXPIRED_MESSAGE });
                useAuthStore.getState().clearSession();
                return { success: false, error: SESSION_EXPIRED_MESSAGE };
            }
            const message = error instanceof Error ? error.message : "Không thể hoàn tất đặt hàng.";
            set({ isSubmitting: false, error: message });
            return { success: false, error: message };
        }
    },
    cancelOrder: async (orderId, payload) => {
        const token = sessionToken();
        if (!token) {
            return {
                success: false,
                error: "Bạn cần đăng nhập lại để hủy đơn hàng.",
            };
        }
        set({ isSubmitting: true, error: null });
        try {
            const response = await apiRequest(`/orders/${orderId}/cancel`, {
                method: "PATCH",
                token,
                body: {
                    reason: payload.reason,
                    note: payload.note?.trim() ? payload.note.trim() : undefined,
                },
            });
            const order = adaptBackendOrderDetail(response.data);
            set((state) => ({
                isSubmitting: false,
                error: null,
                orders: state.orders.map((item) => (item.id === order.id ? mergeSummary(order) : item)),
                orderDetails: {
                    ...state.orderDetails,
                    [order.id]: order,
                },
            }));
            return { success: true, data: order };
        }
        catch (error) {
            if (isUnauthorizedApiError(error)) {
                set({ isSubmitting: false, error: SESSION_EXPIRED_MESSAGE });
                useAuthStore.getState().clearSession();
                return { success: false, error: SESSION_EXPIRED_MESSAGE };
            }
            const message = error instanceof Error ? error.message : "Không thể hủy đơn hàng.";
            set({ isSubmitting: false, error: message });
            return { success: false, error: message };
        }
    },
    confirmBankTransferSubmitted: async (orderId, note) => {
        const token = sessionToken();
        if (!token) {
            return {
                success: false,
                error: "Bạn cần đăng nhập lại để xác nhận đã chuyển khoản.",
            };
        }
        set({ isSubmitting: true, error: null });
        try {
            const response = await apiRequest(`/orders/${orderId}/bank-transfer-submitted`, {
                method: "PATCH",
                token,
                body: {
                    note: note?.trim() ? note.trim() : undefined,
                },
            });
            const order = adaptBackendOrderDetail(response.data);
            set((state) => ({
                isSubmitting: false,
                error: null,
                orders: state.orders.map((item) => (item.id === order.id ? mergeSummary(order) : item)),
                orderDetails: {
                    ...state.orderDetails,
                    [order.id]: order,
                },
            }));
            return { success: true, data: order };
        }
        catch (error) {
            if (isUnauthorizedApiError(error)) {
                set({ isSubmitting: false, error: SESSION_EXPIRED_MESSAGE });
                useAuthStore.getState().clearSession();
                return { success: false, error: SESSION_EXPIRED_MESSAGE };
            }
            const message = error instanceof Error ? error.message : "Không thể gửi xác nhận chuyển khoản.";
            set({ isSubmitting: false, error: message });
            return { success: false, error: message };
        }
    },
    confirmDelivery: async (orderId) => {
        const token = sessionToken();
        if (!token) {
            return {
                success: false,
                error: "Bạn cần đăng nhập lại để xác nhận đã nhận hàng.",
            };
        }
        set({ isSubmitting: true, error: null });
        try {
            const response = await apiRequest(`/orders/${orderId}/confirm-delivery`, {
                method: "PATCH",
                token,
            });
            const order = adaptBackendOrderDetail(response.data);
            set((state) => ({
                isSubmitting: false,
                error: null,
                orders: state.orders.map((item) => (item.id === order.id ? mergeSummary(order) : item)),
                orderDetails: {
                    ...state.orderDetails,
                    [order.id]: order,
                },
            }));
            return { success: true, data: order };
        }
        catch (error) {
            if (isUnauthorizedApiError(error)) {
                set({ isSubmitting: false, error: SESSION_EXPIRED_MESSAGE });
                useAuthStore.getState().clearSession();
                return { success: false, error: SESSION_EXPIRED_MESSAGE };
            }
            const message = error instanceof Error ? error.message : "Không thể xác nhận đã nhận hàng.";
            set({ isSubmitting: false, error: message });
            return { success: false, error: message };
        }
    },
    reset: () => set(initialState),
}));
registerProtectedSessionCleanup(() => {
    useCustomerOrdersStore.getState().reset();
});
