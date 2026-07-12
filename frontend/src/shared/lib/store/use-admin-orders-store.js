import { create } from "zustand";
import { apiRequest, isUnauthorizedApiError } from "@/shared/api/backend-client";
import { useAuthStore } from "@/shared/lib/store/use-auth-store";
import { registerProtectedSessionCleanup } from "@/shared/lib/store/protected-session";
const initialState = {
    orders: [],
    orderDetails: {},
    isLoading: false,
    isSaving: false,
    error: null,
};
const SESSION_EXPIRED_MESSAGE = "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
function token() {
    return useAuthStore.getState().accessToken;
}
function mergeSummary(detail) {
    return {
        id: detail.id,
        order_no: detail.order_no,
        payment_method: detail.payment_method,
        status: detail.status,
        subtotal: detail.subtotal,
        shipping_fee: detail.shipping_fee,
        discount_amount: detail.discount_amount,
        total_amount: detail.total_amount,
        stock_deducted: detail.stock_deducted,
        stock_deducted_at: detail.stock_deducted_at,
        shipping_line1: detail.shipping_line1,
        shipping_province_id: detail.shipping_province_id,
        shipping_province_name: detail.shipping_province_name,
        shipping_district_id: detail.shipping_district_id,
        shipping_district_name: detail.shipping_district_name,
        shipping_ward_code: detail.shipping_ward_code,
        shipping_ward_name: detail.shipping_ward_name,
        shipping_carrier: detail.shipping_carrier,
        shipping_code: detail.shipping_code,
        shipped_at: detail.shipped_at,
        delivered_at: detail.delivered_at,
        cancelled_at: detail.cancelled_at,
        item_count: detail.item_count,
        customer: detail.customer ?? null,
        payment: detail.payment,
        shipment: detail.shipment ?? null,
        created_at: detail.created_at,
        updated_at: detail.updated_at,
    };
}
function syncOrderDetail(set, orderId, detail) {
    set((state) => ({
        isSaving: false,
        error: null,
        orderDetails: {
            ...state.orderDetails,
            [orderId]: detail,
        },
        orders: state.orders.map((order) => (String(order.id) === orderId ? mergeSummary(detail) : order)),
    }));
}
export const useAdminOrdersStore = create()((set, get) => ({
    ...initialState,
    loadOrders: async () => {
        const accessToken = token();
        if (!accessToken) {
            return { success: false, error: "Bạn cần đăng nhập admin để xem đơn hàng." };
        }
        set({ isLoading: true, error: null });
        try {
            const response = await apiRequest("/admin/orders?per_page=100", {
                token: accessToken,
            });
            set({
                orders: response.data,
                isLoading: false,
                error: null,
            });
            return { success: true, data: response.data };
        }
        catch (error) {
            if (isUnauthorizedApiError(error)) {
                useAuthStore.getState().clearSession();
                return { success: false, error: SESSION_EXPIRED_MESSAGE };
            }
            const message = error instanceof Error ? error.message : "Không thể tải danh sách đơn hàng.";
            set({ isLoading: false, error: message });
            return { success: false, error: message };
        }
    },
    loadOrder: async (orderId) => {
        const cached = get().orderDetails[orderId];
        if (cached) {
            return { success: true, data: cached };
        }
        const accessToken = token();
        if (!accessToken) {
            return { success: false, error: "Bạn cần đăng nhập admin để xem chi tiết đơn hàng." };
        }
        set({ isLoading: true, error: null });
        try {
            const response = await apiRequest(`/admin/orders/${orderId}`, {
                token: accessToken,
            });
            set((state) => ({
                isLoading: false,
                error: null,
                orderDetails: {
                    ...state.orderDetails,
                    [orderId]: response.data,
                },
                orders: state.orders.map((order) => String(order.id) === orderId ? mergeSummary(response.data) : order),
            }));
            return { success: true, data: response.data };
        }
        catch (error) {
            if (isUnauthorizedApiError(error)) {
                useAuthStore.getState().clearSession();
                return { success: false, error: SESSION_EXPIRED_MESSAGE };
            }
            const message = error instanceof Error ? error.message : "Không thể tải chi tiết đơn hàng.";
            set({ isLoading: false, error: message });
            return { success: false, error: message };
        }
    },
    updateStatus: async (orderId, status, note, options) => {
        const accessToken = token();
        if (!accessToken) {
            return { success: false, error: "Bạn cần đăng nhập admin để cập nhật trạng thái." };
        }
        set({ isSaving: true, error: null });
        try {
            const response = await apiRequest(`/admin/orders/${orderId}/status`, {
                method: "PATCH",
                token: accessToken,
                body: {
                    status,
                    note: note?.trim() ? note.trim() : undefined,
                    restock_inventory: options?.restockInventory,
                },
            });
            set((state) => ({
                isSaving: false,
                error: null,
                orderDetails: {
                    ...state.orderDetails,
                    [orderId]: response.data,
                },
                orders: state.orders.map((order) => String(order.id) === orderId ? mergeSummary(response.data) : order),
            }));
            return { success: true, data: response.data };
        }
        catch (error) {
            if (isUnauthorizedApiError(error)) {
                useAuthStore.getState().clearSession();
                return { success: false, error: SESSION_EXPIRED_MESSAGE };
            }
            const message = error instanceof Error ? error.message : "Không thể cập nhật trạng thái đơn hàng.";
            set({ isSaving: false, error: message });
            return { success: false, error: message };
        }
    },
    updatePaymentStatus: async (orderId, paymentStatus, note) => {
        const accessToken = token();
        if (!accessToken) {
            return { success: false, error: "Bạn cần đăng nhập admin để cập nhật trạng thái thanh toán." };
        }
        set({ isSaving: true, error: null });
        try {
            const response = await apiRequest(`/admin/orders/${orderId}/payment-status`, {
                method: "PATCH",
                token: accessToken,
                body: {
                    payment_status: paymentStatus,
                    note: note?.trim() ? note.trim() : undefined,
                },
            });
            set((state) => ({
                isSaving: false,
                error: null,
                orderDetails: {
                    ...state.orderDetails,
                    [orderId]: response.data,
                },
                orders: state.orders.map((order) => String(order.id) === orderId ? mergeSummary(response.data) : order),
            }));
            return { success: true, data: response.data };
        }
        catch (error) {
            if (isUnauthorizedApiError(error)) {
                useAuthStore.getState().clearSession();
                return { success: false, error: SESSION_EXPIRED_MESSAGE };
            }
            const message = error instanceof Error ? error.message : "Không thể cập nhật trạng thái thanh toán.";
            set({ isSaving: false, error: message });
            return { success: false, error: message };
        }
    },
    createShipment: async (orderId, payload) => {
        const accessToken = token();
        if (!accessToken) {
            return { success: false, error: "Ban can dang nhap admin de tao van don." };
        }
        set({ isSaving: true, error: null });
        try {
            const response = await apiRequest(`/admin/orders/${orderId}/shipment`, {
                method: "POST",
                token: accessToken,
                body: payload,
            });
            syncOrderDetail(set, orderId, response.data);
            return { success: true, data: response.data };
        }
        catch (error) {
            if (isUnauthorizedApiError(error)) {
                useAuthStore.getState().clearSession();
                set({ isSaving: false, error: SESSION_EXPIRED_MESSAGE });
                return { success: false, error: SESSION_EXPIRED_MESSAGE };
            }
            const message = error instanceof Error ? error.message : "Khong the tao van don.";
            set({ isSaving: false, error: message });
            return { success: false, error: message };
        }
    },
    syncShipment: async (orderId) => {
        const accessToken = token();
        if (!accessToken) {
            return { success: false, error: "Ban can dang nhap admin de dong bo van don." };
        }
        set({ isSaving: true, error: null });
        try {
            const response = await apiRequest(`/admin/orders/${orderId}/shipment/sync`, {
                method: "POST",
                token: accessToken,
            });
            syncOrderDetail(set, orderId, response.data);
            return { success: true, data: response.data };
        }
        catch (error) {
            if (isUnauthorizedApiError(error)) {
                useAuthStore.getState().clearSession();
                set({ isSaving: false, error: SESSION_EXPIRED_MESSAGE });
                return { success: false, error: SESSION_EXPIRED_MESSAGE };
            }
            const message = error instanceof Error ? error.message : "Khong the dong bo GHN.";
            set({ isSaving: false, error: message });
            return { success: false, error: message };
        }
    },
    cancelShipment: async (orderId) => {
        const accessToken = token();
        if (!accessToken) {
            return { success: false, error: "Ban can dang nhap admin de huy van don." };
        }
        set({ isSaving: true, error: null });
        try {
            const response = await apiRequest(`/admin/orders/${orderId}/shipment`, {
                method: "DELETE",
                token: accessToken,
            });
            syncOrderDetail(set, orderId, response.data);
            return { success: true, data: response.data };
        }
        catch (error) {
            if (isUnauthorizedApiError(error)) {
                useAuthStore.getState().clearSession();
                set({ isSaving: false, error: SESSION_EXPIRED_MESSAGE });
                return { success: false, error: SESSION_EXPIRED_MESSAGE };
            }
            const message = error instanceof Error ? error.message : "Khong the huy van don.";
            set({ isSaving: false, error: message });
            return { success: false, error: message };
        }
    },
    bulkUpdateStatus: async (payload) => {
        const accessToken = token();
        if (!accessToken) {
            return { success: false, error: "Bạn cần đăng nhập admin để xử lý hàng loạt." };
        }
        set({ isSaving: true, error: null });
        try {
            const response = await apiRequest("/admin/orders/bulk-status", {
                method: "POST",
                token: accessToken,
                body: {
                    orderIds: payload.orderIds,
                    action: payload.action,
                    note: payload.note?.trim() ? payload.note.trim() : undefined,
                },
            });
            set({ isSaving: false, error: null });
            return { success: true, data: response.data };
        }
        catch (error) {
            if (isUnauthorizedApiError(error)) {
                useAuthStore.getState().clearSession();
                return { success: false, error: SESSION_EXPIRED_MESSAGE };
            }
            const message = error instanceof Error ? error.message : "Không thể xử lý hàng loạt đơn hàng.";
            set({ isSaving: false, error: message });
            return { success: false, error: message };
        }
    },
    reset: () => set(initialState),
}));
registerProtectedSessionCleanup(() => {
    useAdminOrdersStore.getState().reset();
});
