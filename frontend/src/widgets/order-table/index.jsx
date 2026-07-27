import { formatCurrency, formatDate } from "@/shared/lib/format";
import { deliveryStatusLabels, paymentStatusLabels } from "@/shared/lib/labels";
import { Badge, Button, DataTable } from "@/shared/ui";
function paymentTone(order) {
    if (order.paymentStatus === "SUCCESS")
        return "primary";
    if (order.paymentStatus === "FAILED" || order.paymentStatus === "REFUNDED")
        return "danger";
    return "neutral";
}
function deliveryTone(order) {
    if (order.deliveryStatus === "DELIVERED")
        return "success";
    if (order.deliveryStatus === "SHIPPED")
        return "warning";
    if (order.deliveryStatus === "CANCELLED" || order.deliveryStatus === "DELIVERY_FAILED")
        return "danger";
    return "primary";
}
export function OrderTable({ orders, activeOrderId, onSelectOrder, mode = "supplier", }) {
    const columns = [
        {
            key: "orderId",
            title: "Mã đơn",
            render: (order) => <span className="font-semibold">#{order.id}</span>,
        },
        ...(mode !== "account"
            ? [
                {
                    key: "customer",
                    title: mode === "admin" ? "Khách hàng" : "Người mua / Nhà cung cấp",
                    render: (order) => (<div>
                              <p className="font-medium text-on-surface">{order.customerName}</p>
                              <p className="text-xs text-on-surface-variant">
                                  {order.supplierName}
                              </p>
                          </div>),
                },
            ]
            : []),
        {
            key: "date",
            title: "Ngày",
            render: (order) => (<span className="text-on-surface-variant">{formatDate(order.date)}</span>),
        },
        {
            key: "total",
            title: "Tổng tiền",
            render: (order) => <span className="font-semibold">{formatCurrency(order.total)}</span>,
        },
        {
            key: "payment",
            title: "Thanh toán",
            render: (order) => (<Badge tone={paymentTone(order)}>{paymentStatusLabels[order.paymentStatus]}</Badge>),
        },
        {
            key: "delivery",
            title: "Vận chuyển",
            render: (order) => (<Badge tone={deliveryTone(order)}>
                    {deliveryStatusLabels[order.deliveryStatus]}
                </Badge>),
        },
        {
            key: "action",
            title: "Thao tác",
            align: "right",
            render: (order) => (<Button variant="ghost" size="sm" onClick={() => onSelectOrder?.(order.id)}>
                    Xem chi tiết
                </Button>),
        },
    ];
    return (<DataTable rows={orders} columns={columns} getRowKey={(order) => order.id} rowClassName={(order) => order.id === activeOrderId ? "border-l-4 border-primary bg-primary/5" : undefined}/>);
}
