import { create } from "zustand";
import { apiRequest, isUnauthorizedApiError } from "@/shared/api/backend-client";
import { useAuthStore } from "@/shared/lib/store/use-auth-store";
const initialState = {
    inventory: [],
    requisitions: [],
    purchasePrices: [],
    supplierOrders: [],
    fulfillmentTasks: [],
    supportTickets: [],
    suppliers: [],
    productsById: {},
    status: "idle",
    error: null,
};
// Trang vận hành chỉ dùng được với tài khoản đăng nhập THẬT qua backend (WAREHOUSE_STAFF/
// ADMIN/SUPPLIER) — không có khái niệm "khách" ở đây như cart/wishlist, nên chỉ cần check
// authSource, không cần check role cụ thể (backend tự chặn theo role ở middleware).
function token() {
    const state = useAuthStore.getState();
    if (state.authSource !== "backend") {
        return null;
    }
    return state.accessToken;
}
function authError() {
    return "Cần đăng nhập bằng tài khoản từ database để xem dữ liệu vận hành.";
}
function handleError(error) {
    if (isUnauthorizedApiError(error)) {
        useAuthStore.getState().clearSession();
    }
    return error instanceof Error ? error.message : "Không thể tải dữ liệu vận hành.";
}
function adaptInventoryItem(item) {
    return {
        sku: item.sku,
        productId: String(item.product_id),
        productName: item.product_name,
        supplierId: item.supplier_id ? String(item.supplier_id) : "",
        supplierName: item.supplier_name ?? undefined,
        onHand: item.quantity_on_hand,
        reserved: item.reserved,
        reorderPoint: item.reorder_level,
        purchasePrice: item.purchase_price,
        aisle: item.aisle,
        status: item.status,
    };
}
function adaptRequisition(item) {
    return {
        id: item.id,
        inventorySku: item.inventory_sku,
        productId: item.product_id ? String(item.product_id) : undefined,
        productName: item.product_name ?? undefined,
        supplierId: item.supplier_id ? String(item.supplier_id) : "",
        supplierName: item.supplier_name ?? undefined,
        requestedQty: item.requested_qty,
        approvedQty: item.approved_qty ?? undefined,
        etaDays: item.eta_days,
        status: item.status,
        note: item.note ?? undefined,
        statusHistory: [
            {
                id: `${item.id}-created`,
                actor: "System",
                label: item.status,
                createdAt: item.created_at ?? new Date().toISOString(),
            },
        ],
    };
}
function adaptOperationOrder(item) {
    return {
        id: item.id,
        customerName: item.customer_name,
        customerId: item.customer_id ?? undefined,
        supplierName: item.supplier_name,
        supplierId: item.supplier_id ?? undefined,
        date: item.date ?? new Date().toISOString(),
        total: item.total,
        paymentStatus: item.payment_status,
        deliveryStatus: item.delivery_status,
        shippingTier: item.shipping_tier,
        address: item.address,
        note: item.note ?? undefined,
        items: item.items.map((line) => ({
            productId: line.product_id,
            productName: line.product_name,
            quantity: line.quantity,
            unitPrice: line.unit_price,
        })),
        timeline: item.timeline.map((event) => ({
            id: event.id,
            orderId: event.order_id,
            label: event.label,
            timestamp: event.timestamp ?? new Date().toISOString(),
            completed: event.completed,
        })),
        statusHistory: item.status_history.map((event) => ({
            id: event.id,
            actor: event.actor,
            label: event.label,
            createdAt: event.created_at ?? new Date().toISOString(),
        })),
        assignedWarehouseZone: item.assigned_warehouse_zone,
    };
}
function adaptFulfillmentTask(item) {
    return {
        id: item.id,
        orderId: item.order_id,
        customerName: item.customer_name,
        shippingTier: item.shipping_tier,
        status: item.status,
        priority: item.priority,
        assignedZone: item.assigned_zone,
        etaLabel: item.eta_label,
        notes: item.notes ?? undefined,
        statusHistory: item.status_history.map((event) => ({
            id: event.id,
            actor: event.actor,
            label: event.label,
            createdAt: event.created_at ?? new Date().toISOString(),
        })),
    };
}
function adaptPurchasePrice(item) {
    return {
        id: item.id,
        productId: String(item.product_id),
        productName: item.product_name,
        sku: item.sku,
        supplierId: item.supplier_id ? String(item.supplier_id) : "",
        supplierName: item.supplier_name ?? undefined,
        price: Number(item.price),
        effectiveDate: item.effective_date,
        note: item.note ?? undefined,
        createdAt: item.created_at,
    };
}
function adaptTicket(item) {
    return {
        id: String(item.id),
        subject: item.subject,
        message: item.message,
        channel: item.channel,
        status: item.status,
        createdAt: item.created_at ?? new Date().toISOString(),
    };
}
// KHÔNG có API riêng trả "danh sách NCC dạng đối tác" cho trang vận hành — nên tự dựng lại
// từ chính dữ liệu tồn kho: mỗi sản phẩm trong `inventory` đã kèm supplier_id/supplier_name,
// dùng Map để loại trùng (mỗi NCC chỉ giữ 1 bản ghi) rồi bù các field UI cần nhưng backend
// không có (partnerTier, monthlyRevenue...) bằng giá trị mặc định/rỗng.
function buildSuppliers(inventory) {
    return [
        ...new Map(inventory
            .filter((item) => item.supplier_id && item.supplier_name)
            .map((item) => [
            String(item.supplier_id),
            {
                id: String(item.supplier_id),
                name: item.supplier_name ?? "",
                location: item.supplier_location ?? item.inventory_location ?? "",
                contactName: "",
                categories: [],
                partnerTier: "Verified",
                monthlyRevenue: 0,
                responseTime: "2-3 ngày",
                status: "active",
                image: "",
            },
        ])).values(),
    ];
}
// Tra cứu nhanh tên/sku sản phẩm theo id (dùng ở UI hiện tên sản phẩm trong bảng phiếu
// nhập/đơn) mà không phải lặp mảng inventory mỗi lần — cũng dựng từ dữ liệu inventory sẵn có.
function buildProductsById(inventory) {
    return inventory.reduce((accumulator, item) => {
        accumulator[String(item.product_id)] = {
            id: String(item.product_id),
            sku: item.sku,
            name: item.product_name,
        };
        return accumulator;
    }, {});
}
export const useOperationsDataStore = create()((set, get) => ({
    ...initialState,
    loadOperations: async (force = false) => {
        if (!force && ["loading", "ready"].includes(get().status)) {
            return { success: true };
        }
        const currentToken = token();
        if (!currentToken) {
            set({ status: "error", error: authError() });
            return { success: false, error: authError() };
        }
        set({ status: "loading", error: null });
        try {
            const [inventoryResponse, requisitionsResponse, purchasePricesResponse, ordersResponse, tasksResponse, ticketsResponse] = await Promise.all([
                apiRequest("/operations/inventory", { token: currentToken }),
                apiRequest("/operations/requisitions", { token: currentToken }),
                apiRequest("/operations/purchase-prices", { token: currentToken }),
                apiRequest("/operations/supplier-orders", { token: currentToken }),
                apiRequest("/operations/fulfillment-tasks", { token: currentToken }),
                apiRequest("/support-tickets", { token: currentToken }),
            ]);
            set({
                inventory: inventoryResponse.data.map(adaptInventoryItem),
                requisitions: requisitionsResponse.data.map(adaptRequisition),
                purchasePrices: purchasePricesResponse.data.map(adaptPurchasePrice),
                supplierOrders: ordersResponse.data.map(adaptOperationOrder),
                fulfillmentTasks: tasksResponse.data.map(adaptFulfillmentTask),
                supportTickets: ticketsResponse.data.map(adaptTicket),
                suppliers: buildSuppliers(inventoryResponse.data),
                productsById: buildProductsById(inventoryResponse.data),
                status: "ready",
                error: null,
            });
            return { success: true };
        }
        catch (error) {
            const message = handleError(error);
            set({ status: "error", error: message });
            return { success: false, error: message };
        }
    },
    createRequisition: async (input) => {
        const currentToken = token();
        if (!currentToken)
            return { success: false, error: authError() };
        try {
            const response = await apiRequest("/operations/requisitions", {
                method: "POST",
                token: currentToken,
                body: {
                    product_id: Number(input.productId),
                    requested_qty: input.requestedQty,
                    reason: input.note ?? null,
                },
            });
            const requisition = adaptRequisition(response.data);
            set((state) => ({
                requisitions: [requisition, ...state.requisitions],
            }));
            return { success: true, data: requisition };
        }
        catch (error) {
            return { success: false, error: handleError(error) };
        }
    },
    updateRequisitionStatus: async (requisitionId, status) => {
        const currentToken = token();
        if (!currentToken)
            return { success: false, error: authError() };
        try {
            const response = await apiRequest(`/operations/requisitions/${requisitionId}/status`, {
                method: "PATCH",
                token: currentToken,
                body: { status },
            });
            const requisition = adaptRequisition(response.data);
            set((state) => ({
                requisitions: state.requisitions.map((item) => item.id === requisition.id ? requisition : item),
            }));
            return { success: true, data: requisition };
        }
        catch (error) {
            return { success: false, error: handleError(error) };
        }
    },
    updatePurchasePrice: async (productId, purchasePrice) => {
        const currentToken = token();
        if (!currentToken)
            return { success: false, error: authError() };
        try {
            const response = await apiRequest(`/operations/inventory/${productId}/purchase-price`, {
                method: "PATCH",
                token: currentToken,
                body: { purchase_price: purchasePrice },
            });
            const item = adaptInventoryItem(response.data);
            set((state) => ({
                inventory: state.inventory.map((row) => (row.productId === item.productId ? item : row)),
            }));
            return { success: true, data: item };
        }
        catch (error) {
            return { success: false, error: handleError(error) };
        }
    },
    createPurchasePriceRecord: async (input) => {
        const currentToken = token();
        if (!currentToken)
            return { success: false, error: authError() };
        try {
            const response = await apiRequest("/operations/purchase-prices", {
                method: "POST",
                token: currentToken,
                body: {
                    product_id: Number(input.productId),
                    supplier_id: input.supplierId ? Number(input.supplierId) : null,
                    price: input.price,
                    effective_date: input.effectiveDate,
                    note: input.note || null,
                },
            });
            const record = adaptPurchasePrice(response.data);
            set((state) => ({ purchasePrices: [record, ...state.purchasePrices] }));
            // Thêm/sửa/xóa 1 dòng lịch sử giá nhập có thể làm đổi products.purchase_price
            // (cột scalar "giá hiện hành", đồng bộ lại phía backend — xem
            // recomputeCurrentPurchasePrice() ở operationController.js) -> nạp lại inventory
            // để cột "Giá nhập" trong bảng Danh mục tồn kho không hiện giá trị cũ.
            await get().loadOperations(true);
            return { success: true, data: record };
        }
        catch (error) {
            return { success: false, error: handleError(error) };
        }
    },
    updatePurchasePriceRecord: async (id, input) => {
        const currentToken = token();
        if (!currentToken)
            return { success: false, error: authError() };
        try {
            const response = await apiRequest(`/operations/purchase-prices/${id}`, {
                method: "PUT",
                token: currentToken,
                body: {
                    supplier_id: input.supplierId ? Number(input.supplierId) : null,
                    price: input.price,
                    effective_date: input.effectiveDate,
                    note: input.note ?? null,
                },
            });
            const record = adaptPurchasePrice(response.data);
            set((state) => ({
                purchasePrices: state.purchasePrices.map((row) => (row.id === record.id ? record : row)),
            }));
            await get().loadOperations(true);
            return { success: true, data: record };
        }
        catch (error) {
            return { success: false, error: handleError(error) };
        }
    },
    deletePurchasePriceRecord: async (id) => {
        const currentToken = token();
        if (!currentToken)
            return { success: false, error: authError() };
        try {
            await apiRequest(`/operations/purchase-prices/${id}`, { method: "DELETE", token: currentToken });
            set((state) => ({ purchasePrices: state.purchasePrices.filter((row) => row.id !== id) }));
            await get().loadOperations(true);
            return { success: true };
        }
        catch (error) {
            return { success: false, error: handleError(error) };
        }
    },
    updateOrderDeliveryStatus: async (orderId, deliveryStatus, note) => {
        const currentToken = token();
        if (!currentToken)
            return { success: false, error: authError() };
        try {
            const response = await apiRequest(`/operations/orders/${orderId}/delivery-status`, {
                method: "PATCH",
                token: currentToken,
                body: {
                    delivery_status: deliveryStatus,
                    note,
                },
            });
            const order = adaptOperationOrder(response.data);
            set((state) => ({
                supplierOrders: state.supplierOrders.map((item) => (item.id === order.id ? order : item)),
            }));
            return { success: true, data: order };
        }
        catch (error) {
            return { success: false, error: handleError(error) };
        }
    },
    advanceFulfillmentTask: async (taskId, note) => {
        const currentToken = token();
        if (!currentToken)
            return { success: false, error: authError() };
        try {
            const response = await apiRequest(`/operations/fulfillment-tasks/${taskId}/advance`, {
                method: "PATCH",
                token: currentToken,
                body: { note },
            });
            const task = adaptFulfillmentTask(response.data);
            set((state) => ({
                fulfillmentTasks: state.fulfillmentTasks.map((item) => (item.id === task.id ? task : item)),
            }));
            await get().loadOperations(true);
            return { success: true, data: task };
        }
        catch (error) {
            return { success: false, error: handleError(error) };
        }
    },
    createSupportTicket: async (input) => {
        const currentToken = token();
        if (!currentToken)
            return { success: false, error: authError() };
        try {
            const response = await apiRequest("/support-tickets", {
                method: "POST",
                token: currentToken,
                body: input,
            });
            const ticket = adaptTicket(response.data);
            set((state) => ({
                supportTickets: [ticket, ...state.supportTickets],
            }));
            return { success: true, data: ticket };
        }
        catch (error) {
            return { success: false, error: handleError(error) };
        }
    },
    resolveSupportTicket: async (ticketId) => {
        const currentToken = token();
        if (!currentToken)
            return { success: false, error: authError() };
        try {
            const response = await apiRequest(`/support-tickets/${ticketId}/resolve`, {
                method: "PATCH",
                token: currentToken,
            });
            const ticket = adaptTicket(response.data);
            set((state) => ({
                supportTickets: state.supportTickets.map((item) => (item.id === ticket.id ? ticket : item)),
            }));
            return { success: true, data: ticket };
        }
        catch (error) {
            return { success: false, error: handleError(error) };
        }
    },
    reset: () => set(initialState),
}));
