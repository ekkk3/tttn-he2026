import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { routes } from "@/shared/config/routes";
import { useAdminOrdersStore } from "@/shared/lib/store/use-admin-orders-store";
import { useAdminUserStore } from "@/shared/lib/store/use-admin-user-store";
import { AdminPageHeader, ButtonLink, SurfaceCard } from "@/shared/ui";
import { ReadOnlyOrderDetailPanel } from "@/widgets/admin-user-orders/read-only-order-detail-panel";
const INVALID_ROUTE_MESSAGE = "Đường dẫn chi tiết đơn hàng không hợp lệ.";
export function AdminUserOrderDetailPage() {
    const { userId, orderId } = useParams();
    const customerId = Number(userId);
    const hasValidCustomerId = Number.isInteger(customerId) && customerId > 0;
    const hasValidOrderId = typeof orderId === "string" && /^\d+$/.test(orderId);
    const customers = useAdminUserStore((state) => state.customers);
    const loadCustomer = useAdminUserStore((state) => state.loadCustomer);
    const orderDetails = useAdminOrdersStore((state) => state.orderDetails);
    const loadOrder = useAdminOrdersStore((state) => state.loadOrder);
    const customer = hasValidCustomerId
        ? customers.find((candidate) => candidate.id === customerId) ?? null
        : null;
    const order = hasValidOrderId && orderId ? orderDetails[orderId] : undefined;
    const [customerLoading, setCustomerLoading] = useState(false);
    const [customerError, setCustomerError] = useState(null);
    const [orderLoading, setOrderLoading] = useState(false);
    const [orderError, setOrderError] = useState(null);
    useEffect(() => {
        if (!hasValidCustomerId) {
            setCustomerLoading(false);
            setCustomerError(INVALID_ROUTE_MESSAGE);
            return;
        }
        if (customer) {
            setCustomerLoading(false);
            setCustomerError(null);
            return;
        }
        let disposed = false;
        setCustomerLoading(true);
        setCustomerError(null);
        void (async () => {
            const result = await loadCustomer(customerId);
            if (disposed) {
                return;
            }
            setCustomerLoading(false);
            if (!result.success) {
                setCustomerError(result.error ?? "Không thể tải customer.");
            }
        })();
        return () => {
            disposed = true;
        };
    }, [customer, customerId, hasValidCustomerId, loadCustomer]);
    useEffect(() => {
        if (!hasValidCustomerId || !hasValidOrderId || !orderId) {
            setOrderLoading(false);
            setOrderError(INVALID_ROUTE_MESSAGE);
            return;
        }
        let disposed = false;
        setOrderLoading(true);
        setOrderError(null);
        void (async () => {
            const result = await loadOrder(orderId);
            if (disposed) {
                return;
            }
            setOrderLoading(false);
            if (!result.success) {
                setOrderError(result.error ?? "Không thể tải chi tiết đơn hàng.");
            }
        })();
        return () => {
            disposed = true;
        };
    }, [hasValidCustomerId, hasValidOrderId, loadOrder, orderId]);
    const backToOrders = hasValidCustomerId
        ? routes.adminUserOrders(String(customerId))
        : routes.adminUsers;
    const isCustomerMismatch = Boolean(order) &&
        (!order?.customer?.id || String(order.customer.id) !== String(customerId));
    if (!hasValidCustomerId || !hasValidOrderId) {
        return (<div className="space-y-6">
                <AdminPageHeader title="Chi tiết đơn hàng" description="Không thể mở trang chi tiết đơn hàng này." actions={<ButtonLink to={backToOrders} variant="secondary">
                            Quay lại lịch sử đơn hàng
                        </ButtonLink>}/>
                <SurfaceCard className="text-sm text-error">{INVALID_ROUTE_MESSAGE}</SurfaceCard>
            </div>);
    }
    if (customerError && !customer) {
        return (<div className="space-y-6">
                <AdminPageHeader title="Chi tiết đơn hàng" description="Không thể tải thông tin customer để hiển thị chi tiết đơn." actions={<ButtonLink to={backToOrders} variant="secondary">
                            Quay lại lịch sử đơn hàng
                        </ButtonLink>}/>
                <SurfaceCard className="text-sm text-error">{customerError}</SurfaceCard>
            </div>);
    }
    if (orderError && !order) {
        return (<div className="space-y-6">
                <AdminPageHeader title="Chi tiết đơn hàng" description="Không thể tải dữ liệu đơn hàng." actions={<ButtonLink to={backToOrders} variant="secondary">
                            Quay lại lịch sử đơn hàng
                        </ButtonLink>}/>
                <SurfaceCard className="text-sm text-error">{orderError}</SurfaceCard>
            </div>);
    }
    if (isCustomerMismatch) {
        return (<div className="space-y-6">
                <AdminPageHeader title="Chi tiết đơn hàng" description="Đơn hàng này không thuộc customer trên đường dẫn hiện tại." actions={<ButtonLink to={backToOrders} variant="secondary">
                            Quay lại lịch sử đơn hàng
                        </ButtonLink>}/>
                <SurfaceCard className="space-y-3 text-sm">
                    <p className="text-error">Không thể hiển thị sai customer cho đơn hàng này.</p>
                </SurfaceCard>
            </div>);
    }
    return (<div className="space-y-8">
            <AdminPageHeader title={order?.order_no ?? "Chi tiết đơn hàng"} description={customer
            ? `Chi tiết read-only của đơn hàng thuộc ${customer.full_name}.`
            : "Đang tải customer..."} actions={<ButtonLink to={backToOrders} variant="secondary">
                        Quay lại lịch sử đơn hàng
                    </ButtonLink>}/>

            {customerLoading ? (<SurfaceCard className="text-sm text-on-surface-variant">
                    Đang tải thông tin customer...
                </SurfaceCard>) : null}

            {orderLoading && !order ? (<SurfaceCard className="text-sm text-on-surface-variant">
                    Đang tải chi tiết đơn hàng...
                </SurfaceCard>) : null}

            {customer ? (<SurfaceCard className="space-y-2 text-sm">
                    <p className="text-xs font-label uppercase tracking-[0.14em] text-on-surface-variant">
                        Customer
                    </p>
                    <p className="font-semibold text-on-surface">{customer.full_name}</p>
                    <p className="text-on-surface-variant">{customer.email}</p>
                </SurfaceCard>) : null}

            {order ? <ReadOnlyOrderDetailPanel order={order}/> : null}
        </div>);
}
