import { useEffect } from "react";
import { Navigate, useParams } from "react-router-dom";
import { routes } from "@/shared/config/routes";
import { customerOrderStatusLabels, customerPaymentMethodLabels, customerPaymentStatusLabels, fallbackBackendLabel, } from "@/shared/lib/customer-order-labels";
import { formatCurrency, formatDate } from "@/shared/lib/format";
import { useCustomerOrdersStore } from "@/shared/lib/store/use-customer-orders-store";
import { Badge, ButtonLink, SurfaceCard } from "@/shared/ui";
export function OrderSuccessPage() {
    const { orderId } = useParams();
    const order = useCustomerOrdersStore((state) => orderId ? state.orderDetails[orderId] : undefined);
    const loadOrder = useCustomerOrdersStore((state) => state.loadOrder);
    const isLoading = useCustomerOrdersStore((state) => state.isLoading);
    useEffect(() => {
        if (!orderId || order) {
            return;
        }
        void loadOrder(orderId);
    }, [loadOrder, order, orderId]);
    if (!orderId) {
        return <Navigate replace to={routes.checkout}/>;
    }
    if (!order && isLoading) {
        return (<div className="mx-auto max-w-5xl px-6 pb-16 pt-24">
                <div className="rounded-3xl bg-surface-container-low p-8 text-center text-on-surface-variant">
                    Đang tải thông tin đơn hàng...
                </div>
            </div>);
    }
    if (!order) {
        return <Navigate replace to={routes.checkout}/>;
    }
    return (<div className="mx-auto max-w-5xl px-6 pb-16 pt-24">
            <section className="rounded-[2rem] bg-surface-container-lowest p-8 text-center shadow-sm ring-1 ring-black/5">
                <Badge tone="success">Đơn hàng đã được ghi nhận</Badge>
                <h1 className="mt-5 font-headline text-4xl font-bold tracking-tight text-on-surface">
                    Đặt hàng thành công
                </h1>
                <p className="mx-auto mt-3 max-w-2xl text-base leading-7 text-on-surface-variant">
                    Đơn <span className="whitespace-nowrap font-semibold text-on-surface">{order.orderNo}</span>{" "}
                    đã được ghi nhận.
                </p>
                <div className="mt-8 flex flex-wrap justify-center gap-3">
                    <ButtonLink to={routes.accountOrderDetail(order.id)}>Xem đơn hàng</ButtonLink>
                    <ButtonLink to={routes.products} variant="secondary">
                        Tiếp tục mua sắm
                    </ButtonLink>
                </div>
            </section>

            <section className="mt-8 grid gap-6 md:grid-cols-2">
                <SurfaceCard className="space-y-4">
                    <h2 className="font-headline text-2xl font-bold text-on-surface">Thông tin đơn hàng</h2>
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="rounded-3xl bg-surface-container-low p-5">
                            <p className="text-xs uppercase tracking-widest text-on-surface-variant">Ngày đặt</p>
                            <p className="mt-2 font-semibold text-on-surface">{formatDate(order.createdAt)}</p>
                        </div>
                        <div className="rounded-3xl bg-surface-container-low p-5">
                            <p className="text-xs uppercase tracking-widest text-on-surface-variant">Tổng tiền</p>
                            <p className="mt-2 font-semibold text-on-surface">{formatCurrency(order.totalAmount)}</p>
                        </div>
                        <div className="rounded-3xl bg-surface-container-low p-5">
                            <p className="text-xs uppercase tracking-widest text-on-surface-variant">Trạng thái đơn</p>
                            <p className="mt-2 font-semibold text-on-surface">
                                {customerOrderStatusLabels[order.status] ?? fallbackBackendLabel(order.status)}
                            </p>
                        </div>
                        <div className="rounded-3xl bg-surface-container-low p-5">
                            <p className="text-xs uppercase tracking-widest text-on-surface-variant">
                                Trạng thái thanh toán
                            </p>
                            <p className="mt-2 font-semibold text-on-surface">
                                {order.payment
            ? customerPaymentStatusLabels[order.payment.paymentStatus] ??
                fallbackBackendLabel(order.payment.paymentStatus)
            : "Chưa có dữ liệu"}
                            </p>
                        </div>
                    </div>
                </SurfaceCard>

                <SurfaceCard className="space-y-4">
                    <h2 className="font-headline text-2xl font-bold text-on-surface">Thông tin giao nhận</h2>
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="rounded-3xl bg-surface-container-low p-5">
                            <p className="text-xs uppercase tracking-widest text-on-surface-variant">
                                Phương thức thanh toán
                            </p>
                            <p className="mt-2 font-semibold text-on-surface">
                                {customerPaymentMethodLabels[order.paymentMethod] ??
            fallbackBackendLabel(order.paymentMethod)}
                            </p>
                        </div>
                        <div className="rounded-3xl bg-surface-container-low p-5">
                            <p className="text-xs uppercase tracking-widest text-on-surface-variant">Phí vận chuyển</p>
                            <p className="mt-2 font-semibold text-on-surface">{formatCurrency(order.shippingFee)}</p>
                        </div>
                    </div>
                    <div className="rounded-3xl bg-surface-container-low p-5">
                        <p className="text-xs uppercase tracking-widest text-on-surface-variant">Địa chỉ nhận hàng</p>
                        <p className="mt-2 text-sm leading-6 text-on-surface">{order.shippingAddress}</p>
                    </div>
                </SurfaceCard>
            </section>
        </div>);
}
