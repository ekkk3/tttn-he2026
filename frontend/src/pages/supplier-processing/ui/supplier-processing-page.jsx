import { useEffect, useState } from "react";
import { formatCurrency, formatDate } from "@/shared/lib/format";
import { deliveryStatusLabels } from "@/shared/lib/labels";
import { useFeedbackStore } from "@/shared/lib/store/use-feedback-store";
import { useOperationsDataStore } from "@/shared/lib/store/use-operations-data-store";
import { AdminDrawer, AdminPageHeader, Badge, Button, DataTable, SurfaceCard } from "@/shared/ui";
function deliveryTone(order) {
    if (order.deliveryStatus === "DELIVERED")
        return "success";
    if (order.deliveryStatus === "PACKED" || order.deliveryStatus === "SHIPPED")
        return "warning";
    if (order.deliveryStatus === "CANCELLED" || order.deliveryStatus === "DELIVERY_FAILED")
        return "danger";
    return "primary";
}
export function SupplierProcessingPage() {
    const orders = useOperationsDataStore((state) => state.supplierOrders);
    const loadOperations = useOperationsDataStore((state) => state.loadOperations);
    const updateOrderDeliveryStatus = useOperationsDataStore((state) => state.updateOrderDeliveryStatus);
    const [activeOrderId, setActiveOrderId] = useState(orders[0]?.id ?? "");
    const [detailOpen, setDetailOpen] = useState(false);
    const activeOrder = orders.find((order) => order.id === activeOrderId) ?? orders[0];
    const pushToast = useFeedbackStore((state) => state.pushToast);
    useEffect(() => {
        void loadOperations();
    }, [loadOperations]);
    function openOrder(order) {
        setActiveOrderId(order.id);
        setDetailOpen(true);
    }
    const columns = [
        {
            key: "order",
            title: "Order",
            width: "12%",
            nowrap: true,
            render: (order) => <span className="font-semibold">#{order.id}</span>,
        },
        {
            key: "customer",
            title: "Customer",
            width: "24%",
            render: (order) => (<div>
                    <p className="font-medium">{order.customerName}</p>
                    <p className="text-xs text-on-surface-variant">{order.supplierName}</p>
                </div>),
        },
        {
            key: "date",
            title: "Date",
            width: "16%",
            nowrap: true,
            render: (order) => <span className="text-on-surface-variant">{formatDate(order.date)}</span>,
        },
        {
            key: "total",
            title: "Total",
            width: "16%",
            nowrap: true,
            render: (order) => <span className="font-semibold">{formatCurrency(order.total)}</span>,
        },
        {
            key: "status",
            title: "Status",
            width: "18%",
            nowrap: true,
            render: (order) => <Badge tone={deliveryTone(order)}>{deliveryStatusLabels[order.deliveryStatus]}</Badge>,
        },
        {
            key: "actions",
            title: "Actions",
            align: "right",
            width: "14%",
            nowrap: true,
            render: (order) => (<Button variant="ghost" size="sm" onClick={(event) => {
                    event.stopPropagation();
                    openOrder(order);
                }}>
                    Xử lý
                </Button>),
        },
    ];
    // Gửi đúng giá trị status mà backend hiểu (PENDING/CONFIRMED/PACKED/SHIPPED/DELIVERED/...),
    // trước đây gửi "ready_to_ship"/"delivered" (không khớp enum) khiến orders.status bị ghi
    // sai giá trị mà không báo lỗi (cột status là VARCHAR nên DB không chặn được).
    async function handleReadyForWarehouse() {
        if (!activeOrder)
            return;
        const result = await updateOrderDeliveryStatus(activeOrder.id, "PACKED", "Supplier marked order ready");
        pushToast(result.success
            ? { tone: "success", message: `Đã chuyển đơn ${activeOrder.id} sang trạng thái sẵn sàng giao.` }
            : { tone: "danger", message: result.error || `Không thể cập nhật đơn ${activeOrder.id}.` });
    }
    async function handleDelivered() {
        if (!activeOrder)
            return;
        const result = await updateOrderDeliveryStatus(activeOrder.id, "SHIPPED", "Supplier confirmed shipment");
        pushToast(result.success
            ? { tone: "success", message: `Đã xác nhận gửi hàng đơn ${activeOrder.id}.` }
            : { tone: "danger", message: result.error || `Không thể cập nhật đơn ${activeOrder.id}.` });
    }
    return (<div className="space-y-8">
            <AdminPageHeader title="Xử lý đơn nhà cung cấp" description="Kiểm tra đơn cần chuẩn bị, chuyển sang sẵn sàng giao và xác nhận hoàn tất."/>

            <SurfaceCard className="overflow-hidden p-0">
                <div className="border-b border-outline-variant/15 px-6 py-5">
                    <h3 className="font-headline text-xl font-semibold">Supplier xử lý đơn</h3>
                </div>
                <div className="p-6">
                    <DataTable rows={orders} columns={columns} getRowKey={(order) => order.id} minWidth="860px" pagination={{ pageSize: 6, itemLabel: "đơn hàng" }} rowClassName={(order) => order.id === activeOrder?.id ? "border-l-4 border-primary bg-primary/5" : undefined} onRowClick={openOrder}/>
                </div>
            </SurfaceCard>

            <AdminDrawer open={detailOpen && Boolean(activeOrder)} mode="view" title={activeOrder ? `Order #${activeOrder.id}` : "Xử lý đơn"} subtitle={activeOrder ? `${activeOrder.customerName} / ${deliveryStatusLabels[activeOrder.deliveryStatus]}` : undefined} onClose={() => setDetailOpen(false)} footer={<div className="flex flex-wrap justify-end gap-3">
                        <Button variant="outline" onClick={() => setDetailOpen(false)}>
                            Đóng
                        </Button>
                        <Button disabled={!activeOrder} onClick={handleReadyForWarehouse}>
                            Chuyển sang sẵn sàng giao
                        </Button>
                        <Button variant="secondary" disabled={!activeOrder} onClick={handleDelivered}>
                            Xác nhận đã gửi hàng
                        </Button>
                    </div>}>
                {activeOrder ? (<div className="space-y-5">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="rounded-2xl bg-surface-container-low p-4 text-sm">
                                <p className="text-on-surface-variant">Khách hàng</p>
                                <p className="mt-2 font-semibold">{activeOrder.customerName}</p>
                            </div>
                            <div className="rounded-2xl bg-surface-container-low p-4 text-sm">
                                <p className="text-on-surface-variant">Nhà cung cấp</p>
                                <p className="mt-2 font-semibold">{activeOrder.supplierName}</p>
                            </div>
                            <div className="rounded-2xl bg-surface-container-low p-4 text-sm">
                                <p className="text-on-surface-variant">Tổng tiền</p>
                                <p className="mt-2 font-semibold">{formatCurrency(activeOrder.total)}</p>
                            </div>
                            <div className="rounded-2xl bg-surface-container-low p-4 text-sm">
                                <p className="text-on-surface-variant">Trạng thái hiện tại</p>
                                <p className="mt-2 font-semibold">{deliveryStatusLabels[activeOrder.deliveryStatus]}</p>
                            </div>
                        </div>
                    </div>) : null}
            </AdminDrawer>
        </div>);
}
