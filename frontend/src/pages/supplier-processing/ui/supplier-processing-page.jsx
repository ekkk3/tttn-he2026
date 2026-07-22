import { useEffect, useState } from "react";
import { formatCurrency, formatDate } from "@/shared/lib/format";
import { deliveryStatusLabels } from "@/shared/lib/labels";
import { useFeedbackStore } from "@/shared/lib/store/use-feedback-store";
import { useOperationsDataStore } from "@/shared/lib/store/use-operations-data-store";
import { AdminDrawer, AdminPageHeader, Badge, Button, DataTable, SurfaceCard } from "@/shared/ui";
function deliveryTone(order) {
    if (order.deliveryStatus === "delivered")
        return "success";
    if (order.deliveryStatus === "ready_to_ship" || order.deliveryStatus === "in_transit")
        return "warning";
    if (order.deliveryStatus === "disputed")
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
                    Xu ly
                </Button>),
        },
    ];
    // Gui dung gia tri status ma backend hieu (PENDING/CONFIRMED/PACKED/SHIPPED/DELIVERED/...),
    // truoc day gui "ready_to_ship"/"delivered" (khong khop enum) khien orders.status bi ghi
    // sai gia tri ma khong bao loi (cot status la VARCHAR nen DB khong chan duoc).
    async function handleReadyForWarehouse() {
        if (!activeOrder)
            return;
        const result = await updateOrderDeliveryStatus(activeOrder.id, "PACKED", "Supplier marked order ready");
        pushToast(result.success
            ? { tone: "success", message: `Da chuyen don ${activeOrder.id} sang trang thai san sang giao.` }
            : { tone: "danger", message: result.error || `Khong the cap nhat don ${activeOrder.id}.` });
    }
    async function handleDelivered() {
        if (!activeOrder)
            return;
        const result = await updateOrderDeliveryStatus(activeOrder.id, "SHIPPED", "Supplier confirmed shipment");
        pushToast(result.success
            ? { tone: "success", message: `Da xac nhan gui hang don ${activeOrder.id}.` }
            : { tone: "danger", message: result.error || `Khong the cap nhat don ${activeOrder.id}.` });
    }
    return (<div className="space-y-8">
            <AdminPageHeader title="Xử lý đơn nhà cung cấp" description="Kiểm tra đơn cần chuẩn bị, chuyển sang sẵn sàng giao và xác nhận hoàn tất."/>

            <SurfaceCard className="overflow-hidden p-0">
                <div className="border-b border-outline-variant/15 px-6 py-5">
                    <h3 className="font-headline text-xl font-semibold">Supplier xu ly don</h3>
                </div>
                <div className="p-6">
                    <DataTable rows={orders} columns={columns} getRowKey={(order) => order.id} minWidth="860px" pagination={{ pageSize: 6, itemLabel: "don hang" }} rowClassName={(order) => order.id === activeOrder?.id ? "border-l-4 border-primary bg-primary/5" : undefined} onRowClick={openOrder}/>
                </div>
            </SurfaceCard>

            <AdminDrawer open={detailOpen && Boolean(activeOrder)} mode="view" title={activeOrder ? `Order #${activeOrder.id}` : "Xu ly don"} subtitle={activeOrder ? `${activeOrder.customerName} / ${deliveryStatusLabels[activeOrder.deliveryStatus]}` : undefined} onClose={() => setDetailOpen(false)} footer={<div className="flex flex-wrap justify-end gap-3">
                        <Button variant="outline" onClick={() => setDetailOpen(false)}>
                            Dong
                        </Button>
                        <Button disabled={!activeOrder} onClick={handleReadyForWarehouse}>
                            Chuyen sang san sang giao
                        </Button>
                        <Button variant="secondary" disabled={!activeOrder} onClick={handleDelivered}>
                            Xac nhan da gui hang
                        </Button>
                    </div>}>
                {activeOrder ? (<div className="space-y-5">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="rounded-2xl bg-surface-container-low p-4 text-sm">
                                <p className="text-on-surface-variant">Khach hang</p>
                                <p className="mt-2 font-semibold">{activeOrder.customerName}</p>
                            </div>
                            <div className="rounded-2xl bg-surface-container-low p-4 text-sm">
                                <p className="text-on-surface-variant">Nha cung cap</p>
                                <p className="mt-2 font-semibold">{activeOrder.supplierName}</p>
                            </div>
                            <div className="rounded-2xl bg-surface-container-low p-4 text-sm">
                                <p className="text-on-surface-variant">Tong tien</p>
                                <p className="mt-2 font-semibold">{formatCurrency(activeOrder.total)}</p>
                            </div>
                            <div className="rounded-2xl bg-surface-container-low p-4 text-sm">
                                <p className="text-on-surface-variant">Trang thai hien tai</p>
                                <p className="mt-2 font-semibold">{deliveryStatusLabels[activeOrder.deliveryStatus]}</p>
                            </div>
                        </div>
                    </div>) : null}
            </AdminDrawer>
        </div>);
}
