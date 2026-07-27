import { useEffect, useMemo, useState } from "react";
import { hasAdminPermission } from "@/shared/lib/auth";
import { customerOrderStatusLabels, customerPaymentMethodLabels, customerPaymentStatusLabels, fallbackBackendLabel, } from "@/shared/lib/customer-order-labels";
import { formatCurrency, formatDate } from "@/shared/lib/format";
import { useAdminOrdersStore } from "@/shared/lib/store/use-admin-orders-store";
import { useAdminShippingCarriersStore } from "@/shared/lib/store/use-admin-shipping-carriers-store";
import { useAuthStore } from "@/shared/lib/store/use-auth-store";
import { useFeedbackStore } from "@/shared/lib/store/use-feedback-store";
import { useGhnLocationStore } from "@/shared/lib/store/use-ghn-location-store";
import { ActionIconButton, AdminDrawer, AdminPageHeader, AdminToolbar, Badge, Button, DataTable, SurfaceCard, cn, } from "@/shared/ui";
const ORDER_STATUSES = [
    "PENDING",
    "CONFIRMED",
    "PACKED",
    "SHIPPED",
    "DELIVERED",
    "DELIVERY_FAILED",
    "CANCELLED",
];
const BULK_ACTION_LABELS = {
    CONFIRM: "Xác nhận đơn",
    SHIP: "Bàn giao vận chuyển",
    DELIVER: "Đánh dấu giao thành công",
    MARK_DELIVERY_FAILED: "Đánh dấu giao thất bại",
    CANCEL: "Hủy đơn",
    RESHIP: "Giao lại",
};
const emptyShipmentForm = {
    shippingCarrierId: "",
    trackingCode: "",
    trackingUrl: "",
    serviceTypeId: "2",
    paymentTypeId: "1",
    requiredNote: "KHONGCHOXEMHANG",
    weight: "1000",
    length: "20",
    width: "20",
    height: "10",
    shippingLine1: "",
    shippingProvinceId: "",
    shippingProvinceName: "",
    shippingDistrictId: "",
    shippingDistrictName: "",
    shippingWardCode: "",
    shippingWardName: "",
    note: "",
};
function labelForStatus(status) {
    return customerOrderStatusLabels[status] ?? fallbackBackendLabel(status);
}
function labelForPaymentStatus(status) {
    return customerPaymentStatusLabels[status] ?? fallbackBackendLabel(status);
}
function orderStatusTone(status) {
    if (status === "DELIVERED")
        return "success";
    if (status === "DELIVERY_FAILED" || status === "CANCELLED")
        return "danger";
    if (status === "SHIPPED" || status === "PACKED")
        return "primary";
    if (status === "CONFIRMED")
        return "secondary";
    return "warning";
}
function paymentStatusTone(status) {
    if (status === "SUCCESS")
        return "success";
    if (status === "FAILED" || status === "CANCELLED" || status === "REFUNDED")
        return "danger";
    if (status === "PENDING")
        return "warning";
    return "neutral";
}
function paymentInstructionValue(payload, key) {
    const value = payload?.[key];
    return typeof value === "string" ? value : "";
}
function numberFromForm(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}
// Điền sẵn form tạo vận đơn: kích thước/loại dịch vụ lấy mặc định của carrier đã chọn (nếu
// có), địa chỉ giao lấy từ chính đơn hàng (đã nhập lúc khách checkout) — admin thường không
// cần gõ lại tay, chỉ chỉnh nếu cần.
function shipmentFormFromOrder(order, carrier) {
    return {
        ...emptyShipmentForm,
        shippingCarrierId: carrier ? String(carrier.id) : "",
        serviceTypeId: String(carrier?.default_service_type_id ?? 2),
        paymentTypeId: String(carrier?.default_payment_type_id ?? 1),
        requiredNote: carrier?.default_required_note ?? "KHONGCHOXEMHANG",
        weight: String(carrier?.default_weight ?? 1000),
        length: String(carrier?.default_length ?? 20),
        width: String(carrier?.default_width ?? 20),
        height: String(carrier?.default_height ?? 10),
        shippingLine1: order.shipping_line1 ?? "",
        shippingProvinceId: order.shipping_province_id ? String(order.shipping_province_id) : "",
        shippingProvinceName: order.shipping_province_name ?? "",
        shippingDistrictId: order.shipping_district_id ? String(order.shipping_district_id) : "",
        shippingDistrictName: order.shipping_district_name ?? "",
        shippingWardCode: order.shipping_ward_code ?? "",
        shippingWardName: order.shipping_ward_name ?? "",
    };
}
// Thao tác hàng loạt hợp lệ phụ thuộc bộ lọc trạng thái đang xem — vd đang lọc "PENDING"
// thì chỉ cho Xác nhận/Hủy hàng loạt, không cho "Giao lại" (chỉ áp dụng cho DELIVERY_FAILED).
// Lọc "all" (mọi trạng thái trộn lẫn) thì cho phép mọi action, vì khó biết action nào hợp lệ
// cho TỪNG đơn trong lúc chọn — bulkUpdateStatus() phía backend sẽ tự chặn đơn nào không hợp lệ.
function bulkActionsForFilter(statusFilter) {
    switch (statusFilter) {
        case "PENDING":
            return ["CONFIRM", "CANCEL"];
        case "CONFIRMED":
            return ["CANCEL"];
        case "PACKED":
            return ["SHIP", "CANCEL"];
        case "SHIPPED":
            return ["DELIVER", "MARK_DELIVERY_FAILED"];
        case "DELIVERY_FAILED":
            return ["RESHIP", "CANCEL"];
        case "DELIVERED":
        case "CANCELLED":
            return [];
        default:
            return ["CONFIRM", "SHIP", "DELIVER", "MARK_DELIVERY_FAILED", "CANCEL", "RESHIP"];
    }
}
function FieldValue({ label, value }) {
    return (<div className="rounded-2xl bg-surface-container-low p-4 text-sm">
            <p className="text-xs font-label uppercase tracking-[0.14em] text-on-surface-variant">{label}</p>
            <p className="mt-2 font-medium text-on-surface">{value || "Chưa cập nhật"}</p>
        </div>);
}
function OrderSummaryGrid({ order }) {
    const paymentPayload = order.payment?.raw_payload ?? null;
    const transferSubmitted = Boolean(paymentPayload?.customer_transfer_submitted);
    return (<div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
                <FieldValue label="Khách hàng" value={order.customer?.full_name ?? "Khách vãng lai"}/>
                <FieldValue label="Email" value={order.customer?.email}/>
                <FieldValue label="Người nhận" value={order.recipient_name}/>
                <FieldValue label="Điện thoại" value={order.recipient_phone}/>
                <FieldValue label="Địa chỉ giao" value={order.shipping_address}/>
                <FieldValue label="Ghi chú" value={order.note}/>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <FieldValue label="Tạm tính" value={formatCurrency(Number(order.subtotal))}/>
                <FieldValue label="Phí giao" value={formatCurrency(Number(order.shipping_fee))}/>
                <FieldValue label="Tổng tiền" value={formatCurrency(Number(order.total_amount))}/>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-3 rounded-2xl bg-surface-container-low p-4 text-sm">
                    <p className="text-xs font-label uppercase tracking-[0.14em] text-on-surface-variant">
                        Vận chuyển
                    </p>
                    <p>Đơn vị: {order.shipping_carrier ?? "Chưa cập nhật"}</p>
                    <p>Mã vận đơn: {order.shipping_code ?? "Chưa tạo"}</p>
                    <p>Thời điểm giao: {order.shipped_at ? formatDate(order.shipped_at) : "Chưa giao"}</p>
                    <p>Hoàn tất: {order.delivered_at ? formatDate(order.delivered_at) : "Chưa giao xong"}</p>
                    <p>Hủy đơn: {order.cancelled_at ? formatDate(order.cancelled_at) : "Chưa hủy"}</p>
                </div>
                <div className="space-y-3 rounded-2xl bg-surface-container-low p-4 text-sm">
                    <p className="text-xs font-label uppercase tracking-[0.14em] text-on-surface-variant">
                        Thanh toán
                    </p>
                    <p>
                        Phương thức:{" "}
                        {customerPaymentMethodLabels[order.payment_method] ?? fallbackBackendLabel(order.payment_method)}
                    </p>
                    <p>Cổng: {order.payment?.gateway_name ?? "Không có"}</p>
                    <p>Mã giao dịch: {order.payment?.transaction_code ?? "Không có"}</p>
                    <p>Mã tham chiếu: {order.payment?.gateway_reference ?? "Không có"}</p>
                    <p>Thanh toán lúc: {order.payment?.paid_at ? formatDate(order.payment.paid_at) : "Chưa thanh toán"}</p>
                </div>
            </div>

            {order.payment_method === "BANK_TRANSFER" ? (<div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm">
                    <p className="font-medium">Thông tin chuyển khoản</p>
                    <div className="mt-3 space-y-2 text-on-surface-variant">
                        <p>Ngân hàng: {paymentInstructionValue(paymentPayload, "bank_name") || "MB Bank"}</p>
                        <p>Chủ tài khoản: {paymentInstructionValue(paymentPayload, "account_name") || "HERITAGE HARVEST"}</p>
                        <p>Số tài khoản: {paymentInstructionValue(paymentPayload, "account_number") || "0123456789"}</p>
                        <p>Nội dung: {paymentInstructionValue(paymentPayload, "transfer_content") || order.order_no}</p>
                        <p>Khách đã báo chuyển khoản: {transferSubmitted ? "Đã gửi" : "Chưa gửi"}</p>
                        <p>
                            Thời điểm khách báo:{" "}
                            {paymentInstructionValue(paymentPayload, "customer_transfer_submitted_at") || "Chưa có"}
                        </p>
                    </div>
                </div>) : null}
        </div>);
}
export function AdminLogisticsPage() {
    const [query, setQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [activeOrderId, setActiveOrderId] = useState("");
    const [detailOpen, setDetailOpen] = useState(false);
    const [nextStatus, setNextStatus] = useState("PENDING");
    const [nextPaymentStatus, setNextPaymentStatus] = useState("PENDING");
    const [note, setNote] = useState("");
    const [paymentNote, setPaymentNote] = useState("");
    const [shipmentForm, setShipmentForm] = useState(emptyShipmentForm);
    const [selectedOrderIds, setSelectedOrderIds] = useState([]);
    const [bulkAction, setBulkAction] = useState("");
    const [bulkResult, setBulkResult] = useState(null);
    const orders = useAdminOrdersStore((state) => state.orders);
    const orderDetails = useAdminOrdersStore((state) => state.orderDetails);
    const isLoading = useAdminOrdersStore((state) => state.isLoading);
    const isSaving = useAdminOrdersStore((state) => state.isSaving);
    const error = useAdminOrdersStore((state) => state.error);
    const loadOrders = useAdminOrdersStore((state) => state.loadOrders);
    const loadOrder = useAdminOrdersStore((state) => state.loadOrder);
    const updateStatus = useAdminOrdersStore((state) => state.updateStatus);
    const updatePaymentStatus = useAdminOrdersStore((state) => state.updatePaymentStatus);
    const createShipment = useAdminOrdersStore((state) => state.createShipment);
    const syncShipment = useAdminOrdersStore((state) => state.syncShipment);
    const cancelShipment = useAdminOrdersStore((state) => state.cancelShipment);
    const bulkUpdateStatus = useAdminOrdersStore((state) => state.bulkUpdateStatus);
    const carriers = useAdminShippingCarriersStore((state) => state.carriers);
    const loadCarriers = useAdminShippingCarriersStore((state) => state.loadCarriers);
    const provinces = useGhnLocationStore((state) => state.provinces);
    const districtsByProvince = useGhnLocationStore((state) => state.districtsByProvince);
    const wardsByDistrict = useGhnLocationStore((state) => state.wardsByDistrict);
    const loadProvinces = useGhnLocationStore((state) => state.loadProvinces);
    const loadDistricts = useGhnLocationStore((state) => state.loadDistricts);
    const loadWards = useGhnLocationStore((state) => state.loadWards);
    const pushToast = useFeedbackStore((state) => state.pushToast);
    const user = useAuthStore((state) => state.session?.user ?? null);
    const canUpdateOrderStatus = hasAdminPermission(user, "admin.orders.status.update");
    const canUpdatePaymentStatus = hasAdminPermission(user, "admin.orders.payment.update");
    const canBulkUpdateOrders = hasAdminPermission(user, "admin.orders.bulk.update");
    useEffect(() => {
        void loadOrders();
    }, [loadOrders]);
    useEffect(() => {
        void loadCarriers({ activeOnly: true });
        void loadProvinces();
    }, [loadCarriers, loadProvinces]);
    const filteredOrders = useMemo(() => {
        const keyword = query.trim().toLowerCase();
        return orders.filter((order) => {
            const matchesStatus = statusFilter === "all" ? true : order.status === statusFilter;
            const matchesKeyword = keyword.length === 0
                ? true
                : [
                    order.order_no,
                    order.customer?.full_name,
                    order.customer?.email,
                    order.shipping_code,
                    order.shipping_carrier,
                    order.payment?.transaction_code,
                ]
                    .filter(Boolean)
                    .join(" ")
                    .toLowerCase()
                    .includes(keyword);
            return matchesStatus && matchesKeyword;
        });
    }, [orders, query, statusFilter]);
    const activeOrderSummary = activeOrderId
        ? orders.find((order) => String(order.id) === activeOrderId)
        : undefined;
    const activeOrder = activeOrderId ? orderDetails[activeOrderId] : undefined;
    const selectedCarrier = carriers.find((carrier) => String(carrier.id) === shipmentForm.shippingCarrierId);
    const districts = shipmentForm.shippingProvinceId ? districtsByProvince[shipmentForm.shippingProvinceId] ?? [] : [];
    const wards = shipmentForm.shippingDistrictId ? wardsByDistrict[shipmentForm.shippingDistrictId] ?? [] : [];
    const availableBulkActions = useMemo(() => bulkActionsForFilter(statusFilter), [statusFilter]);
    const isAllFilteredSelected = filteredOrders.length > 0 && filteredOrders.every((order) => selectedOrderIds.includes(String(order.id)));
    // Chuỗi useEffect dưới đây phối hợp với nhau theo kiểu "phản ứng dây chuyền" — mỗi effect
    // chỉ lo 1 việc, kích hoạt khi 1 phần state cụ thể đổi:
    // 1) Mở drawer chi tiết (detailOpen=true) mà orderDetails[id] chưa có -> tự gọi loadOrder().
    useEffect(() => {
        if (!detailOpen || !activeOrderSummary || activeOrder) {
            return;
        }
        void loadOrder(String(activeOrderSummary.id));
    }, [activeOrder, activeOrderSummary, detailOpen, loadOrder]);
    // 2) Chi tiết đơn vừa tải xong (hoặc đổi đơn khác) -> reset lựa chọn trạng thái/ghi chú về
    //    giá trị hợp lệ ĐẦU TIÊN mà state machine cho phép, tránh giữ lựa chọn cũ của đơn trước.
    useEffect(() => {
        if (!activeOrderSummary) {
            return;
        }
        const detail = activeOrder ?? null;
        const allowedNextStatuses = detail?.allowed_next_statuses ?? [];
        const allowedPaymentStatuses = detail?.allowed_payment_statuses ?? [];
        setNextStatus(allowedNextStatuses[0] ?? activeOrderSummary.status);
        setNextPaymentStatus(allowedPaymentStatuses[0] ?? activeOrderSummary.payment?.payment_status ?? "PENDING");
        setNote("");
        setPaymentNote("");
    }, [activeOrder, activeOrderSummary]);
    // 3) Đơn CHƯA có vận đơn -> điền sẵn form tạo vận đơn từ carrier mặc định (carriers[0]).
    useEffect(() => {
        if (!activeOrder || activeOrder.shipment) {
            return;
        }
        const carrier = carriers[0] ?? null;
        setShipmentForm(shipmentFormFromOrder(activeOrder, carrier));
    }, [activeOrder, carriers]);
    // 4)+5) Chọn tỉnh/thành hoặc quận/huyện trong form vận đơn -> tự tải quận/huyện hoặc
    //    phường/xã tương ứng (dropdown địa chỉ GHN theo tầng, giống pattern ở checkout-page.jsx).
    useEffect(() => {
        if (!shipmentForm.shippingProvinceId)
            return;
        void loadDistricts(Number(shipmentForm.shippingProvinceId));
    }, [loadDistricts, shipmentForm.shippingProvinceId]);
    useEffect(() => {
        if (!shipmentForm.shippingDistrictId)
            return;
        void loadWards(Number(shipmentForm.shippingDistrictId));
    }, [loadWards, shipmentForm.shippingDistrictId]);
    // 6) Danh sách đơn hàng thay đổi (vd sau khi loadOrders() làm mới) -> bỏ khỏi selection
    //    những id không còn tồn tại trong danh sách nữa, tránh giữ selection "ma".
    useEffect(() => {
        setSelectedOrderIds((current) => current.filter((id) => orders.some((order) => String(order.id) === id)));
    }, [orders]);
    // 7) Đổi bộ lọc trạng thái -> danh sách bulk action hợp lệ đổi theo -> nếu action đang
    //    chọn không còn hợp lệ với bộ lọc mới, tự chuyển sang action đầu tiên hợp lệ (hoặc rỗng).
    useEffect(() => {
        setBulkAction((current) => {
            if (!availableBulkActions.length) {
                return "";
            }
            return current && availableBulkActions.includes(current) ? current : availableBulkActions[0];
        });
    }, [availableBulkActions]);
    function openOrder(orderId) {
        setActiveOrderId(orderId);
        setDetailOpen(true);
    }
    function updateShipmentField(key, value) {
        setShipmentForm((current) => ({
            ...current,
            [key]: value,
        }));
    }
    function handleCarrierChange(carrierId) {
        const carrier = carriers.find((item) => String(item.id) === carrierId);
        setShipmentForm((current) => ({
            ...current,
            shippingCarrierId: carrierId,
            serviceTypeId: String(carrier?.default_service_type_id ?? (current.serviceTypeId || 2)),
            paymentTypeId: String(carrier?.default_payment_type_id ?? (current.paymentTypeId || 1)),
            requiredNote: carrier?.default_required_note ?? current.requiredNote,
            weight: String(carrier?.default_weight ?? (current.weight || 1000)),
            length: String(carrier?.default_length ?? (current.length || 20)),
            width: String(carrier?.default_width ?? (current.width || 20)),
            height: String(carrier?.default_height ?? (current.height || 10)),
        }));
    }
    async function handleCreateShipment() {
        if (!canUpdateOrderStatus) {
            pushToast({ tone: "warning", message: "Bạn chưa có quyền tạo vận đơn." });
            return;
        }
        if (!activeOrder || !activeOrderSummary) {
            return;
        }
        if (activeOrder.status !== "CONFIRMED") {
            pushToast({ tone: "warning", message: "Chỉ đơn đã xác nhận mới được tạo vận đơn." });
            return;
        }
        if (!shipmentForm.shippingCarrierId) {
            pushToast({ tone: "warning", message: "Vui lòng chọn đơn vị vận chuyển." });
            return;
        }
        // 2 nhánh validate khác nhau tùy loại carrier: GHN cần đủ địa chỉ 3 cấp (tỉnh/huyện/xã)
        // để backend gọi API thật tính phí + tạo vận đơn; carrier thủ công thì không gọi API
        // nào cả nên bắt buộc admin tự nhập SẴN mã vận đơn (backend không tự sinh được mã thật).
        if (selectedCarrier?.provider === "GHN" &&
            (!shipmentForm.shippingLine1 ||
                !shipmentForm.shippingProvinceName ||
                !shipmentForm.shippingDistrictName ||
                !shipmentForm.shippingWardName)) {
            pushToast({ tone: "warning", message: "Cần bổ sung đầy đủ địa chỉ GHN trước khi tạo vận đơn." });
            return;
        }
        if (selectedCarrier?.provider !== "GHN" && !shipmentForm.trackingCode.trim()) {
            pushToast({ tone: "warning", message: "Cần nhập mã vận đơn cho carrier thủ công." });
            return;
        }
        const result = await createShipment(String(activeOrderSummary.id), {
            shipping_carrier_id: Number(shipmentForm.shippingCarrierId),
            tracking_code: shipmentForm.trackingCode.trim() || undefined,
            tracking_url: shipmentForm.trackingUrl.trim() || undefined,
            service_type_id: numberFromForm(shipmentForm.serviceTypeId),
            payment_type_id: numberFromForm(shipmentForm.paymentTypeId),
            required_note: shipmentForm.requiredNote,
            weight: numberFromForm(shipmentForm.weight),
            length: numberFromForm(shipmentForm.length),
            width: numberFromForm(shipmentForm.width),
            height: numberFromForm(shipmentForm.height),
            shipping_line1: shipmentForm.shippingLine1.trim() || undefined,
            shipping_province_id: shipmentForm.shippingProvinceId ? Number(shipmentForm.shippingProvinceId) : null,
            shipping_province_name: shipmentForm.shippingProvinceName || null,
            shipping_district_id: shipmentForm.shippingDistrictId ? Number(shipmentForm.shippingDistrictId) : null,
            shipping_district_name: shipmentForm.shippingDistrictName || null,
            shipping_ward_code: shipmentForm.shippingWardCode || null,
            shipping_ward_name: shipmentForm.shippingWardName || null,
            note: shipmentForm.note.trim() || undefined,
        });
        if (!result.success || !result.data) {
            pushToast({ tone: "warning", message: result.error ?? "Không thể tạo vận đơn." });
            return;
        }
        pushToast({ tone: "success", message: `Đã tạo vận đơn cho ${result.data.order_no}.` });
        setShipmentForm(shipmentFormFromOrder(result.data, selectedCarrier));
    }
    async function handleSyncShipment() {
        if (!activeOrderSummary)
            return;
        const result = await syncShipment(String(activeOrderSummary.id));
        if (!result.success || !result.data) {
            pushToast({ tone: "warning", message: result.error ?? "Không thể đồng bộ GHN." });
            return;
        }
        pushToast({ tone: "success", message: `Đã đồng bộ vận đơn ${result.data.order_no}.` });
    }
    async function handleCancelShipment() {
        if (!activeOrderSummary)
            return;
        const result = await cancelShipment(String(activeOrderSummary.id));
        if (!result.success || !result.data) {
            pushToast({ tone: "warning", message: result.error ?? "Không thể hủy vận đơn." });
            return;
        }
        pushToast({ tone: "success", message: `Đã hủy vận đơn ${result.data.order_no}.` });
    }
    async function handleUpdateStatus() {
        if (!canUpdateOrderStatus) {
            pushToast({ tone: "warning", message: "Bạn chưa có quyền cập nhật trạng thái đơn hàng." });
            return;
        }
        if (!activeOrderSummary || !activeOrder) {
            return;
        }
        if (!activeOrder.allowed_next_statuses.includes(nextStatus)) {
            pushToast({ tone: "warning", message: "Trạng thái đơn hàng không hợp lệ cho bước tiếp theo." });
            return;
        }
        if (nextStatus === "SHIPPED" && !activeOrder.shipment) {
            pushToast({ tone: "warning", message: "Cần tạo vận đơn trước khi bàn giao vận chuyển." });
            return;
        }
        const result = await updateStatus(String(activeOrderSummary.id), nextStatus, note);
        if (!result.success || !result.data) {
            pushToast({ tone: "warning", message: result.error ?? "Không thể cập nhật trạng thái đơn hàng." });
            return;
        }
        pushToast({
            tone: "success",
            message: `Đã cập nhật ${result.data.order_no} sang ${labelForStatus(result.data.status)}.`,
        });
        setNote("");
    }
    async function handleUpdatePaymentStatus() {
        if (!canUpdatePaymentStatus) {
            pushToast({ tone: "warning", message: "Bạn chưa có quyền cập nhật thanh toán." });
            return;
        }
        if (!activeOrderSummary || !activeOrder) {
            return;
        }
        if (!activeOrder.allowed_payment_statuses?.includes(nextPaymentStatus)) {
            pushToast({ tone: "warning", message: "Trạng thái thanh toán không hợp lệ cho bước tiếp theo." });
            return;
        }
        const result = await updatePaymentStatus(String(activeOrderSummary.id), nextPaymentStatus, paymentNote);
        if (!result.success || !result.data) {
            pushToast({ tone: "warning", message: result.error ?? "Không thể cập nhật trạng thái thanh toán." });
            return;
        }
        pushToast({
            tone: "success",
            message: `Đã cập nhật thanh toán ${result.data.order_no} sang ${labelForPaymentStatus(result.data.payment?.payment_status ?? nextPaymentStatus)}.`,
        });
        setPaymentNote("");
    }
    async function handleDeliveryFailedAction(action) {
        if (!canUpdateOrderStatus) {
            pushToast({ tone: "warning", message: "Bạn chưa có quyền cập nhật trạng thái đơn hàng." });
            return;
        }
        if (!activeOrderSummary || !activeOrder) {
            return;
        }
        if (action === "dispose" && !note.trim()) {
            pushToast({ tone: "warning", message: "Vui lòng nhập lý do khi hủy nhưng không nhập lại kho." });
            return;
        }
        const result = action === "reshop"
            ? await updateStatus(String(activeOrderSummary.id), "SHIPPED", note)
            : await updateStatus(String(activeOrderSummary.id), "CANCELLED", note, {
                restockInventory: action === "restock",
            });
        if (!result.success || !result.data) {
            pushToast({ tone: "warning", message: result.error ?? "Không thể cập nhật xử lý giao hàng thất bại." });
            return;
        }
        pushToast({
            tone: "success",
            message: action === "reshop"
                ? `Đã chuyển ${result.data.order_no} sang trạng thái ${labelForStatus(result.data.status)}.`
                : `Đã hủy ${result.data.order_no} thành công.`,
        });
        setNote("");
    }
    function toggleOrderSelection(orderId, checked) {
        setSelectedOrderIds((current) => checked ? Array.from(new Set([...current, orderId])) : current.filter((id) => id !== orderId));
    }
    function handleToggleSelectAll(checked) {
        setSelectedOrderIds((current) => {
            const filteredIds = filteredOrders.map((order) => String(order.id));
            if (checked) {
                return Array.from(new Set([...current, ...filteredIds]));
            }
            return current.filter((id) => !filteredIds.includes(id));
        });
    }
    async function handleApplyBulkAction() {
        if (!canBulkUpdateOrders) {
            pushToast({ tone: "warning", message: "Bạn chưa có quyền xử lý hàng loạt đơn hàng." });
            return;
        }
        if (!selectedOrderIds.length || !bulkAction) {
            return;
        }
        const result = await bulkUpdateStatus({
            orderIds: selectedOrderIds.map((id) => Number(id)),
            action: bulkAction,
            note: note || undefined,
        });
        if (!result.success || !result.data) {
            pushToast({ tone: "warning", message: result.error ?? "Không thể xử lý hàng loạt đơn hàng." });
            return;
        }
        setBulkResult(result.data);
        pushToast({
            tone: result.data.failed > 0 ? "warning" : "success",
            message: `Đã xử lý ${result.data.total} đơn: ${result.data.success} thành công, ${result.data.failed} thất bại.`,
        });
        // Chỉ bỏ chọn những đơn ĐÃ xử lý thành công — đơn thất bại vẫn giữ nguyên trong
        // selection để admin sửa rồi thử áp dụng lại ngay, khỏi phải chọn lại từ đầu.
        const successIds = result.data.results.filter((item) => item.success).map((item) => String(item.orderId));
        setSelectedOrderIds((current) => current.filter((id) => !successIds.includes(id)));
        // Làm mới danh sách đơn (loadOrders()) để bảng cập nhật trạng thái mới; nếu đang mở
        // drawer xem 1 đơn, gọi thêm loadOrder(). LƯU Ý: loadOrder() ưu tiên trả cache có sẵn
        // (xem use-admin-orders-store.js#loadOrder) — nếu chi tiết đơn này đã từng tải trước
        // đó, dòng dưới có thể KHÔNG lấy được bản mới nhất từ server sau bulk update.
        const refreshResult = await loadOrders();
        if (activeOrderId && refreshResult.success) {
            await loadOrder(activeOrderId);
        }
    }
    const columns = [
        ...(canBulkUpdateOrders
            ? [
                {
                    key: "select",
                    title: (<input type="checkbox" className="h-4 w-4 rounded border-outline-variant/30" checked={isAllFilteredSelected} onChange={(event) => handleToggleSelectAll(event.target.checked)} onClick={(event) => event.stopPropagation()} aria-label="Chọn tất cả đơn hàng"/>),
                    className: "w-14",
                    align: "center",
                    render: (order) => {
                        const orderId = String(order.id);
                        return (<input type="checkbox" className="h-4 w-4 rounded border-outline-variant/30" checked={selectedOrderIds.includes(orderId)} onChange={(event) => toggleOrderSelection(orderId, event.target.checked)} onClick={(event) => event.stopPropagation()} aria-label={`Chọn đơn ${order.order_no}`}/>);
                    },
                },
            ]
            : []),
        {
            key: "order",
            title: "Đơn hàng",
            render: (order) => (<div>
                    <p className="font-semibold text-on-surface">{order.order_no}</p>
                    <p className="mt-1 text-xs text-on-surface-variant">{formatDate(order.created_at)}</p>
                </div>),
        },
        {
            key: "customer",
            title: "Khách hàng",
            render: (order) => (<div>
                    <p className="font-medium">{order.customer?.full_name ?? "Khách vãng lai"}</p>
                    <p className="mt-1 text-xs text-on-surface-variant">{order.customer?.email ?? "Chưa có email"}</p>
                </div>),
        },
        {
            key: "total",
            title: "Tổng tiền",
            align: "right",
            render: (order) => <span className="font-semibold">{formatCurrency(Number(order.total_amount))}</span>,
        },
        {
            key: "status",
            title: "Trạng thái",
            render: (order) => <Badge tone={orderStatusTone(order.status)}>{labelForStatus(order.status)}</Badge>,
        },
        {
            key: "payment",
            title: "Thanh toán",
            render: (order) => {
                const status = order.payment?.payment_status;
                return <Badge tone={paymentStatusTone(status)}>{labelForPaymentStatus(status ?? "PENDING")}</Badge>;
            },
        },
        {
            key: "shipping",
            title: "Vận đơn",
            render: (order) => (<div>
                    <p className="font-medium">{order.shipping_code ?? "Chưa tạo"}</p>
                    <p className="mt-1 text-xs text-on-surface-variant">{order.shipping_carrier ?? "Chưa có DVVC"}</p>
                </div>),
        },
        {
            key: "actions",
            title: "Actions",
            align: "right",
            render: (order) => (<div className="flex justify-end gap-1">
                    <ActionIconButton label={`Xem ${order.order_no}`} icon="visibility" tone="primary" onClick={() => openOrder(String(order.id))}/>
                </div>),
        },
    ];
    return (<div className="space-y-8">
            <AdminPageHeader title="Điều phối đơn hàng" description="Lọc, xử lý trạng thái và cập nhật thanh toán cho các đơn hàng trong hệ thống."/>

            <AdminToolbar>
                <input className="w-full rounded-2xl bg-surface-container-highest px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/15" placeholder="Lọc theo mã đơn, khách hàng, email, mã vận đơn..." value={query} onChange={(event) => setQuery(event.target.value)}/>
                <select className="w-full rounded-2xl bg-surface-container-highest px-4 py-3 text-sm outline-none" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                    <option value="all">Tất cả trạng thái</option>
                    {ORDER_STATUSES.map((status) => (<option key={status} value={status}>
                            {labelForStatus(status)}
                        </option>))}
                </select>
            </AdminToolbar>

            {error ? <SurfaceCard className="text-sm text-error">{error}</SurfaceCard> : null}

            <SurfaceCard className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h3 className="font-headline text-xl font-semibold text-on-surface">Danh sách đơn hàng</h3>
                        <p className="mt-1 text-sm text-on-surface-variant">{filteredOrders.length} đơn đang hiển thị</p>
                    </div>
                </div>

                {canBulkUpdateOrders && selectedOrderIds.length > 0 ? (<div className="space-y-3 rounded-2xl border border-primary/15 bg-primary/5 p-4">
                        <div className="text-sm font-semibold text-on-surface">Đã chọn {selectedOrderIds.length} đơn</div>
                        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
                            <select className="min-w-0 flex-1 rounded-2xl bg-white px-4 py-3 text-sm outline-none" value={bulkAction} onChange={(event) => setBulkAction(event.target.value)}>
                                {availableBulkActions.length === 0 ? (<option value="">Không có thao tác phù hợp</option>) : (availableBulkActions.map((action) => (<option key={action} value={action}>
                                            {BULK_ACTION_LABELS[action]}
                                        </option>)))}
                            </select>
                            <Button onClick={() => void handleApplyBulkAction()} disabled={isSaving || !bulkAction || availableBulkActions.length === 0}>
                                {isSaving ? "Đang xử lý..." : "Áp dụng"}
                            </Button>
                            <Button variant="outline" onClick={() => setSelectedOrderIds([])} disabled={isSaving}>
                                Bỏ chọn
                            </Button>
                        </div>
                    </div>) : null}

                <DataTable rows={filteredOrders} columns={columns} getRowKey={(order) => String(order.id)} isLoading={isLoading && orders.length === 0} loadingMessage="Đang tải danh sách đơn hàng..." emptyMessage="Chưa có đơn hàng nào phù hợp với bộ lọc hiện tại." minWidth="980px" pagination={{ pageSize: 8, itemLabel: "đơn hàng" }} rowClassName={(order) => selectedOrderIds.includes(String(order.id)) ? "bg-primary/5 hover:bg-primary/10" : undefined} onRowClick={(order) => openOrder(String(order.id))}/>
            </SurfaceCard>

            <AdminDrawer open={detailOpen} mode="view" title={activeOrderSummary?.order_no ?? "Chi tiết đơn hàng"} subtitle={activeOrderSummary ? (<div className="flex flex-wrap gap-2">
                            <Badge tone={orderStatusTone(activeOrderSummary.status)}>
                                {labelForStatus(activeOrderSummary.status)}
                            </Badge>
                            <Badge tone={paymentStatusTone(activeOrderSummary.payment?.payment_status)}>
                                {labelForPaymentStatus(activeOrderSummary.payment?.payment_status ?? "PENDING")}
                            </Badge>
                        </div>) : null} onClose={() => setDetailOpen(false)} footer={<div className="flex justify-end">
                        <Button variant="outline" onClick={() => setDetailOpen(false)}>
                            Đóng
                        </Button>
                    </div>}>
                {!activeOrderSummary ? (<p className="text-sm text-on-surface-variant">Chưa chọn đơn hàng.</p>) : !activeOrder ? (<p className="text-sm text-on-surface-variant">Đang tải chi tiết đơn hàng...</p>) : (<div className="space-y-6">
                        <OrderSummaryGrid order={activeOrder}/>

                        <div className="space-y-4 rounded-2xl bg-surface-container-low p-4">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <p className="text-xs font-label uppercase tracking-[0.14em] text-on-surface-variant">
                                    Vận đơn
                                </p>
                                {activeOrder.shipment?.provider === "GHN" ? (<Button size="sm" variant="secondary" disabled={isSaving || !canUpdateOrderStatus || Boolean(activeOrder.shipment.cancelled_at)} onClick={() => void handleSyncShipment()}>
                                        Đồng bộ GHN
                                    </Button>) : null}
                            </div>

                            {activeOrder.shipment ? (<div className="space-y-4">
                                    <div className="grid gap-4 md:grid-cols-2">
                                        <FieldValue label="Đơn vị" value={activeOrder.shipment.carrier?.name ?? activeOrder.shipping_carrier}/>
                                        <FieldValue label="Mã vận đơn" value={activeOrder.shipment.tracking_code}/>
                                        <FieldValue label="Trạng thái carrier" value={activeOrder.shipment.status}/>
                                        <FieldValue label="Phí thực tế" value={activeOrder.shipment.shipping_fee !== null
                    ? formatCurrency(Number(activeOrder.shipment.shipping_fee))
                    : "Chưa có"}/>
                                        <FieldValue label="COD" value={formatCurrency(Number(activeOrder.shipment.cod_amount ?? 0))}/>
                                        <FieldValue label="Đồng bộ lúc" value={activeOrder.shipment.synced_at ? formatDate(activeOrder.shipment.synced_at) : "Chưa đồng bộ"}/>
                                    </div>
                                    {activeOrder.shipment.tracking_url ? (<a className="inline-flex text-sm font-medium text-primary hover:underline" href={activeOrder.shipment.tracking_url} target="_blank" rel="noreferrer">
                                            Mở trang tracking
                                        </a>) : null}
                                    {["CONFIRMED", "PACKED"].includes(activeOrder.status) ? (<Button variant="ghost" disabled={isSaving || !canUpdateOrderStatus || Boolean(activeOrder.shipment.cancelled_at)} onClick={() => void handleCancelShipment()}>
                                            Hủy vận đơn
                                        </Button>) : null}
                                </div>) : activeOrder.status !== "CONFIRMED" ? (<div className="rounded-2xl border border-outline-variant/20 bg-surface px-4 py-3 text-sm text-on-surface-variant">
                                    Tạo vận đơn sau khi đơn đã được xác nhận.
                                </div>) : (<div className="space-y-4">
                                    <div className="grid gap-4 md:grid-cols-2">
                                        <label className="block space-y-2 text-sm">
                                            <span className="font-medium">Đơn vị vận chuyển</span>
                                            <select className="w-full rounded-2xl bg-surface-container-highest px-4 py-3 outline-none" value={shipmentForm.shippingCarrierId} onChange={(event) => handleCarrierChange(event.target.value)}>
                                                <option value="">Chọn carrier</option>
                                                {carriers.map((carrier) => (<option key={carrier.id} value={carrier.id}>
                                                        {carrier.name} ({carrier.provider})
                                                    </option>))}
                                            </select>
                                        </label>
                                        <label className="block space-y-2 text-sm">
                                            <span className="font-medium">Ghi chú tạo vận đơn</span>
                                            <input className="w-full rounded-2xl bg-surface-container-highest px-4 py-3 outline-none" value={shipmentForm.note} onChange={(event) => updateShipmentField("note", event.target.value)}/>
                                        </label>
                                    </div>

                                    {selectedCarrier?.provider !== "GHN" ? (<div className="grid gap-4 md:grid-cols-2">
                                            <label className="block space-y-2 text-sm">
                                                <span className="font-medium">Mã vận đơn thủ công</span>
                                                <input className="w-full rounded-2xl bg-surface-container-highest px-4 py-3 outline-none" value={shipmentForm.trackingCode} onChange={(event) => updateShipmentField("trackingCode", event.target.value)}/>
                                            </label>
                                            <label className="block space-y-2 text-sm">
                                                <span className="font-medium">Tracking URL</span>
                                                <input className="w-full rounded-2xl bg-surface-container-highest px-4 py-3 outline-none" value={shipmentForm.trackingUrl} onChange={(event) => updateShipmentField("trackingUrl", event.target.value)}/>
                                            </label>
                                        </div>) : null}

                                    <div className="grid gap-4 md:grid-cols-4">
                                        {[
                    ["weight", "Cân nặng (g)"],
                    ["length", "Dài (cm)"],
                    ["width", "Rộng (cm)"],
                    ["height", "Cao (cm)"],
                ].map(([key, label]) => (<label key={key} className="block space-y-2 text-sm">
                                                <span className="font-medium">{label}</span>
                                                <input className="w-full rounded-2xl bg-surface-container-highest px-4 py-3 outline-none" type="number" min={1} value={shipmentForm[key]} onChange={(event) => updateShipmentField(key, event.target.value)}/>
                                            </label>))}
                                    </div>

                                    <div className="grid gap-4 md:grid-cols-3">
                                        <label className="block space-y-2 text-sm">
                                            <span className="font-medium">Service type</span>
                                            <input className="w-full rounded-2xl bg-surface-container-highest px-4 py-3 outline-none" type="number" min={1} value={shipmentForm.serviceTypeId} onChange={(event) => updateShipmentField("serviceTypeId", event.target.value)}/>
                                        </label>
                                        <label className="block space-y-2 text-sm">
                                            <span className="font-medium">Payment type</span>
                                            <input className="w-full rounded-2xl bg-surface-container-highest px-4 py-3 outline-none" type="number" min={1} value={shipmentForm.paymentTypeId} onChange={(event) => updateShipmentField("paymentTypeId", event.target.value)}/>
                                        </label>
                                        <label className="block space-y-2 text-sm">
                                            <span className="font-medium">Required note</span>
                                            <select className="w-full rounded-2xl bg-surface-container-highest px-4 py-3 outline-none" value={shipmentForm.requiredNote} onChange={(event) => updateShipmentField("requiredNote", event.target.value)}>
                                                <option value="KHONGCHOXEMHANG">KHONGCHOXEMHANG</option>
                                                <option value="CHOTHUHANG">CHOTHUHANG</option>
                                                <option value="CHOXEMHANGKHONGTHU">CHOXEMHANGKHONGTHU</option>
                                            </select>
                                        </label>
                                    </div>

                                    <div className="grid gap-4 md:grid-cols-2">
                                        <label className="block space-y-2 text-sm md:col-span-2">
                                            <span className="font-medium">Địa chỉ chi tiết</span>
                                            <input className="w-full rounded-2xl bg-surface-container-highest px-4 py-3 outline-none" value={shipmentForm.shippingLine1} onChange={(event) => updateShipmentField("shippingLine1", event.target.value)}/>
                                        </label>
                                        <label className="block space-y-2 text-sm">
                                            <span className="font-medium">Tỉnh/thành</span>
                                            <select className="w-full rounded-2xl bg-surface-container-highest px-4 py-3 outline-none" value={shipmentForm.shippingProvinceId} onChange={(event) => {
                    const province = provinces.find((item) => String(item.ProvinceID) === event.target.value);
                    setShipmentForm((current) => ({
                        ...current,
                        shippingProvinceId: event.target.value,
                        shippingProvinceName: province?.ProvinceName ?? "",
                        shippingDistrictId: "",
                        shippingDistrictName: "",
                        shippingWardCode: "",
                        shippingWardName: "",
                    }));
                }}>
                                                <option value="">Chọn tỉnh/thành</option>
                                                {provinces.map((province) => (<option key={province.ProvinceID} value={province.ProvinceID}>
                                                        {province.ProvinceName}
                                                    </option>))}
                                            </select>
                                        </label>
                                        <label className="block space-y-2 text-sm">
                                            <span className="font-medium">Quận/huyện</span>
                                            <select className="w-full rounded-2xl bg-surface-container-highest px-4 py-3 outline-none" value={shipmentForm.shippingDistrictId} disabled={!shipmentForm.shippingProvinceId} onChange={(event) => {
                    const district = districts.find((item) => String(item.DistrictID) === event.target.value);
                    setShipmentForm((current) => ({
                        ...current,
                        shippingDistrictId: event.target.value,
                        shippingDistrictName: district?.DistrictName ?? "",
                        shippingWardCode: "",
                        shippingWardName: "",
                    }));
                }}>
                                                <option value="">Chọn quận/huyện</option>
                                                {districts.map((district) => (<option key={district.DistrictID} value={district.DistrictID}>
                                                        {district.DistrictName}
                                                    </option>))}
                                            </select>
                                        </label>
                                        <label className="block space-y-2 text-sm">
                                            <span className="font-medium">Phường/xã</span>
                                            <select className="w-full rounded-2xl bg-surface-container-highest px-4 py-3 outline-none" value={shipmentForm.shippingWardCode} disabled={!shipmentForm.shippingDistrictId} onChange={(event) => {
                    const ward = wards.find((item) => item.WardCode === event.target.value);
                    setShipmentForm((current) => ({
                        ...current,
                        shippingWardCode: event.target.value,
                        shippingWardName: ward?.WardName ?? "",
                    }));
                }}>
                                                <option value="">Chọn phường/xã</option>
                                                {wards.map((ward) => (<option key={ward.WardCode} value={ward.WardCode}>
                                                        {ward.WardName}
                                                    </option>))}
                                            </select>
                                        </label>
                                    </div>

                                    <Button disabled={isSaving || !canUpdateOrderStatus || !shipmentForm.shippingCarrierId} onClick={() => void handleCreateShipment()}>
                                        {isSaving ? "Đang tạo..." : "Tạo vận đơn"}
                                    </Button>
                                </div>)}
                        </div>

                        <div className="space-y-3 rounded-2xl bg-surface-container-low p-4">
                            <p className="text-xs font-label uppercase tracking-[0.14em] text-on-surface-variant">
                                Sản phẩm trong đơn
                            </p>
                            {activeOrder.items.map((item) => (<div key={item.id} className="flex items-start justify-between gap-4 border-b border-outline-variant/15 pb-3 last:border-0 last:pb-0">
                                    <div>
                                        <p className="font-medium">{item.product_name_snapshot}</p>
                                        <p className="text-sm text-on-surface-variant">
                                            {item.quantity} x {formatCurrency(Number(item.unit_price))}
                                        </p>
                                    </div>
                                    <span className="text-sm font-semibold text-primary">
                                        {formatCurrency(Number(item.line_total))}
                                    </span>
                                </div>))}
                        </div>

                        <div className="space-y-4 rounded-2xl bg-surface-container-low p-4">
                            <p className="text-xs font-label uppercase tracking-[0.14em] text-on-surface-variant">
                                Cập nhật trạng thái đơn
                            </p>
                            {activeOrder.status === "DELIVERY_FAILED" ? (<div className="space-y-4">
                                    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                                        Đơn giao thất bại. Cần kiểm tra chất lượng hàng hoàn trước khi nhập lại kho.
                                    </div>
                                    <div className="flex flex-col gap-3 lg:flex-row lg:flex-nowrap">
                                        <Button className="lg:flex-1" onClick={() => void handleDeliveryFailedAction("reshop")} disabled={isSaving || !canUpdateOrderStatus}>
                                            {isSaving ? "Đang cập nhật..." : "Giao lại"}
                                        </Button>
                                        <Button variant="secondary" className="lg:flex-1" onClick={() => void handleDeliveryFailedAction("restock")} disabled={isSaving || !canUpdateOrderStatus}>
                                            Hủy và nhập lại kho
                                        </Button>
                                        <button type="button" className="rounded-full border border-error/25 px-5 py-3 text-sm font-semibold text-error disabled:opacity-50 lg:flex-1" disabled={isSaving || !canUpdateOrderStatus} onClick={() => void handleDeliveryFailedAction("dispose")}>
                                            Hủy không nhập kho
                                        </button>
                                    </div>
                                </div>) : (<div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                                    <select className="min-w-0 flex-1 rounded-2xl bg-surface-container-highest px-4 py-3 text-sm outline-none" value={nextStatus} disabled={!canUpdateOrderStatus} onChange={(event) => setNextStatus(event.target.value)}>
                                        {activeOrder.allowed_next_statuses.length === 0 ? (<option value={activeOrder.status}>{labelForStatus(activeOrder.status)}</option>) : (activeOrder.allowed_next_statuses.map((status) => (<option key={status} value={status}>
                                                    {labelForStatus(status)}
                                                </option>)))}
                                    </select>
                                    <Button onClick={() => void handleUpdateStatus()} disabled={isSaving ||
                    activeOrder.allowed_next_statuses.length === 0 ||
                    !canUpdateOrderStatus}>
                                        {isSaving ? "Đang cập nhật..." : "Lưu trạng thái đơn"}
                                    </Button>
                                </div>)}
                            <textarea className="min-h-24 w-full rounded-2xl bg-surface-container-highest px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/15" disabled={!canUpdateOrderStatus} placeholder={activeOrder.status === "DELIVERY_FAILED"
                ? "Ghi chú xử lý giao thất bại hoặc lý do không nhập lại kho"
                : "Ghi chú cho lịch sử trạng thái đơn"} value={note} onChange={(event) => setNote(event.target.value)}/>
                        </div>

                        <div className="space-y-4 rounded-2xl bg-surface-container-low p-4">
                            <p className="text-xs font-label uppercase tracking-[0.14em] text-on-surface-variant">
                                Cập nhật thanh toán
                            </p>
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                                <select className="min-w-0 flex-1 rounded-2xl bg-surface-container-highest px-4 py-3 text-sm outline-none" value={nextPaymentStatus} disabled={!canUpdatePaymentStatus} onChange={(event) => setNextPaymentStatus(event.target.value)}>
                                    {activeOrder.allowed_payment_statuses?.length ? (activeOrder.allowed_payment_statuses.map((status) => (<option key={status} value={status}>
                                                {labelForPaymentStatus(status)}
                                            </option>))) : (<option value={activeOrder.payment?.payment_status ?? "PENDING"}>
                                            {labelForPaymentStatus(activeOrder.payment?.payment_status ?? "PENDING")}
                                        </option>)}
                                </select>
                                <Button onClick={() => void handleUpdatePaymentStatus()} disabled={isSaving ||
                !activeOrder.allowed_payment_statuses?.length ||
                !canUpdatePaymentStatus}>
                                    {isSaving ? "Đang cập nhật..." : "Lưu thanh toán"}
                                </Button>
                            </div>
                            <textarea className="min-h-24 w-full rounded-2xl bg-surface-container-highest px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/15" disabled={!canUpdatePaymentStatus} placeholder="Ghi chú cho lịch sử thanh toán" value={paymentNote} onChange={(event) => setPaymentNote(event.target.value)}/>
                        </div>

                        <div className="space-y-3">
                            <p className="text-xs font-label uppercase tracking-[0.14em] text-on-surface-variant">
                                Lịch sử trạng thái đơn
                            </p>
                            {activeOrder.status_history.map((history) => (<div key={history.id} className="rounded-2xl bg-surface-container-low p-4 text-sm">
                                    <p className="font-medium">
                                        {(history.from_status ? `${labelForStatus(history.from_status)} -> ` : "") +
                    labelForStatus(history.to_status)}
                                    </p>
                                    <p className="mt-1 text-on-surface-variant">{formatDate(history.changed_at)}</p>
                                    {history.note ? <p className="mt-2 text-on-surface-variant">{history.note}</p> : null}
                                </div>))}
                        </div>

                        <div className="space-y-3">
                            <p className="text-xs font-label uppercase tracking-[0.14em] text-on-surface-variant">
                                Lịch sử thanh toán
                            </p>
                            {activeOrder.payment_status_history.map((history) => (<div key={history.id} className="rounded-2xl bg-surface-container-low p-4 text-sm">
                                    <p className="font-medium">
                                        {(history.from_status
                    ? `${labelForPaymentStatus(history.from_status)} -> `
                    : "") + labelForPaymentStatus(history.to_status)}
                                    </p>
                                    <p className="mt-1 text-on-surface-variant">{formatDate(history.changed_at)}</p>
                                    {history.note ? <p className="mt-2 text-on-surface-variant">{history.note}</p> : null}
                                </div>))}
                        </div>
                    </div>)}
            </AdminDrawer>

            {bulkResult ? (<div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-6">
                    <div className="max-h-[88vh] w-full max-w-3xl overflow-y-auto rounded-[1.5rem] bg-white p-6 shadow-2xl">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <h3 className="text-xl font-semibold text-on-surface">Kết quả xử lý</h3>
                                <p className="mt-2 text-sm text-on-surface-variant">
                                    Đã xử lý {bulkResult.total} đơn: {bulkResult.success} thành công,{" "}
                                    {bulkResult.failed} thất bại.
                                </p>
                            </div>
                            <button type="button" className="rounded-full bg-surface-container px-4 py-2 text-sm font-medium" onClick={() => setBulkResult(null)}>
                                Đóng
                            </button>
                        </div>

                        <div className="mt-6 space-y-3">
                            {bulkResult.results.map((item) => (<div key={`${item.orderId}-${item.orderNo}`} className={cn("rounded-2xl border px-4 py-4 text-sm", item.success
                    ? "border-green-200 bg-green-50 text-green-900"
                    : "border-red-200 bg-red-50 text-red-900")}>
                                    <p className="font-semibold">
                                        {item.orderNo ?? `Đơn #${item.orderId}`}:{" "}
                                        {item.success ? "Thành công" : "Thất bại"}
                                    </p>
                                    <p className="mt-1">{item.message}</p>
                                </div>))}
                        </div>
                    </div>
                </div>) : null}
        </div>);
}
