import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { apiRequest, isUnauthorizedApiError } from "@/shared/api/backend-client";
import { adaptBackendCart } from "@/shared/api/storefront-adapters";
import { useAuthStore } from "@/shared/lib/store/use-auth-store";
import { registerProtectedSessionCleanup } from "@/shared/lib/store/protected-session";
function upsertItem(items, productId, quantity) {
    const existing = items.find((item) => item.productId === productId);
    if (!existing) {
        return [...items, { productId, quantity }];
    }
    return items.map((item) => item.productId === productId ? { ...item, quantity: item.quantity + quantity } : item);
}
const initialState = {
    guestItems: [],
    items: [],
    cart: null,
    isLoading: false,
    isSyncing: false,
    error: null,
};
const SESSION_EXPIRED_MESSAGE = "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
function authState() {
    return useAuthStore.getState();
}
function isBackendCustomerSession() {
    const state = authState();
    return state.authSource === "backend" && state.session?.user.role === "customer";
}
function numericProductId(productId) {
    const parsed = Number(productId);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}
function normalizeGuestItems(items) {
    return items.filter((item) => item.quantity > 0);
}
function syncBackendCart(set, cart) {
    set({
        cart,
        items: cart.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
        })),
        error: null,
    });
}
export const useCartStore = create()(persist((set, get) => ({
    ...initialState,
    loadCart: async () => {
        if (!isBackendCustomerSession()) {
            set((state) => ({
                cart: null,
                items: state.guestItems,
                error: null,
            }));
            return { success: true };
        }
        const token = authState().accessToken;
        if (!token) {
            return {
                success: false,
                error: "Bạn cần đăng nhập lại để tải giỏ hàng.",
            };
        }
        set({
            isLoading: true,
            error: null,
        });
        try {
            const response = await apiRequest("/cart", {
                token,
            });
            const cart = adaptBackendCart(response.data);
            syncBackendCart(set, cart);
            set({ isLoading: false });
            return {
                success: true,
                data: cart,
            };
        }
        catch (error) {
            if (isUnauthorizedApiError(error)) {
                set({
                    isLoading: false,
                    error: SESSION_EXPIRED_MESSAGE,
                });
                useAuthStore.getState().clearSession();
                return {
                    success: false,
                    error: SESSION_EXPIRED_MESSAGE,
                };
            }
            set({
                isLoading: false,
                error: error instanceof Error ? error.message : "Không thể tải giỏ hàng.",
            });
            return {
                success: false,
                error: error instanceof Error ? error.message : "Không thể tải giỏ hàng.",
            };
        }
    },
    addItem: async (productId, quantity) => {
        if (quantity <= 0) {
            return {
                success: false,
                error: "Số lượng phải lớn hơn 0.",
            };
        }
        if (!isBackendCustomerSession()) {
            set((state) => {
                const guestItems = upsertItem(state.guestItems, productId, quantity);
                return {
                    guestItems,
                    items: guestItems,
                    error: null,
                };
            });
            return { success: true };
        }
        const token = authState().accessToken;
        const parsedProductId = numericProductId(productId);
        if (!token || !parsedProductId) {
            return {
                success: false,
                error: "Sản phẩm không còn hợp lệ trên storefront hiện tại.",
            };
        }
        try {
            const response = await apiRequest("/cart/items", {
                method: "POST",
                token,
                body: {
                    product_id: parsedProductId,
                    quantity,
                },
            });
            const cart = adaptBackendCart(response.data);
            syncBackendCart(set, cart);
            return {
                success: true,
                data: cart,
            };
        }
        catch (error) {
            if (isUnauthorizedApiError(error)) {
                set({
                    error: SESSION_EXPIRED_MESSAGE,
                });
                useAuthStore.getState().clearSession();
                return {
                    success: false,
                    error: SESSION_EXPIRED_MESSAGE,
                };
            }
            set({
                error: error instanceof Error ? error.message : "Không thể thêm vào giỏ.",
            });
            return {
                success: false,
                error: error instanceof Error ? error.message : "Không thể thêm vào giỏ.",
            };
        }
    },
    setQuantity: async (productId, quantity) => {
        if (quantity <= 0) {
            return get().removeItem(productId);
        }
        if (!isBackendCustomerSession()) {
            set((state) => {
                const guestItems = normalizeGuestItems(state.guestItems.map((item) => item.productId === productId ? { ...item, quantity } : item));
                return {
                    guestItems,
                    items: guestItems,
                    error: null,
                };
            });
            return { success: true };
        }
        const token = authState().accessToken;
        const cartItem = get().cart?.items.find((item) => item.productId === productId);
        if (!token || !cartItem) {
            return {
                success: false,
                error: "Không tìm thấy mặt hàng cần cập nhật trong giỏ.",
            };
        }
        try {
            const response = await apiRequest(`/cart/items/${cartItem.id}`, {
                method: "PATCH",
                token,
                body: {
                    quantity,
                },
            });
            const cart = adaptBackendCart(response.data);
            syncBackendCart(set, cart);
            return {
                success: true,
                data: cart,
            };
        }
        catch (error) {
            if (isUnauthorizedApiError(error)) {
                set({
                    error: SESSION_EXPIRED_MESSAGE,
                });
                useAuthStore.getState().clearSession();
                return {
                    success: false,
                    error: SESSION_EXPIRED_MESSAGE,
                };
            }
            set({
                error: error instanceof Error ? error.message : "Không thể cập nhật giỏ hàng.",
            });
            return {
                success: false,
                error: error instanceof Error ? error.message : "Không thể cập nhật giỏ hàng.",
            };
        }
    },
    removeItem: async (productId) => {
        if (!isBackendCustomerSession()) {
            set((state) => {
                const guestItems = state.guestItems.filter((item) => item.productId !== productId);
                return {
                    guestItems,
                    items: guestItems,
                    error: null,
                };
            });
            return { success: true };
        }
        const token = authState().accessToken;
        const cartItem = get().cart?.items.find((item) => item.productId === productId);
        if (!token || !cartItem) {
            return {
                success: false,
                error: "Không tìm thấy mặt hàng cần xóa trong giỏ.",
            };
        }
        try {
            const response = await apiRequest(`/cart/items/${cartItem.id}`, {
                method: "DELETE",
                token,
            });
            const cart = adaptBackendCart(response.data);
            syncBackendCart(set, cart);
            return {
                success: true,
                data: cart,
            };
        }
        catch (error) {
            if (isUnauthorizedApiError(error)) {
                set({
                    error: SESSION_EXPIRED_MESSAGE,
                });
                useAuthStore.getState().clearSession();
                return {
                    success: false,
                    error: SESSION_EXPIRED_MESSAGE,
                };
            }
            set({
                error: error instanceof Error
                    ? error.message
                    : "Không thể xóa mặt hàng khỏi giỏ.",
            });
            return {
                success: false,
                error: error instanceof Error
                    ? error.message
                    : "Không thể xóa mặt hàng khỏi giỏ.",
            };
        }
    },
    syncGuestCart: async () => {
        if (!isBackendCustomerSession()) {
            return { success: true };
        }
        const token = authState().accessToken;
        if (!token) {
            return {
                success: false,
                error: "Bạn cần đăng nhập lại để đồng bộ giỏ hàng.",
            };
        }
        const validGuestItems = normalizeGuestItems(get().guestItems.filter((item) => numericProductId(item.productId) !== null));
        if (validGuestItems.length !== get().guestItems.length) {
            set({
                guestItems: validGuestItems,
            });
        }
        if (validGuestItems.length === 0) {
            return get().loadCart();
        }
        set({
            isSyncing: true,
            error: null,
        });
        try {
            for (const item of validGuestItems) {
                await apiRequest("/cart/items", {
                    method: "POST",
                    token,
                    body: {
                        product_id: numericProductId(item.productId),
                        quantity: item.quantity,
                    },
                });
            }
            set({
                guestItems: [],
                isSyncing: false,
            });
            return get().loadCart();
        }
        catch (error) {
            if (isUnauthorizedApiError(error)) {
                set({
                    isSyncing: false,
                    error: SESSION_EXPIRED_MESSAGE,
                });
                useAuthStore.getState().clearSession();
                return {
                    success: false,
                    error: SESSION_EXPIRED_MESSAGE,
                };
            }
            set({
                isSyncing: false,
                error: error instanceof Error ? error.message : "Không thể đồng bộ giỏ hàng.",
            });
            return {
                success: false,
                error: error instanceof Error ? error.message : "Không thể đồng bộ giỏ hàng.",
            };
        }
    },
    pruneGuestItems: (validProductIds) => set((state) => {
        const guestItems = state.guestItems.filter((item) => validProductIds.includes(item.productId));
        return {
            guestItems,
            items: isBackendCustomerSession() ? state.items : guestItems,
        };
    }),
    resetServerState: () => set((state) => ({
        cart: null,
        items: state.guestItems,
        isLoading: false,
        isSyncing: false,
        error: null,
    })),
    clear: () => set({ guestItems: [], items: [], cart: null, error: null }),
    reset: () => set(initialState),
}), {
    name: "heritage-cart-store",
    storage: createJSONStorage(() => localStorage),
    partialize: (state) => ({
        guestItems: state.guestItems,
        items: state.guestItems,
    }),
}));
registerProtectedSessionCleanup(() => {
    useCartStore.getState().resetServerState();
});
