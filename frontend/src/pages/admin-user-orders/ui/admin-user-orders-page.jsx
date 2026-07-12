import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { routes } from "@/shared/config/routes";
import { formatCurrency, formatDate } from "@/shared/lib/format";
import { useAdminUserStore } from "@/shared/lib/store/use-admin-user-store";
import { AdminPageHeader, Badge, Button, ButtonLink, SurfaceCard } from "@/shared/ui";
import {
    adminOrderStatusLabel,
    adminOrderStatusTone,
    adminPaymentStatusLabel,
    adminPaymentStatusTone,
} from "@/widgets/admin-user-orders/order-detail-labels";
const PAGE_SIZE = 5;
const INVALID_CUSTOMER_MESSAGE = "User id khong hop le.";
export function AdminUserOrdersPage() {
    const { userId } = useParams();
    const customerId = Number(userId);
    const hasValidCustomerId = Number.isInteger(customerId) && customerId > 0;
    const customers = useAdminUserStore((state) => state.customers);
    const loadCustomer = useAdminUserStore((state) => state.loadCustomer);
    const loadCustomerOrders = useAdminUserStore((state) => state.loadCustomerOrders);
    const customerOrdersByCustomerId = useAdminUserStore((state) => state.customerOrdersByCustomerId);
    const customerOrdersPaginationByCustomerId = useAdminUserStore((state) => state.customerOrdersPaginationByCustomerId);
    const customerOrdersLoadingByCustomerId = useAdminUserStore((state) => state.customerOrdersLoadingByCustomerId);
    const customerOrdersErrorByCustomerId = useAdminUserStore((state) => state.customerOrdersErrorByCustomerId);
    const [currentPage, setCurrentPage] = useState(1);
    const [customerLoading, setCustomerLoading] = useState(false);
    const [customerError, setCustomerError] = useState(null);
    const customer = hasValidCustomerId
        ? customers.find((candidate) => candidate.id === customerId) ?? null
        : null;
    const orders = hasValidCustomerId ? customerOrdersByCustomerId[customerId] ?? [] : [];
    const pagination = hasValidCustomerId
        ? customerOrdersPaginationByCustomerId[customerId] ?? null
        : null;
    const ordersLoading = hasValidCustomerId
        ? customerOrdersLoadingByCustomerId[customerId] ?? false
        : false;
    const ordersError = hasValidCustomerId ? customerOrdersErrorByCustomerId[customerId] ?? null : null;
    useEffect(() => {
        setCurrentPage(1);
    }, [customerId]);
    useEffect(() => {
        if (!hasValidCustomerId) {
            setCustomerLoading(false);
            setCustomerError(INVALID_CUSTOMER_MESSAGE);
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
                setCustomerError(result.error ?? "Khong the tai customer.");
            }
        })();
        return () => {
            disposed = true;
        };
    }, [customer, customerId, hasValidCustomerId, loadCustomer]);
    useEffect(() => {
        if (!hasValidCustomerId) {
            return;
        }
        void loadCustomerOrders(customerId, currentPage, PAGE_SIZE);
    }, [currentPage, customerId, hasValidCustomerId, loadCustomerOrders]);
    if (!hasValidCustomerId || (customerError && !customer)) {
        return (<div className="space-y-6">
                <AdminPageHeader title="Lich su don hang" description="Khong the mo trang lich su don hang cho customer nay." actions={<ButtonLink to={routes.adminUsers} variant="secondary">
                            Quay lai users
                        </ButtonLink>}/>
                <SurfaceCard className="space-y-4 text-sm">
                    <p className="text-error">{customerError ?? INVALID_CUSTOMER_MESSAGE}</p>
                </SurfaceCard>
            </div>);
    }
    return (<div className="space-y-8">
            <AdminPageHeader title="Lich su don hang" description={customer
            ? `Danh sach don read-only cua ${customer.full_name}.`
            : "Dang tai customer..."} actions={<ButtonLink to={routes.adminUsers} variant="secondary">
                        Quay lai users
                    </ButtonLink>}/>

            <SurfaceCard className="space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <p className="text-xs font-label uppercase tracking-[0.14em] text-on-surface-variant">
                            Customer
                        </p>
                        <h2 className="mt-2 font-headline text-2xl font-bold text-on-surface">
                            {customer?.full_name ?? "Dang tai..."}
                        </h2>
                        <p className="mt-1 text-sm text-on-surface-variant">
                            {customer?.email ?? "Dang tai thong tin customer..."}
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                        {customer ? (<Badge tone={customer.is_active && !customer.is_deleted ? "success" : "warning"}>
                                {customer.is_active && !customer.is_deleted ? "ACTIVE" : "INACTIVE"}
                            </Badge>) : null}
                        {pagination ? <Badge tone="secondary">{pagination.total} don</Badge> : null}
                    </div>
                </div>
            </SurfaceCard>

            {customerLoading ? (<SurfaceCard className="text-sm text-on-surface-variant">
                    Dang tai thong tin customer...
                </SurfaceCard>) : null}

            {ordersError ? <SurfaceCard className="text-sm text-error">{ordersError}</SurfaceCard> : null}

            {!ordersLoading && !ordersError && orders.length === 0 ? (<SurfaceCard className="space-y-3 text-sm">
                    <h3 className="font-semibold text-on-surface">Customer nay chua co don hang nao.</h3>
                    <p className="text-on-surface-variant">
                        Khi customer phat sinh don moi, lich su don hang se duoc hien thi tai day.
                    </p>
                </SurfaceCard>) : null}

            {ordersLoading ? (<SurfaceCard className="text-sm text-on-surface-variant">
                    Dang tai lich su don hang...
                </SurfaceCard>) : null}

            {!ordersLoading && orders.length > 0 ? (<div className="space-y-4">
                    {orders.map((order) => (<SurfaceCard key={order.id} className="space-y-4">
                            <div className="flex flex-wrap items-start justify-between gap-4">
                                <div className="space-y-2">
                                    <div>
                                        <p className="font-semibold text-on-surface">{order.order_no}</p>
                                        <p className="text-sm text-on-surface-variant">
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

                                <div className="flex min-w-[12rem] flex-col items-end gap-3">
                                    <div className="text-right">
                                        <p className="text-sm text-on-surface-variant">Tong tien</p>
                                        <p className="font-semibold text-primary">
                                            {formatCurrency(Number(order.total_amount))}
                                        </p>
                                    </div>
                                    <ButtonLink to={routes.adminUserOrderDetail(String(customerId), String(order.id))} variant="outline" size="sm">
                                        Xem chi tiet
                                    </ButtonLink>
                                </div>
                            </div>
                        </SurfaceCard>))}

                    {pagination && pagination.lastPage > 1 ? (<SurfaceCard className="flex flex-wrap items-center justify-between gap-3 text-sm">
                            <p className="text-on-surface-variant">
                                Trang {pagination.currentPage} / {pagination.lastPage}
                            </p>
                            <div className="flex gap-3">
                                <Button variant="secondary" size="sm" disabled={ordersLoading || pagination.currentPage <= 1} onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}>
                                    Trang truoc
                                </Button>
                                <Button variant="secondary" size="sm" disabled={ordersLoading || pagination.currentPage >= pagination.lastPage} onClick={() => setCurrentPage((page) => Math.min(pagination.lastPage, page + 1))}>
                                    Trang sau
                                </Button>
                            </div>
                        </SurfaceCard>) : null}
                </div>) : null}
        </div>);
}
