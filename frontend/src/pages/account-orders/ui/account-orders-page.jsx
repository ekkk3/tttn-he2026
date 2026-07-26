import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { routes } from "@/shared/config/routes";
import { customerOrderStatusLabels, customerPaymentMethodLabels, customerPaymentStatusLabels, fallbackBackendLabel, } from "@/shared/lib/customer-order-labels";
import { formatCurrency, formatDate, formatDateTime } from "@/shared/lib/format";
import { useAccountStore } from "@/shared/lib/store/use-account-store";
import { useCartStore } from "@/shared/lib/store/use-cart-store";
import { useCustomerOrdersStore } from "@/shared/lib/store/use-customer-orders-store";
import { Icon } from "@/shared/ui";
const ORDER_TIMELINE = [
    { id: "PENDING", label: "Chờ xác nhận" },
    { id: "CONFIRMED", label: "Đã xác nhận" },
    { id: "PACKED", label: "Đã đóng gói" },
    { id: "SHIPPED", label: "Đang giao" },
    { id: "DELIVERED", label: "Đã giao" },
];
const CUSTOMER_CANCEL_REASONS = [
    "Đặt nhầm sản phẩm",
    "Muốn thay đổi địa chỉ",
    "Muốn thay đổi phương thức thanh toán",
    "Không còn nhu cầu",
    "Lý do khác",
];
function paymentInstructionValue(payload, key) {
    const value = payload?.[key];
    return typeof value === "string" ? value : "";
}
function timelineState(orderStatus, step) {
    if (orderStatus === "CANCELLED") {
        return step === "PENDING" ? "done" : "idle";
    }
    if (orderStatus === "DELIVERED") {
        return ORDER_TIMELINE.some((item) => item.id === step) ? "done" : "idle";
    }
    if (orderStatus === "DELIVERY_FAILED") {
        return step === "PENDING" || step === "CONFIRMED" || step === "PACKED" || step === "SHIPPED"
            ? "done"
            : "idle";
    }
    const currentIndex = ORDER_TIMELINE.findIndex((item) => item.id === orderStatus);
    const stepIndex = ORDER_TIMELINE.findIndex((item) => item.id === step);
    if (currentIndex === -1 || stepIndex === -1) {
        return "idle";
    }
    if (stepIndex < currentIndex) {
        return "done";
    }
    if (stepIndex === currentIndex) {
        return currentIndex === 0 ? "current" : "done";
    }
    return "idle";
}
function canShowPayAgain(order) {
    return (order.status === "CANCELLED" ||
        order.payment?.paymentStatus === "FAILED" ||
        (order.paymentMethod === "BANK_TRANSFER" && order.payment?.paymentStatus === "PENDING"));
}
function canCancelCustomerOrder(status) {
    return status === "PENDING" || status === "CONFIRMED";
}
export function AccountOrdersPage() {
    const navigate = useNavigate();
    const { orderId } = useParams();
    const addItem = useCartStore((state) => state.addItem);
    const profile = useAccountStore((state) => state.profile);
    const loadProfile = useAccountStore((state) => state.loadProfile);
    const rewards = useAccountStore((state) => state.rewardSnapshot);
    const orders = useCustomerOrdersStore((state) => state.orders);
    const orderDetails = useCustomerOrdersStore((state) => state.orderDetails);
    const pagination = useCustomerOrdersStore((state) => state.pagination);
    const isLoading = useCustomerOrdersStore((state) => state.isLoading);
    const isSubmitting = useCustomerOrdersStore((state) => state.isSubmitting);
    const error = useCustomerOrdersStore((state) => state.error);
    const loadOrders = useCustomerOrdersStore((state) => state.loadOrders);
    const loadOrder = useCustomerOrdersStore((state) => state.loadOrder);
    const cancelOrder = useCustomerOrdersStore((state) => state.cancelOrder);
    const confirmBankTransferSubmitted = useCustomerOrdersStore((state) => state.confirmBankTransferSubmitted);
    const confirmDelivery = useCustomerOrdersStore((state) => state.confirmDelivery);
    const [activeOrderId, setActiveOrderId] = useState(orderId ?? "");
    const [statusFilter, setStatusFilter] = useState("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [showFilterBar, setShowFilterBar] = useState(true);
    const [reorderMessage, setReorderMessage] = useState("");
    const [actionMessage, setActionMessage] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
    const [cancelReason, setCancelReason] = useState(CUSTOMER_CANCEL_REASONS[0]);
    const [cancelNote, setCancelNote] = useState("");
    useEffect(() => {
        void loadProfile();
    }, [loadProfile]);
    useEffect(() => {
        void loadOrders(currentPage);
    }, [currentPage, loadOrders]);
    useEffect(() => {
        if (!orderId) {
            return;
        }
        setActiveOrderId(orderId);
        setIsDetailModalOpen(true);
    }, [orderId]);
    const availableStatuses = useMemo(() => Array.from(new Set(orders.map((order) => order.status))), [orders]);
    const filteredOrders = useMemo(() => {
        const normalizedQuery = searchQuery.trim().toLowerCase();
        return orders.filter((order) => {
            const matchesStatus = statusFilter === "all" ? true : order.status === statusFilter;
            const matchesQuery = normalizedQuery.length === 0
                ? true
                : [order.orderNo, order.id, order.status, order.payment?.paymentStatus]
                    .filter(Boolean)
                    .join(" ")
                    .toLowerCase()
                    .includes(normalizedQuery);
            return matchesStatus && matchesQuery;
        });
    }, [orders, searchQuery, statusFilter]);
    const activeOrderSummary = filteredOrders.find((order) => order.id === activeOrderId) ?? filteredOrders[0];
    const activeOrder = activeOrderSummary ? orderDetails[activeOrderSummary.id] : undefined;
    useEffect(() => {
        if (filteredOrders.length === 0) {
            setActiveOrderId("");
            setIsDetailModalOpen(false);
            return;
        }
        if (filteredOrders.some((order) => order.id === activeOrderId)) {
            return;
        }
        setActiveOrderId(filteredOrders[0].id);
    }, [activeOrderId, filteredOrders]);
    useEffect(() => {
        if (!activeOrderSummary || activeOrder) {
            return;
        }
        void loadOrder(activeOrderSummary.id);
    }, [activeOrder, activeOrderSummary, loadOrder]);
    useEffect(() => {
        setReorderMessage("");
        setActionMessage("");
        setIsCancelModalOpen(false);
        setCancelReason(CUSTOMER_CANCEL_REASONS[0]);
        setCancelNote("");
    }, [activeOrderId]);
    async function handleReorder(goToCheckout) {
        if (!activeOrder) {
            return;
        }
        for (const item of activeOrder.items) {
            const result = await addItem(item.productId, item.quantity);
            if (!result.success) {
                setReorderMessage(result.error ?? "Không thể thêm lại sản phẩm trong đơn vào giỏ hàng.");
                return;
            }
        }
        setReorderMessage(`Đã thêm lại ${activeOrder.items.length} sản phẩm vào giỏ hàng.`);
        if (goToCheckout) {
            void navigate(routes.checkout);
        }
    }
    function openOrderDetail(nextOrderId) {
        setActiveOrderId(nextOrderId);
        setIsDetailModalOpen(true);
        void loadOrder(nextOrderId);
        void navigate(routes.accountOrderDetail(nextOrderId));
    }
    function closeOrderDetail() {
        setIsDetailModalOpen(false);
        void navigate(routes.accountOrders, { replace: true });
    }
    async function handleConfirmTransfer() {
        if (!activeOrder) {
            return;
        }
        const result = await confirmBankTransferSubmitted(activeOrder.id);
        setActionMessage(result.success
            ? "Cảm ơn bạn. Admin sẽ kiểm tra giao dịch và xác nhận thanh toán."
            : result.error ?? "Không thể gửi xác nhận chuyển khoản.");
    }
    async function handleConfirmDelivered() {
        if (!activeOrder) {
            return;
        }
        const result = await confirmDelivery(activeOrder.id);
        setActionMessage(result.success
            ? "Bạn đã xác nhận nhận được hàng thành công."
            : result.error ?? "Không thể xác nhận đã nhận hàng.");
    }
    async function handleCancelOrder() {
        if (!activeOrder) {
            return;
        }
        if (cancelReason === "Lý do khác" && !cancelNote.trim()) {
            setActionMessage("Vui lòng nhập ghi chú cho lý do hủy đơn.");
            return;
        }
        const result = await cancelOrder(activeOrder.id, {
            reason: cancelReason,
            note: cancelNote,
        });
        setActionMessage(result.success
            ? "Đơn hàng đã được hủy thành công."
            : result.error ?? "Không thể hủy đơn hàng.");
        if (result.success) {
            setIsCancelModalOpen(false);
            setCancelReason(CUSTOMER_CANCEL_REASONS[0]);
            setCancelNote("");
        }
    }
    if (!isLoading && orders.length === 0 && error) {
        return (<div className="mx-auto max-w-7xl px-6 pb-16 pt-24">
                <div className="rounded-xl bg-surface-container-low p-10 text-center">
                    <h1 className="font-headline text-3xl font-bold tracking-tight">Không thể tải đơn hàng</h1>
                    <p className="mt-3 text-on-surface-variant">{error}</p>
                    <button className="mt-6 rounded-full bg-primary px-6 py-3 font-semibold text-on-primary" onClick={() => void loadOrders(currentPage)}>
                        Thử tải lại
                    </button>
                </div>
            </div>);
    }
    if (!isLoading && orders.length === 0) {
        return (<div className="mx-auto max-w-7xl px-6 pb-16 pt-24">
                <div className="rounded-xl bg-surface-container-low p-10 text-center">
                    <h1 className="font-headline text-3xl font-bold tracking-tight">Chưa có đơn hàng nào</h1>
                    <p className="mt-3 text-on-surface-variant">
                        Sau khi đặt hàng thành công, đơn sẽ xuất hiện tại đây và được cập nhật trạng thái mới nhất.
                    </p>
                    <button className="mt-6 rounded-full bg-primary px-6 py-3 font-semibold text-on-primary" onClick={() => void navigate(routes.products)}>
                        Mở cửa hàng
                    </button>
                </div>
            </div>);
    }
    const paymentPayload = activeOrder?.payment?.rawPayload ?? null;
    const transferSubmitted = Boolean(paymentPayload?.customer_transfer_submitted);
    return (<div className="mx-auto flex max-w-screen-2xl flex-col gap-8 px-6 pb-16 pt-24 md:flex-row">
            <aside className="flex w-full flex-col gap-6 md:w-80">
                <div className="rounded-xl bg-surface-container-lowest p-8">
                    <div className="flex flex-col items-center space-y-4 text-center">
                        <div className="h-24 w-24 overflow-hidden rounded-full bg-surface-container">
                            <img src={profile.avatar || "https://placehold.co/192x192?text=Avatar"} alt={profile.name || "Ảnh đại diện khách hàng"} className="h-full w-full object-cover"/>
                        </div>
                        <div>
                            <h2 className="font-headline text-xl font-bold text-on-surface">
                                {profile.name || "Khách hàng"}
                            </h2>
                            <p className="text-sm text-on-surface-variant">
                                {profile.memberSince
            ? `Thành viên từ ${formatDate(profile.memberSince)}`
            : "Hồ sơ tài khoản đang được cập nhật"}
                            </p>
                        </div>
                    </div>
                    <div className="mt-8 space-y-2">
                        <div className="flex items-center gap-3 rounded-lg bg-white px-4 py-3 font-semibold text-green-800 shadow-sm">
                            <Icon name="shopping_bag"/>
                            <span className="text-sm">Đơn hàng</span>
                        </div>
                        <button className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-zinc-600 transition-transform hover:translate-x-1 hover:bg-zinc-100" onClick={() => void navigate(routes.accountProfile)}>
                            <Icon name="person"/>
                            <span className="text-sm">Thông tin cá nhân</span>
                        </button>
                        <button className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-zinc-600 transition-transform hover:translate-x-1 hover:bg-zinc-100" onClick={() => void navigate(routes.accountDisputes)}>
                            <Icon name="gavel"/>
                            <span className="text-sm">Khiếu nại và hỗ trợ</span>
                        </button>
                    </div>
                </div>

                <div className="relative overflow-hidden rounded-xl bg-tertiary-container p-6 text-on-tertiary-container">
                    <div className="relative z-10">
                        <h3 className="mb-2 text-lg font-bold">Điểm thưởng hội viên</h3>
                        <p className="mb-4 text-xs opacity-90">
                            Bạn đang có {rewards.points} điểm thưởng trên tài khoản.
                        </p>
                        <button className="rounded-full bg-white px-4 py-2 text-xs font-bold uppercase tracking-wider text-tertiary-container" onClick={() => void navigate(routes.accountRewards)}>
                            Mở khu thưởng
                        </button>
                    </div>
                    <div className="absolute -bottom-4 -right-4 rotate-12 opacity-20">
                        <Icon name="stars" className="text-8xl" fill/>
                    </div>
                </div>
            </aside>

            <section className="flex-1 space-y-8">
                <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                    <div>
                        <h1 className="font-headline text-2xl font-bold tracking-tight">Lịch sử đơn hàng</h1>
                        
                    </div>
                    <div className="flex items-center gap-3 self-start sm:self-auto">
                        <button className="inline-flex items-center gap-2 rounded-full border border-outline-variant/20 bg-surface-container-lowest px-5 py-2.5 text-sm font-semibold text-on-surface transition hover:border-primary/30 hover:text-primary" onClick={() => setShowFilterBar((value) => !value)}>
                            <Icon name="filter_list" className="text-sm"/>
                            {showFilterBar ? "Ẩn bộ lọc" : "Hiện bộ lọc"}
                        </button>
                    </div>
                </header>

                <div className="overflow-hidden rounded-xl bg-surface-container-lowest">
                    {showFilterBar ? (<div className="border-b border-outline-variant/15 bg-gradient-to-r from-surface-container-lowest to-surface-container-low p-6">
                            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                                <input className="w-full rounded-2xl border border-outline-variant/10 bg-white px-4 py-3 text-sm shadow-sm outline-none focus:border-primary/30 focus:ring-2 focus:ring-primary/10" placeholder="Tìm theo mã đơn hoặc trạng thái..." value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)}/>
                                <div className="flex min-w-[17rem] items-center gap-3 rounded-2xl border border-outline-variant/10 bg-white px-4 py-3 shadow-sm">
                                    <span className="whitespace-nowrap text-sm font-semibold text-on-surface">
                                        Trạng thái
                                    </span>
                                    <select className="min-w-0 flex-1 rounded-xl bg-surface-container-low px-3 py-2 text-sm font-medium text-on-surface outline-none" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                                        <option value="all">Tất cả</option>
                                        {availableStatuses.map((status) => (<option key={status} value={status}>
                                                {customerOrderStatusLabels[status] ?? fallbackBackendLabel(status)}
                                            </option>))}
                                    </select>
                                </div>
                            </div>
                        </div>) : null}

                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-left">
                            <thead className="border-b border-outline-variant/15 bg-surface-container-low">
                                <tr>
                                    {["Mã đơn", "Ngày", "Tổng tiền", "Trạng thái", "Thanh toán", "Thao tác"].map((title) => (<th key={title} className="px-6 py-4 text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
                                                {title}
                                            </th>))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-outline-variant/10">
                                {filteredOrders.map((order) => (<tr key={order.id} className="transition-colors hover:bg-surface-container-low">
                                        <td className="px-6 py-5 text-sm font-bold">{order.orderNo}</td>
                                        <td className="px-6 py-5 text-sm text-on-surface-variant">
                                            {formatDate(order.createdAt)}
                                        </td>
                                        <td className="px-6 py-5 text-sm font-medium">
                                            {formatCurrency(order.totalAmount)}
                                        </td>
                                        <td className="px-6 py-5 text-sm text-on-surface-variant">
                                            {customerOrderStatusLabels[order.status] ?? fallbackBackendLabel(order.status)}
                                        </td>
                                        <td className="px-6 py-5 text-sm text-on-surface-variant">
                                            {order.payment
                ? customerPaymentStatusLabels[order.payment.paymentStatus] ??
                    fallbackBackendLabel(order.payment.paymentStatus)
                : "Chưa có"}
                                        </td>
                                        <td className="px-6 py-5 text-right">
                                            <button className="text-sm font-medium text-primary hover:underline" onClick={() => openOrderDetail(order.id)}>
                                                Xem chi tiết
                                            </button>
                                        </td>
                                    </tr>))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {pagination && pagination.lastPage > 1 ? (<div className="flex items-center justify-end gap-3">
                        <button className="rounded-full border border-outline-variant/20 px-4 py-2 text-sm text-on-surface-variant disabled:opacity-40" disabled={pagination.currentPage <= 1} onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}>
                            Trang trước
                        </button>
                        <span className="text-sm text-on-surface-variant">
                            Trang {pagination.currentPage} / {pagination.lastPage}
                        </span>
                        <button className="rounded-full border border-outline-variant/20 px-4 py-2 text-sm text-on-surface-variant disabled:opacity-40" disabled={pagination.currentPage >= pagination.lastPage} onClick={() => setCurrentPage((page) => Math.min(pagination.lastPage, page + 1))}>
                            Trang sau
                        </button>
                    </div>) : null}

                {reorderMessage ? (<div className="rounded-xl bg-on-primary-container p-4 text-sm text-primary">
                        {reorderMessage}
                    </div>) : null}
            </section>

            {isDetailModalOpen && activeOrderSummary ? (<div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4 py-4">
                    <div className="max-h-[88vh] w-full max-w-5xl overflow-y-auto rounded-[1.5rem] bg-white p-5 shadow-2xl">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <p className="text-xs uppercase tracking-[0.24em] text-primary">Chi tiết đơn hàng</p>
                                <h2 className="mt-2 text-lg font-semibold text-on-surface">
                                    Mã đơn {activeOrderSummary.orderNo}
                                </h2>
                            </div>
                            <button className="rounded-full bg-surface-container px-4 py-2 text-sm font-medium" onClick={closeOrderDetail}>
                                Đóng
                            </button>
                        </div>

                        {!activeOrder ? (<div className="mt-6 rounded-2xl bg-surface-container-low p-5 text-sm text-on-surface-variant">
                                Đang tải chi tiết đơn hàng...
                            </div>) : (<>
                                <div className="mt-8 rounded-[1.75rem] border border-outline-variant/15 bg-surface-container-low p-6">
                                    <div className="relative mx-auto flex w-full max-w-5xl flex-wrap items-start justify-between gap-6">
                                        <div className="absolute left-0 right-0 top-5 hidden h-[2px] bg-outline-variant/20 md:block"/>
                                        {ORDER_TIMELINE.map((step, index) => {
                    const state = timelineState(activeOrder.status, step.id);
                    return (<div key={step.id} className="relative z-10 flex flex-1 flex-col items-center gap-3 text-center">
                                                    <div className={`flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-bold ${state === "done"
                            ? "border-primary bg-primary text-on-primary"
                            : state === "current"
                                ? "border-secondary bg-secondary text-on-secondary"
                                : "border-outline-variant/35 bg-white text-on-surface-variant"}`}>
                                                        {state === "done" ? "✓" : index + 1}
                                                    </div>
                                                    <div>
                                                        <p className="mt-1 text-sm font-semibold text-on-surface">
                                                            {step.label}
                                                        </p>
                                                    </div>
                                                </div>);
                })}
                                    </div>
                                </div>

                                {activeOrder.status === "CANCELLED" ? (<div className="mt-4 rounded-2xl border border-error/20 bg-error-container/60 px-4 py-3 text-sm text-error">
                                        Đơn hàng đã hủy.
                                    </div>) : null}
                                {activeOrder.status === "DELIVERY_FAILED" ? (<div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                                        Giao hàng thất bại. Đơn đang chờ admin xử lý giao lại hoặc hủy.
                                    </div>) : null}
                                {(activeOrder.status === "PACKED" || activeOrder.status === "SHIPPED") ? (<div className="mt-4 rounded-2xl border border-primary/15 bg-primary/5 px-4 py-3 text-sm text-on-surface">
                                        Đơn hàng đã được đóng gói hoặc đang giao, bạn không thể tự hủy. Vui lòng liên hệ hỗ trợ nếu cần xử lý.
                                    </div>) : null}

                                <div className="mt-6 grid gap-5 lg:grid-cols-2">
                                    <div className="rounded-[1.5rem] bg-surface-container-low p-5">
                                        <p className="text-center text-xs uppercase tracking-[0.18em] text-on-surface-variant">
                                            Tuyến vận chuyển
                                        </p>
                                        <div className="mt-4 flex items-start justify-between gap-2">
                                            <div className="flex flex-1 flex-col items-center gap-2 text-center">
                                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                                                    <Icon name="warehouse"/>
                                                </div>
                                                <p className="text-xs font-semibold text-on-surface">Kho Heritage Harvest</p>
                                                <p className="text-[11px] text-on-surface-variant">Nơi xuất hàng</p>
                                            </div>
                                            <div className="mt-3 flex flex-1 flex-col items-center gap-1">
                                                <Icon name={activeOrder.status === "DELIVERED" ? "check_circle" : "local_shipping"} className={activeOrder.status === "DELIVERED" ? "text-primary" : "text-secondary"}/>
                                                <div className="h-[2px] w-full bg-outline-variant/30"/>
                                                <p className="text-[11px] text-on-surface-variant">
                                                    {activeOrder.shippingCarrier ?? "Chưa gán đơn vị vận chuyển"}
                                                </p>
                                            </div>
                                            <div className="flex flex-1 flex-col items-center gap-2 text-center">
                                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary/10 text-secondary">
                                                    <Icon name="home_pin"/>
                                                </div>
                                                <p className="text-xs font-semibold text-on-surface">
                                                    {[activeOrder.shippingWardName, activeOrder.shippingDistrictName, activeOrder.shippingProvinceName]
                        .filter(Boolean)
                        .join(", ") || "Địa chỉ nhận hàng"}
                                                </p>
                                                <p className="text-[11px] text-on-surface-variant">Nơi nhận hàng</p>
                                            </div>
                                        </div>
                                        {activeOrder.shipment ? (<div className="mt-4 space-y-1 border-t border-outline-variant/15 pt-3 text-xs text-on-surface-variant">
                                                {activeOrder.shipment.trackingUrl ? (<p>
                                                        <a className="font-medium text-primary hover:underline" href={activeOrder.shipment.trackingUrl} target="_blank" rel="noreferrer">
                                                            Tra cứu vận đơn trên hệ thống vận chuyển
                                                        </a>
                                                    </p>) : null}
                                                {activeOrder.shipment.expectedDeliveryTime ? (<p>Dự kiến giao: {formatDateTime(activeOrder.shipment.expectedDeliveryTime)}</p>) : null}
                                            </div>) : null}
                                    </div>

                                    <div className="rounded-[1.5rem] bg-surface-container-low p-5">
                                        <p className="text-center text-xs uppercase tracking-[0.18em] text-on-surface-variant">
                                            Lịch sử vận chuyển
                                        </p>
                                        <div className="mt-4 max-h-56 space-y-3 overflow-y-auto">
                                            {activeOrder.statusHistory.length === 0 ? (<p className="text-center text-sm text-on-surface-variant">
                                                    Chưa có cập nhật vận chuyển nào.
                                                </p>) : ([...activeOrder.statusHistory].reverse().map((event) => (<div key={event.id} className="flex items-start gap-3 text-sm">
                                                    <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary"/>
                                                    <div>
                                                        <p className="font-medium text-on-surface">
                                                            {customerOrderStatusLabels[event.toStatus] ?? fallbackBackendLabel(event.toStatus)}
                                                        </p>
                                                        <p className="text-xs text-on-surface-variant">
                                                            {formatDateTime(event.changedAt)}
                                                            {event.note ? ` · ${event.note}` : ""}
                                                        </p>
                                                    </div>
                                                </div>)))}
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-6 grid gap-5 xl:grid-cols-3">
                                    <div className="h-full rounded-[1.5rem] bg-surface-container-low p-5">
                                        <p className="text-center text-xs uppercase tracking-[0.18em] text-on-surface-variant">
                                            Thông tin đơn hàng
                                        </p>
                                        <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
                                            <p>
                                                <span className="font-medium">Mã đơn:</span> {activeOrder.orderNo}
                                            </p>
                                            <p>
                                                <span className="font-medium">Ngày đặt:</span>{" "}
                                                {formatDate(activeOrder.createdAt)}
                                            </p>
                                            <p>
                                                <span className="font-medium">Trạng thái đơn:</span>{" "}
                                                {customerOrderStatusLabels[activeOrder.status] ??
                    fallbackBackendLabel(activeOrder.status)}
                                            </p>
                                            <p>
                                                <span className="font-medium">Trạng thái thanh toán:</span>{" "}
                                                {activeOrder.payment
                    ? customerPaymentStatusLabels[activeOrder.payment.paymentStatus] ??
                        fallbackBackendLabel(activeOrder.payment.paymentStatus)
                    : "Chưa có"}
                                            </p>
                                            <p>
                                                <span className="font-medium">Phương thức thanh toán:</span>{" "}
                                                {customerPaymentMethodLabels[activeOrder.paymentMethod] ??
                    fallbackBackendLabel(activeOrder.paymentMethod)}
                                            </p>
                                            <p>
                                                <span className="font-medium">Đơn vị vận chuyển:</span>{" "}
                                                {activeOrder.shippingCarrier ?? "Chưa cập nhật"}
                                            </p>
                                            <p>
                                                <span className="font-medium">Mã vận đơn:</span>{" "}
                                                {activeOrder.shippingCode ?? "Chưa tạo"}
                                            </p>
                                            <p>
                                                <span className="font-medium">Địa chỉ nhận:</span>{" "}
                                                {activeOrder.shippingAddress}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="h-full rounded-[1.5rem] bg-surface-container-low p-5">
                                        <p className="text-center text-xs uppercase tracking-[0.18em] text-on-surface-variant">
                                            Sản phẩm trong đơn
                                        </p>
                                        <div className="mt-4 space-y-3">
                                            {activeOrder.items.map((item) => (<div key={item.id} className="flex items-start justify-between gap-4 rounded-2xl bg-white px-4 py-4 shadow-sm">
                                                    <div>
                                                        <p className="font-semibold text-on-surface">
                                                            {item.productNameSnapshot}
                                                        </p>
                                                        <p className="mt-1 text-sm text-on-surface-variant">
                                                            Số lượng: {item.quantity}
                                                        </p>
                                                        <p className="text-sm text-on-surface-variant">
                                                            Đơn giá: {formatCurrency(item.unitPrice)}
                                                        </p>
                                                    </div>
                                                    <span className="text-sm font-semibold text-primary">
                                                        {formatCurrency(item.lineTotal)}
                                                    </span>
                                                </div>))}
                                        </div>
                                    </div>

                                    <div className="flex h-full flex-col gap-4">
                                        <div className="rounded-[1.5rem] bg-surface-container-low p-5">
                                            <p className="text-center text-xs uppercase tracking-[0.18em] text-on-surface-variant">
                                                Tổng hợp thanh toán
                                            </p>
                                            <div className="mt-4 space-y-3 text-sm">
                                                <div className="flex justify-between">
                                                    <span className="text-on-surface-variant">Tạm tính</span>
                                                    <span>{formatCurrency(activeOrder.subtotal)}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-on-surface-variant">Phí vận chuyển</span>
                                                    <span>{formatCurrency(activeOrder.shippingFee)}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-on-surface-variant">Giảm giá</span>
                                                    <span>{formatCurrency(activeOrder.discountAmount)}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-on-surface-variant">Tổng tiền</span>
                                                    <span className="font-semibold">
                                                        {formatCurrency(activeOrder.totalAmount)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {activeOrder.paymentMethod === "BANK_TRANSFER" ? (<div className="rounded-[1.5rem] border border-primary/20 bg-primary/5 p-5 text-sm">
                                                <p className="text-center text-xs uppercase tracking-[0.18em] text-on-surface-variant">
                                                    Thông tin chuyển khoản
                                                </p>
                                                <div className="mt-3 space-y-2 text-on-surface-variant">
                                                    <p>
                                                        Ngân hàng:{" "}
                                                        {paymentInstructionValue(paymentPayload, "bank_name") || "MB Bank"}
                                                    </p>
                                                    <p>
                                                        Chủ tài khoản:{" "}
                                                        {paymentInstructionValue(paymentPayload, "account_name") ||
                        "HERITAGE HARVEST"}
                                                    </p>
                                                    <p>
                                                        Số tài khoản:{" "}
                                                        {paymentInstructionValue(paymentPayload, "account_number") ||
                        "0123456789"}
                                                    </p>
                                                    <p>
                                                        Nội dung chuyển khoản:{" "}
                                                        {paymentInstructionValue(paymentPayload, "transfer_content") ||
                        activeOrder.orderNo}
                                                    </p>
                                                    <p>
                                                        Khách đã báo chuyển khoản:{" "}
                                                        {transferSubmitted ? "Đã báo" : "Chưa báo"}
                                                    </p>
                                                </div>
                                            </div>) : null}
                                    </div>
                                </div>

                                {actionMessage ? (<div className="mt-4 rounded-2xl bg-secondary-fixed px-4 py-3 text-sm text-secondary">
                                        {actionMessage}
                                    </div>) : null}

                                <div className="mt-6 flex flex-wrap justify-center gap-3">
                                    <button className="rounded-full border border-outline-variant/20 px-4 py-2 text-sm font-medium" onClick={() => void handleReorder(false)}>
                                        Thêm lại vào giỏ
                                    </button>
                                    {canCancelCustomerOrder(activeOrder.status) ? (<button className="rounded-full border border-error/25 px-4 py-2 text-sm font-semibold text-error disabled:opacity-50" disabled={isSubmitting} onClick={() => setIsCancelModalOpen(true)}>
                                            Hủy đơn
                                        </button>) : null}
                                    {canShowPayAgain(activeOrder) ? (<button className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-on-primary" onClick={() => void handleReorder(true)}>
                                            Thanh toán lại
                                        </button>) : null}
                                    {activeOrder.paymentMethod === "BANK_TRANSFER" &&
                    activeOrder.payment?.paymentStatus === "PENDING" ? (<button className="rounded-full border border-primary/30 px-4 py-2 text-sm font-semibold text-primary disabled:opacity-50" disabled={isSubmitting || transferSubmitted} onClick={() => void handleConfirmTransfer()}>
                                            {transferSubmitted ? "Đã gửi xác nhận" : "Tôi đã chuyển khoản"}
                                        </button>) : null}
                                    {activeOrder.status === "SHIPPED" ? (<button className="rounded-full bg-secondary px-4 py-2 text-sm font-semibold text-on-secondary disabled:opacity-50" disabled={isSubmitting} onClick={() => void handleConfirmDelivered()}>
                                            Đã nhận được hàng
                                        </button>) : null}
                                </div>
                            </>)}
                    </div>
                </div>) : null}

            {isDetailModalOpen && isCancelModalOpen && activeOrder ? (<div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/45 px-4 py-6">
                    <div className="w-full max-w-lg rounded-[1.5rem] bg-white p-6 shadow-2xl">
                        <h3 className="text-center text-xl font-semibold text-on-surface">Xác nhận hủy đơn</h3>
                        <p className="mt-3 text-center text-sm text-on-surface-variant">
                            Bạn có chắc chắn muốn hủy đơn hàng này không? Sau khi hủy, đơn hàng sẽ không thể tiếp tục xử lý.
                        </p>

                        <div className="mt-5 space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-on-surface">Lý do hủy</label>
                                <select className="w-full rounded-2xl border border-outline-variant/15 bg-surface-container-low px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/15" value={cancelReason} onChange={(event) => setCancelReason(event.target.value)}>
                                    {CUSTOMER_CANCEL_REASONS.map((reason) => (<option key={reason} value={reason}>
                                            {reason}
                                        </option>))}
                                </select>
                            </div>

                            {cancelReason === "Lý do khác" ? (<div className="space-y-2">
                                    <label className="text-sm font-medium text-on-surface">Ghi chú</label>
                                    <textarea className="min-h-28 w-full rounded-2xl border border-outline-variant/15 bg-surface-container-low px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/15" placeholder="Nhập lý do hủy đơn" value={cancelNote} onChange={(event) => setCancelNote(event.target.value)}/>
                                </div>) : null}
                        </div>

                        <div className="mt-6 flex flex-wrap justify-center gap-3">
                            <button className="rounded-full border border-outline-variant/20 px-5 py-2.5 text-sm font-medium" onClick={() => setIsCancelModalOpen(false)}>
                                Không, quay lại
                            </button>
                            <button className="rounded-full bg-error px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50" disabled={isSubmitting} onClick={() => void handleCancelOrder()}>
                                {isSubmitting ? "Đang xử lý..." : "Xác nhận hủy"}
                            </button>
                        </div>
                    </div>
                </div>) : null}
        </div>);
}
