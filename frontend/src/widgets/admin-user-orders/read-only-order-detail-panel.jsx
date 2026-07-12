import { formatCurrency, formatDate } from "@/shared/lib/format";
import { Badge } from "@/shared/ui";
import {
    adminOrderStatusLabel,
    adminOrderStatusTone,
    adminPaymentStatusLabel,
    adminPaymentStatusTone,
    paymentMethodLabel,
} from "@/widgets/admin-user-orders/order-detail-labels";

function FieldValue({ label, value }) {
    return (<div className="rounded-2xl bg-surface-container-low p-4 text-sm">
            <p className="text-xs font-label uppercase tracking-[0.14em] text-on-surface-variant">
                {label}
            </p>
            <p className="mt-2 font-medium text-on-surface">{value || "Chua cap nhat"}</p>
        </div>);
}
function paymentInstructionValue(payload, key) {
    const value = payload?.[key];
    return typeof value === "string" ? value : "";
}
export function ReadOnlyOrderDetailPanel({ order }) {
    const paymentPayload = order.payment?.raw_payload ?? null;
    const transferSubmitted = Boolean(paymentPayload?.customer_transfer_submitted);
    return (<div className="space-y-5 rounded-[1.75rem] border border-outline-variant/15 bg-surface-container-low p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <p className="text-xs font-label uppercase tracking-[0.14em] text-on-surface-variant">
                        Chi tiet don hang
                    </p>
                    <h4 className="mt-2 font-semibold text-on-surface">{order.order_no}</h4>
                    <p className="mt-1 text-sm text-on-surface-variant">
                        Tao luc {formatDate(order.created_at)}
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Badge tone={adminOrderStatusTone(order.status)}>
                        {adminOrderStatusLabel(order.status)}
                    </Badge>
                    <Badge tone={adminPaymentStatusTone(order.payment?.payment_status)}>
                        {adminPaymentStatusLabel(order.payment?.payment_status ?? "PENDING")}
                    </Badge>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                <FieldValue label="Khach hang" value={order.customer?.full_name ?? "Khach vang lai"}/>
                <FieldValue label="Email" value={order.customer?.email}/>
                <FieldValue label="Nguoi nhan" value={order.recipient_name}/>
                <FieldValue label="Dien thoai" value={order.recipient_phone}/>
                <FieldValue label="Dia chi giao" value={order.shipping_address}/>
                <FieldValue label="Ghi chu" value={order.note}/>
                <FieldValue label="Phuong thuc thanh toan" value={paymentMethodLabel(order.payment_method)}/>
                <FieldValue label="Don vi van chuyen" value={order.shipping_carrier ?? "Chua cap nhat"}/>
                <FieldValue label="Ma van don" value={order.shipping_code ?? "Chua tao"}/>
                <FieldValue label="Da giao" value={order.delivered_at ? formatDate(order.delivered_at) : "Chua giao xong"}/>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <FieldValue label="Tam tinh" value={formatCurrency(Number(order.subtotal))}/>
                <FieldValue label="Phi giao" value={formatCurrency(Number(order.shipping_fee))}/>
                <FieldValue label="Tong tien" value={formatCurrency(Number(order.total_amount))}/>
            </div>

            <div className="space-y-3 rounded-2xl bg-surface p-4">
                <p className="text-xs font-label uppercase tracking-[0.14em] text-on-surface-variant">
                    San pham trong don
                </p>
                {order.items.map((item) => (<div key={item.id} className="flex items-start justify-between gap-4 border-b border-outline-variant/15 pb-3 last:border-0 last:pb-0">
                        <div>
                            <p className="font-medium text-on-surface">{item.product_name_snapshot}</p>
                            <p className="text-sm text-on-surface-variant">
                                {item.quantity} x {formatCurrency(Number(item.unit_price))}
                            </p>
                        </div>
                        <span className="text-sm font-semibold text-primary">
                            {formatCurrency(Number(item.line_total))}
                        </span>
                    </div>))}
            </div>

            {order.payment_method === "BANK_TRANSFER" ? (<div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm">
                    <p className="font-medium text-on-surface">Thong tin chuyen khoan</p>
                    <div className="mt-3 space-y-2 text-on-surface-variant">
                        <p>Ngan hang: {paymentInstructionValue(paymentPayload, "bank_name") || "MB Bank"}</p>
                        <p>
                            Chu tai khoan:{" "}
                            {paymentInstructionValue(paymentPayload, "account_name") || "HERITAGE HARVEST"}
                        </p>
                        <p>So tai khoan: {paymentInstructionValue(paymentPayload, "account_number") || "0123456789"}</p>
                        <p>Noi dung: {paymentInstructionValue(paymentPayload, "transfer_content") || order.order_no}</p>
                        <p>Khach da bao chuyen khoan: {transferSubmitted ? "Da gui" : "Chua gui"}</p>
                    </div>
                </div>) : null}

            <div className="grid gap-4 xl:grid-cols-2">
                <div className="space-y-3 rounded-2xl bg-surface p-4">
                    <p className="text-xs font-label uppercase tracking-[0.14em] text-on-surface-variant">
                        Lich su trang thai don
                    </p>
                    {order.status_history.length ? (order.status_history.map((history) => (<div key={history.id} className="rounded-2xl bg-surface-container-low p-4 text-sm">
                                <p className="font-medium text-on-surface">
                                    {(history.from_status ? `${adminOrderStatusLabel(history.from_status)} -> ` : "") +
                adminOrderStatusLabel(history.to_status)}
                                </p>
                                <p className="mt-1 text-on-surface-variant">{formatDate(history.changed_at)}</p>
                                {history.note ? (<p className="mt-2 text-on-surface-variant">{history.note}</p>) : null}
                            </div>))) : (<p className="text-sm text-on-surface-variant">Chua co lich su trang thai.</p>)}
                </div>

                <div className="space-y-3 rounded-2xl bg-surface p-4">
                    <p className="text-xs font-label uppercase tracking-[0.14em] text-on-surface-variant">
                        Lich su thanh toan
                    </p>
                    {order.payment_status_history.length ? (order.payment_status_history.map((history) => (<div key={history.id} className="rounded-2xl bg-surface-container-low p-4 text-sm">
                                <p className="font-medium text-on-surface">
                                    {(history.from_status ? `${adminPaymentStatusLabel(history.from_status)} -> ` : "") +
                adminPaymentStatusLabel(history.to_status)}
                                </p>
                                <p className="mt-1 text-on-surface-variant">{formatDate(history.changed_at)}</p>
                                {history.note ? (<p className="mt-2 text-on-surface-variant">{history.note}</p>) : null}
                            </div>))) : (<p className="text-sm text-on-surface-variant">Chua co lich su thanh toan.</p>)}
                </div>
            </div>
        </div>);
}
