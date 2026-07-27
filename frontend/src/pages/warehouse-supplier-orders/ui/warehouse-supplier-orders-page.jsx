import { useEffect, useState } from "react";
import { formatCurrency, formatDate } from "@/shared/lib/format";
import { deliveryStatusLabels, paymentStatusLabels } from "@/shared/lib/labels";
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
export function WarehouseSupplierOrdersPage() {
    const orders = useOperationsDataStore((state) => state.supplierOrders);
    const loadOperations = useOperationsDataStore((state) => state.loadOperations);
    const [activeOrderId, setActiveOrderId] = useState(orders[0]?.id ?? "");
    const [detailOpen, setDetailOpen] = useState(false);
    const activeOrder = orders.find((order) => order.id === activeOrderId) ?? orders[0];
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
            render: (order) => <span className="font-semibold">#{order.id}</span>,
        },
        {
            key: "supplier",
            title: "Supplier",
            render: (order) => (<div>
                    <p className="font-medium">{order.supplierName}</p>
                    <p className="text-xs text-on-surface-variant">{order.customerName}</p>
                </div>),
        },
        {
            key: "date",
            title: "Date",
            render: (order) => <span className="text-on-surface-variant">{formatDate(order.date)}</span>,
        },
        {
            key: "total",
            title: "Total",
            render: (order) => <span className="font-semibold">{formatCurrency(order.total)}</span>,
        },
        {
            key: "payment",
            title: "Payment",
            render: (order) => <Badge>{paymentStatusLabels[order.paymentStatus]}</Badge>,
        },
        {
            key: "status",
            title: "Status",
            render: (order) => <Badge tone={deliveryTone(order)}>{deliveryStatusLabels[order.deliveryStatus]}</Badge>,
        },
        {
            key: "actions",
            title: "Actions",
            align: "right",
            render: (order) => (<Button variant="ghost" size="sm" onClick={(event) => {
                    event.stopPropagation();
                    openOrder(order);
                }}>
                    View detail
                </Button>),
        },
    ];
    return (<div className="space-y-8">
            <AdminPageHeader title="Đơn nhà cung cấp tại kho" description="Theo dõi đơn từ nhà cung cấp, lịch nhận hàng và trạng thái xử lý tại kho."/>

            <SurfaceCard className="overflow-hidden p-0">
                <div className="border-b border-outline-variant/15 px-6 py-5">
                    <h3 className="font-headline text-xl font-semibold">Kho đơn supplier</h3>
                </div>
                <div className="p-6">
                    <DataTable rows={orders} columns={columns} getRowKey={(order) => order.id} minWidth="920px" pagination={{ pageSize: 6, itemLabel: "đơn hàng" }} rowClassName={(order) => order.id === activeOrder?.id ? "border-l-4 border-primary bg-primary/5" : undefined} onRowClick={openOrder}/>
                </div>
            </SurfaceCard>

            <AdminDrawer open={detailOpen && Boolean(activeOrder)} mode="view" title={activeOrder ? `Order #${activeOrder.id}` : "Order detail"} subtitle={activeOrder ? `${activeOrder.supplierName} / ${deliveryStatusLabels[activeOrder.deliveryStatus]}` : undefined} onClose={() => setDetailOpen(false)} footer={<div className="flex justify-end gap-3">
                        <Button variant="outline" onClick={() => setDetailOpen(false)}>
                            Đóng
                        </Button>
                        <Button variant="secondary" onClick={() => setActiveOrderId(orders[0]?.id ?? "")}>
                            Đưa về đầu danh sách
                        </Button>
                    </div>}>
                {activeOrder ? (<div className="space-y-5">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="rounded-2xl bg-surface-container-low p-4 text-sm">
                                <p className="text-on-surface-variant">Nhà cung cấp</p>
                                <p className="mt-2 font-semibold">{activeOrder.supplierName}</p>
                            </div>
                            <div className="rounded-2xl bg-surface-container-low p-4 text-sm">
                                <p className="text-on-surface-variant">Khách hàng</p>
                                <p className="mt-2 font-semibold">{activeOrder.customerName}</p>
                            </div>
                            <div className="rounded-2xl bg-surface-container-low p-4 text-sm">
                                <p className="text-on-surface-variant">Trạng thái</p>
                                <p className="mt-2 font-semibold">{deliveryStatusLabels[activeOrder.deliveryStatus]}</p>
                            </div>
                            <div className="rounded-2xl bg-surface-container-low p-4 text-sm">
                                <p className="text-on-surface-variant">Địa chỉ</p>
                                <p className="mt-2 font-semibold">{activeOrder.address}</p>
                            </div>
                        </div>
                    </div>) : null}
            </AdminDrawer>
        </div>);
}
