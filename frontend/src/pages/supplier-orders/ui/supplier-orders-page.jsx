import { useEffect, useState } from "react";
import { formatCurrency, formatDate } from "@/shared/lib/format";
import { deliveryStatusLabels, paymentStatusLabels, shippingTierLabels } from "@/shared/lib/labels";
import { useOperationsDataStore } from "@/shared/lib/store/use-operations-data-store";
import { useUiStore } from "@/shared/lib/store/use-ui-store";
import { AdminDrawer, AdminPageHeader, Badge, Button, DataTable, StatCard, SurfaceCard } from "@/shared/ui";
function deliveryTone(order) {
    if (order.deliveryStatus === "delivered")
        return "success";
    if (order.deliveryStatus === "in_transit" || order.deliveryStatus === "ready_to_ship")
        return "warning";
    if (order.deliveryStatus === "disputed")
        return "danger";
    return "primary";
}
function paymentTone(order) {
    if (order.paymentStatus === "paid")
        return "success";
    if (order.paymentStatus === "refunded")
        return "danger";
    return "neutral";
}
export function SupplierOrdersPage() {
    const selectedSupplierOrderId = useUiStore((state) => state.selectedSupplierOrderId);
    const setSelectedSupplierOrderId = useUiStore((state) => state.setSelectedSupplierOrderId);
    const orders = useOperationsDataStore((state) => state.supplierOrders);
    const loadOperations = useOperationsDataStore((state) => state.loadOperations);
    const [filter, setFilter] = useState("all");
    const [detailOpen, setDetailOpen] = useState(false);
    useEffect(() => {
        void loadOperations();
    }, [loadOperations]);
    const filteredOrders = orders.filter((order) => filter === "awaiting"
        ? order.deliveryStatus === "processing" || order.deliveryStatus === "ready_to_ship"
        : true);
    const activeOrder = filteredOrders.find((order) => order.id === selectedSupplierOrderId) ?? filteredOrders[0];
    const stats = [
        {
            id: "supplier-pending",
            label: "Don cho xu ly",
            value: `${orders.filter((order) => order.deliveryStatus === "processing").length}`,
            tone: "primary",
            icon: "inventory_2",
            helperText: "dang cho dong goi hoac xac nhan",
        },
        {
            id: "supplier-transit",
            label: "Don dang van chuyen",
            value: `${orders.filter((order) => order.deliveryStatus === "in_transit").length}`,
            tone: "warning",
            icon: "local_shipping",
            helperText: "da ban giao don vi van chuyen",
        },
        {
            id: "supplier-revenue",
            label: "Doanh thu",
            value: formatCurrency(orders.reduce((total, order) => total + order.total, 0)),
            tone: "secondary",
            icon: "payments",
            helperText: "tong gia tri don hang tu API",
        },
    ];
    function openOrder(order) {
        setSelectedSupplierOrderId(order.id);
        setDetailOpen(true);
    }
    const columns = [
        {
            key: "order",
            title: "Order ID",
            render: (order) => <span className="font-semibold">#{order.id}</span>,
        },
        {
            key: "date",
            title: "Date",
            render: (order) => <span className="text-on-surface-variant">{formatDate(order.date)}</span>,
        },
        {
            key: "customer",
            title: "Customer",
            render: (order) => (<div>
                    <p className="font-medium">{order.customerName}</p>
                    <p className="text-xs text-on-surface-variant">{order.supplierName}</p>
                </div>),
        },
        {
            key: "total",
            title: "Total",
            render: (order) => <span className="font-semibold">{formatCurrency(order.total)}</span>,
        },
        {
            key: "payment",
            title: "Payment",
            render: (order) => <Badge tone={paymentTone(order)}>{paymentStatusLabels[order.paymentStatus]}</Badge>,
        },
        {
            key: "delivery",
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
            <AdminPageHeader title="Đơn hàng nhà cung cấp" description="Theo dõi đơn mua vào, trạng thái thanh toán và tiến độ giao hàng từ nhà cung cấp."/>

            <section className="grid gap-6 lg:grid-cols-3">
                {stats.map((stat) => (<StatCard key={stat.id} metric={stat}/>))}
            </section>

            <SurfaceCard className="overflow-hidden p-0">
                <div className="flex items-center justify-between border-b border-outline-variant/15 bg-surface-bright px-6 py-5">
                    <h4 className="font-headline font-semibold text-on-surface">
                        Danh sach don mua vao
                    </h4>
                    <div className="flex gap-2">
                        <button className={`rounded-full px-4 py-2 text-xs ${filter === "all"
            ? "bg-surface-container-low text-on-surface"
            : "text-on-surface-variant hover:bg-surface-container-low"}`} onClick={() => setFilter("all")}>
                            Tat ca
                        </button>
                        <button className={`rounded-full px-4 py-2 text-xs ${filter === "awaiting"
            ? "bg-surface-container-low text-on-surface"
            : "text-on-surface-variant hover:bg-surface-container-low"}`} onClick={() => setFilter("awaiting")}>
                            Cho giao kho
                        </button>
                    </div>
                </div>
                <div className="p-6">
                    <DataTable rows={filteredOrders} columns={columns} getRowKey={(order) => order.id} minWidth="920px" pagination={{ pageSize: 6, itemLabel: "don hang" }} rowClassName={(order) => order.id === activeOrder?.id ? "border-l-4 border-primary bg-primary/5" : undefined} onRowClick={openOrder}/>
                </div>
            </SurfaceCard>

            <AdminDrawer open={detailOpen && Boolean(activeOrder)} mode="view" title={activeOrder ? `Order #${activeOrder.id}` : "Order detail"} subtitle={activeOrder ? `${activeOrder.customerName} / ${deliveryStatusLabels[activeOrder.deliveryStatus]}` : undefined} onClose={() => setDetailOpen(false)} footer={<div className="flex justify-end">
                        <Button variant="outline" onClick={() => setDetailOpen(false)}>
                            Dong
                        </Button>
                    </div>}>
                {activeOrder ? (<div className="space-y-5">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="rounded-2xl bg-surface-container-low p-4 text-sm">
                                <p className="text-on-surface-variant">Nguoi mua</p>
                                <p className="mt-2 font-semibold">{activeOrder.customerName}</p>
                            </div>
                            <div className="rounded-2xl bg-surface-container-low p-4 text-sm">
                                <p className="text-on-surface-variant">Goi giao hang</p>
                                <p className="mt-2 font-semibold">{shippingTierLabels[activeOrder.shippingTier]}</p>
                            </div>
                            <div className="rounded-2xl bg-surface-container-low p-4 text-sm">
                                <p className="text-on-surface-variant">Tong tien</p>
                                <p className="mt-2 font-semibold">{formatCurrency(activeOrder.total)}</p>
                            </div>
                            <div className="rounded-2xl bg-surface-container-low p-4 text-sm">
                                <p className="text-on-surface-variant">Dia chi nhan</p>
                                <p className="mt-2 font-semibold">{activeOrder.address}</p>
                            </div>
                        </div>
                        <div className="space-y-3">
                            {activeOrder.items.map((item) => (<div key={`${activeOrder.id}-${item.productId}`} className="rounded-2xl bg-surface-container-low p-4 text-sm">
                                    <p className="font-semibold text-on-surface">
                                        {item.productName ?? item.productId}
                                    </p>
                                    <p className="text-on-surface-variant">
                                        So luong {item.quantity} / Don gia {formatCurrency(item.unitPrice)}
                                    </p>
                                </div>))}
                        </div>
                    </div>) : null}
            </AdminDrawer>
        </div>);
}
