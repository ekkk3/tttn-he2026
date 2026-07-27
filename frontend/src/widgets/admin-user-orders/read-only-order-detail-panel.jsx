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
            <p className="mt-2 font-medium text-on-surface">{value || "Chưa cập nhật"}</p>
        </div>);
}
function paymentInstructionValue(payload, key) {
    const value = payload?.[key];
    return typeof value === "string" ? value : "";
}
// Hiển thị CHI TIẾT đơn hàng dạng CHỈ ĐỌC (không nút đổi trạng thái/tạo vận đơn như
// admin-logistics-page.jsx) — dùng ở trang admin xem đơn của 1 khách hàng cụ thể
// (admin-user-order-detail-page.jsx), nơi admin chỉ cần TRA CỨU, không thao tác trực tiếp.
export function ReadOnlyOrderDetailPanel({ order }) {
    const paymentPayload = order.payment?.raw_payload ?? null;
    const transferSubmitted = Boolean(paymentPayload?.customer_transfer_submitted);
    return (<div className="space-y-5 rounded-[1.75rem] border border-outline-variant/15 bg-surface-container-low p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <p className="text-xs font-label uppercase tracking-[0.14em] text-on-surface-variant">
                        Chi tiết đơn hàng
                    </p>
                    <h4 className="mt-2 font-semibold text-on-surface">{order.order_no}</h4>
                    <p className="mt-1 text-sm text-on-surface-variant">
                        Tạo lúc {formatDate(order.created_at)}
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
                <FieldValue label="Khách hàng" value={order.customer?.full_name ?? "Khách vãng lai"}/>
                <FieldValue label="Email" value={order.customer?.email}/>
                <FieldValue label="Người nhận" value={order.recipient_name}/>
                <FieldValue label="Điện thoại" value={order.recipient_phone}/>
                <FieldValue label="Địa chỉ giao" value={order.shipping_address}/>
                <FieldValue label="Ghi chú" value={order.note}/>
                <FieldValue label="Phương thức thanh toán" value={paymentMethodLabel(order.payment_method)}/>
                <FieldValue label="Đơn vị vận chuyển" value={order.shipping_carrier ?? "Chưa cập nhật"}/>
                <FieldValue label="Mã vận đơn" value={order.shipping_code ?? "Chưa tạo"}/>
                <FieldValue label="Đã giao" value={order.delivered_at ? formatDate(order.delivered_at) : "Chưa giao xong"}/>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <FieldValue label="Tạm tính" value={formatCurrency(Number(order.subtotal))}/>
                <FieldValue label="Phí giao" value={formatCurrency(Number(order.shipping_fee))}/>
                <FieldValue label="Tổng tiền" value={formatCurrency(Number(order.total_amount))}/>
            </div>

            <div className="space-y-3 rounded-2xl bg-surface p-4">
                <p className="text-xs font-label uppercase tracking-[0.14em] text-on-surface-variant">
                    Sản phẩm trong đơn
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
                    <p className="font-medium text-on-surface">Thông tin chuyển khoản</p>
                    <div className="mt-3 space-y-2 text-on-surface-variant">
                        <p>Ngân hàng: {paymentInstructionValue(paymentPayload, "bank_name") || "MB Bank"}</p>
                        <p>
                            Chủ tài khoản:{" "}
                            {paymentInstructionValue(paymentPayload, "account_name") || "HERITAGE HARVEST"}
                        </p>
                        <p>Số tài khoản: {paymentInstructionValue(paymentPayload, "account_number") || "0123456789"}</p>
                        <p>Nội dung: {paymentInstructionValue(paymentPayload, "transfer_content") || order.order_no}</p>
                        <p>Khách đã báo chuyển khoản: {transferSubmitted ? "Đã gửi" : "Chưa gửi"}</p>
                    </div>
                </div>) : null}

            <div className="grid gap-4 xl:grid-cols-2">
                <div className="space-y-3 rounded-2xl bg-surface p-4">
                    <p className="text-xs font-label uppercase tracking-[0.14em] text-on-surface-variant">
                        Lịch sử trạng thái đơn
                    </p>
                    {order.status_history.length ? (order.status_history.map((history) => (<div key={history.id} className="rounded-2xl bg-surface-container-low p-4 text-sm">
                                <p className="font-medium text-on-surface">
                                    {(history.from_status ? `${adminOrderStatusLabel(history.from_status)} -> ` : "") +
                adminOrderStatusLabel(history.to_status)}
                                </p>
                                <p className="mt-1 text-on-surface-variant">{formatDate(history.changed_at)}</p>
                                {history.note ? (<p className="mt-2 text-on-surface-variant">{history.note}</p>) : null}
                            </div>))) : (<p className="text-sm text-on-surface-variant">Chưa có lịch sử trạng thái.</p>)}
                </div>

                <div className="space-y-3 rounded-2xl bg-surface p-4">
                    <p className="text-xs font-label uppercase tracking-[0.14em] text-on-surface-variant">
                        Lịch sử thanh toán
                    </p>
                    {order.payment_status_history.length ? (order.payment_status_history.map((history) => (<div key={history.id} className="rounded-2xl bg-surface-container-low p-4 text-sm">
                                <p className="font-medium text-on-surface">
                                    {(history.from_status ? `${adminPaymentStatusLabel(history.from_status)} -> ` : "") +
                adminPaymentStatusLabel(history.to_status)}
                                </p>
                                <p className="mt-1 text-on-surface-variant">{formatDate(history.changed_at)}</p>
                                {history.note ? (<p className="mt-2 text-on-surface-variant">{history.note}</p>) : null}
                            </div>))) : (<p className="text-sm text-on-surface-variant">Chưa có lịch sử thanh toán.</p>)}
                </div>
            </div>
        </div>);
}
