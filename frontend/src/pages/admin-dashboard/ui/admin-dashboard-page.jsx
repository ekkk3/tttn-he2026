import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, } from "recharts";
import { apiRequest } from "@/shared/api/backend-client";
import { routes } from "@/shared/config/routes";
import { formatCurrency, formatDate } from "@/shared/lib/format";
import { useAuthStore } from "@/shared/lib/store/use-auth-store";
import { useFeedbackStore } from "@/shared/lib/store/use-feedback-store";
import { AdminPageHeader, AdminToolbar, Button, StatCard, SurfaceCard } from "@/shared/ui";
const orderStatusLabels = {
    PENDING: "Chờ xác nhận",
    CONFIRMED: "Đã xác nhận",
    PACKED: "Đã đóng gói",
    SHIPPED: "Đang giao",
    DELIVERED: "Đã giao",
    DELIVERY_FAILED: "Giao thất bại",
    CANCELLED: "Đã hủy",
};
const paymentStatusLabels = {
    PENDING: "Chờ thanh toán",
    SUCCESS: "Thanh toán thành công",
    FAILED: "Thanh toán thất bại",
    REFUNDED: "Đã hoàn tiền",
};
const paymentMethodLabels = {
    COD: "Thanh toán khi nhận hàng",
    BANK_TRANSFER: "Chuyển khoản ngân hàng",
};
function numberValue(value) {
    return Number(value ?? 0);
}
function formatStatus(value, labels) {
    if (!value) {
        return "Chưa có";
    }
    return labels[value] ?? value;
}
function badgeClassForOrder(status) {
    switch (status) {
        case "PENDING":
            return "bg-sky-50 text-sky-700";
        case "CONFIRMED":
            return "bg-indigo-50 text-indigo-700";
        case "PACKED":
            return "bg-violet-50 text-violet-700";
        case "SHIPPED":
            return "bg-amber-50 text-amber-800";
        case "DELIVERED":
            return "bg-emerald-50 text-emerald-700";
        case "DELIVERY_FAILED":
            return "bg-orange-50 text-orange-800";
        case "CANCELLED":
            return "bg-rose-50 text-rose-700";
        default:
            return "bg-slate-100 text-slate-700";
    }
}
function badgeClassForPayment(status) {
    switch (status) {
        case "SUCCESS":
            return "bg-emerald-50 text-emerald-700";
        case "FAILED":
            return "bg-rose-50 text-rose-700";
        case "REFUNDED":
            return "bg-amber-50 text-amber-800";
        default:
            return "bg-slate-100 text-slate-700";
    }
}
// "YYYY-MM-DD" theo giờ ĐỊA PHƯƠNG của trình duyệt.
// Không dùng toISOString(): hàm đó đổi sang UTC nên ở Việt Nam (UTC+7) ngày 01/08 lúc 00:00
// sẽ ra "2026-07-31" — ô "từ ngày" hiện sai 1 ngày và kỳ báo cáo gửi lên backend bị lệch
// sang tháng trước. Backend cũng dùng đúng quy ước giờ địa phương này (dashboard.controller.js).
function toLocalDateIso(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}
function todayIso() {
    return toLocalDateIso(new Date());
}
function firstDayOfMonthIso() {
    const date = new Date();
    return toLocalDateIso(new Date(date.getFullYear(), date.getMonth(), 1));
}
function formatCompactCurrency(value) {
    if (value >= 1_000_000_000) {
        return `${(value / 1_000_000_000).toFixed(value % 1_000_000_000 === 0 ? 0 : 1)}B`;
    }
    if (value >= 1_000_000) {
        return `${(value / 1_000_000).toFixed(value % 1_000_000 === 0 ? 0 : 1)}M`;
    }
    if (value >= 1_000) {
        return `${(value / 1_000).toFixed(value % 1_000 === 0 ? 0 : 1)}k`;
    }
    return `${value}`;
}
function RevenueTooltip({ active, payload, label, }) {
    if (!active || !payload?.length) {
        return null;
    }
    const point = payload[0]?.payload;
    if (!point) {
        return null;
    }
    return (<div className="rounded-2xl border border-emerald-100 bg-white px-4 py-3 shadow-xl">
            <p className="text-sm font-semibold text-slate-900">{label}</p>
            <p className="mt-2 text-sm text-slate-700">Doanh thu: {formatCurrency(point.revenue)}</p>
            <p className="mt-1 text-sm text-slate-700">{point.successful_orders} đơn thành công</p>
        </div>);
}
export function AdminDashboardPage() {
    const navigate = useNavigate();
    const accessToken = useAuthStore((state) => state.accessToken);
    const pushToast = useFeedbackStore((state) => state.pushToast);
    const [dashboard, setDashboard] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [dateFrom, setDateFrom] = useState(firstDayOfMonthIso());
    const [dateTo, setDateTo] = useState(todayIso());
    const [appliedDateFrom, setAppliedDateFrom] = useState(firstDayOfMonthIso());
    const [appliedDateTo, setAppliedDateTo] = useState(todayIso());
    const [chartRange, setChartRange] = useState("30d");
    useEffect(() => {
        if (!accessToken) {
            setIsLoading(false);
            setError("Bạn cần đăng nhập admin để xem dashboard.");
            return;
        }
        let cancelled = false;
        async function loadDashboard() {
            setIsLoading(true);
            setError(null);
            const params = new URLSearchParams();
            if (appliedDateFrom) {
                params.set("date_from", appliedDateFrom);
            }
            if (appliedDateTo) {
                params.set("date_to", appliedDateTo);
            }
            params.set("chart_range", chartRange);
            try {
                const response = await apiRequest(`/admin/dashboard?${params.toString()}`, {
                    token: accessToken,
                });
                if (cancelled) {
                    return;
                }
                setDashboard(response.data);
                setDateFrom(response.data.filters.date_from);
                setDateTo(response.data.filters.date_to);
                setChartRange(response.data.filters.chart_range ?? "30d");
                setIsLoading(false);
            }
            catch (nextError) {
                if (cancelled) {
                    return;
                }
                setError(nextError instanceof Error ? nextError.message : "Không thể tải dashboard.");
                setIsLoading(false);
            }
        }
        void loadDashboard();
        return () => {
            cancelled = true;
        };
    }, [accessToken, appliedDateFrom, appliedDateTo, chartRange]);
    const metrics = useMemo(() => {
        if (!dashboard) {
            return [];
        }
        return [
            {
                id: "metric-revenue",
                label: "Doanh thu thực thu",
                value: formatCurrency(dashboard.metrics.revenue),
                delta: `${dashboard.metrics.successful_orders} đơn DELIVERED + SUCCESS`,
                tone: "primary",
                icon: "payments",
            },
            {
                id: "metric-processing",
                label: "Đơn đang xử lý",
                value: `${dashboard.metrics.processing_orders}`,
                delta: "PENDING, CONFIRMED, PACKED, SHIPPED",
                tone: "secondary",
                icon: "shopping_bag",
            },
            {
                id: "metric-pending",
                label: "Chờ xác nhận",
                value: `${dashboard.metrics.pending_orders}`,
                delta: "Đơn mới cần admin duyệt",
                tone: "tertiary",
                icon: "pending_actions",
            },
            {
                id: "metric-transfer",
                label: "Chờ xác nhận chuyển khoản",
                value: `${dashboard.metrics.bank_transfer_pending}`,
                delta: `${dashboard.metrics.customer_reported_transfer} khách đã báo chuyển khoản`,
                tone: "tertiary",
                icon: "account_balance",
            },
            {
                id: "metric-shipping",
                label: "Đang giao",
                value: `${dashboard.metrics.shipping_orders}`,
                delta: "Đơn đã bàn giao cho vận chuyển",
                tone: "success",
                icon: "local_shipping",
            },
            {
                id: "metric-failed",
                label: "Giao thất bại",
                value: `${dashboard.metrics.delivery_failed_orders}`,
                delta: "Cần giao lại hoặc hủy đơn",
                tone: "secondary",
                icon: "report_problem",
            },
            {
                id: "metric-low-stock",
                label: "Sản phẩm sắp hết hàng",
                value: `${dashboard.metrics.low_stock_products}`,
                delta: `Ngưỡng cảnh báo <= ${dashboard.metrics.low_stock_threshold}`,
                tone: "secondary",
                icon: "inventory_2",
            },
            {
                id: "metric-aov",
                label: "Giá trị đơn trung bình",
                value: formatCurrency(dashboard.metrics.average_order_value),
                delta: `Hôm nay: ${formatCurrency(dashboard.metrics.today_revenue)}`,
                tone: "success",
                icon: "sell",
            },
        ];
    }, [dashboard]);
    const hasRevenueData = useMemo(() => (dashboard?.revenue_chart ?? []).some((item) => item.revenue > 0), [dashboard]);
    function handleExportReport() {
        if (!dashboard) {
            return;
        }
        const payload = JSON.stringify({
            generatedAt: new Date().toISOString(),
            ...dashboard,
        }, null, 2);
        const blob = new Blob([payload], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "admin-dashboard-report.json";
        link.click();
        URL.revokeObjectURL(url);
        pushToast({
            tone: "success",
            message: "Đã xuất báo cáo dashboard từ dữ liệu backend.",
        });
    }
    function handleApplyDateRange() {
        setAppliedDateFrom(dateFrom);
        setAppliedDateTo(dateTo);
        setChartRange("custom");
    }
    function handleChartPreset(nextRange) {
        setChartRange(nextRange);
    }
    return (<div className="space-y-8">
            <AdminPageHeader title="Tổng quan quản trị" description="Theo dõi doanh thu, đơn hàng cần xử lý và các cảnh báo vận hành chính."/>

            <AdminToolbar>
                <div className="grid w-full grid-cols-1 gap-3 lg:grid-cols-[1.45fr_1fr_1fr_0.68fr_0.68fr_0.78fr] lg:items-end">
                    <div className="grid grid-cols-3 gap-2 rounded-2xl bg-surface p-2 shadow-sm">
                        <Button size="sm" className="whitespace-nowrap" variant={chartRange === "7d" ? "primary" : "secondary"} onClick={() => handleChartPreset("7d")}>
                            7 ngày
                        </Button>
                        <Button size="sm" className="whitespace-nowrap" variant={chartRange === "30d" ? "primary" : "secondary"} onClick={() => handleChartPreset("30d")}>
                            30 ngày
                        </Button>
                        <Button size="sm" className="whitespace-nowrap" variant={chartRange === "this_month" ? "primary" : "secondary"} onClick={() => handleChartPreset("this_month")}>
                            Tháng này
                        </Button>
                    </div>

                    <label className="flex min-w-0 flex-col gap-2 text-sm">
                        <input type="date" className="min-w-0 rounded-2xl bg-surface-container-highest px-4 py-3 outline-none" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)}/>
                    </label>

                    <label className="flex min-w-0 flex-col gap-2 text-sm">
                        <input type="date" className="min-w-0 rounded-2xl bg-surface-container-highest px-4 py-3 outline-none" value={dateTo} onChange={(event) => setDateTo(event.target.value)}/>
                    </label>

                    <Button size="sm" variant="secondary" className="whitespace-nowrap px-3" onClick={handleApplyDateRange}>
                        Áp dụng
                    </Button>
                    <Button size="sm" variant="secondary" className="whitespace-nowrap px-3" onClick={() => window.location.reload()}>
                        Tải lại
                    </Button>
                    <Button size="sm" className="whitespace-nowrap px-3" onClick={handleExportReport} disabled={!dashboard}>
                        Xuất báo cáo
                    </Button>
                </div>
            </AdminToolbar>

            {error ? <SurfaceCard className="text-sm text-error">{error}</SurfaceCard> : null}

            {isLoading ? (<SurfaceCard className="text-sm text-on-surface-variant">
                    Đang tải dữ liệu dashboard...
                </SurfaceCard>) : null}

            {dashboard ? (<>
                    <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
                        {metrics.map((metric) => (<StatCard key={metric.id} metric={metric}/>))}
                    </section>

                    <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
                        <SurfaceCard className="space-y-6">
                            <div className="flex flex-wrap items-end justify-between gap-3 border-b border-outline-variant/15 pb-4">
                                <div>
                                    <h3 className="font-headline text-2xl font-bold">Biểu đồ doanh thu</h3>
                                </div>
                            </div>

                            {hasRevenueData ? (<div className="h-[22rem] rounded-[1.75rem] bg-gradient-to-br from-emerald-50 via-white to-sky-50 p-4">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={dashboard.revenue_chart} margin={{ top: 16, right: 16, left: 8, bottom: 8 }}>
                                            <CartesianGrid stroke="#dbe7df" strokeDasharray="3 3" vertical={false}/>
                                            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 12 }}/>
                                            <YAxis tickLine={false} axisLine={false} width={52} tick={{ fill: "#64748b", fontSize: 12 }} tickFormatter={(value) => formatCompactCurrency(value)}/>
                                            <Tooltip content={<RevenueTooltip />} cursor={{ stroke: "#0f766e", strokeOpacity: 0.12 }}/>
                                            <Line type="monotone" dataKey="revenue" stroke="#0f766e" strokeWidth={3} dot={{ r: 4, fill: "#0f766e", stroke: "#ecfdf5", strokeWidth: 2 }} activeDot={{ r: 6, fill: "#065f46", stroke: "#d1fae5", strokeWidth: 3 }}/>
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>) : (<div className="flex h-[22rem] items-center justify-center rounded-[1.75rem] bg-surface-container-low text-center">
                                    <div>
                                        <p className="font-semibold text-on-surface">
                                            Chưa có doanh thu thành công trong khoảng thời gian này.
                                        </p>
                                        <p className="mt-2 text-sm text-on-surface-variant">
                                            Hệ thống chỉ ghi nhận khi đơn đã giao thành công và thanh toán thành công.
                                        </p>
                                    </div>
                                </div>)}
                        </SurfaceCard>

                        <SurfaceCard className="space-y-4">
                            <div className="border-b border-outline-variant/15 pb-4">
                                <h3 className="font-headline text-2xl font-bold">Khách hàng chi tiêu cao</h3>
                            </div>
                            <div className="space-y-3">
                                {dashboard.top_customers.map((customer) => (<div key={customer.id} className="rounded-2xl bg-surface-container-low p-4">
                                        <div className="flex items-start justify-between gap-4">
                                            <div>
                                                <p className="font-semibold text-on-surface">{customer.full_name}</p>
                                                <p className="mt-1 text-sm text-on-surface-variant">{customer.email}</p>
                                                <p className="mt-2 text-xs text-on-surface-variant">
                                                    {customer.successful_orders} đơn thành công
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-semibold text-primary">
                                                    {formatCurrency(customer.total_revenue)}
                                                </p>
                                                <p className="mt-1 text-xs text-on-surface-variant">
                                                    {customer.last_delivered_at
                    ? formatDate(customer.last_delivered_at)
                    : "Chưa có"}
                                                </p>
                                            </div>
                                        </div>
                                    </div>))}
                            </div>
                        </SurfaceCard>
                    </section>

                    <section className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
                        <SurfaceCard className="space-y-4">
                            <div className="flex flex-wrap items-end justify-between gap-3 border-b border-outline-variant/15 pb-4">
                                <div>
                                    <h3 className="font-headline text-2xl font-bold">Đơn cần xử lý</h3>
                                    <p className="mt-1 text-sm text-on-surface-variant">
                                        Các đầu việc admin cần theo dõi trong ngày.
                                    </p>
                                </div>
                                <Button variant="secondary" onClick={() => void navigate(routes.adminLogistics)}>
                                    Mở logistics
                                </Button>
                            </div>

                            <div className="space-y-5">
                                {dashboard.work_queue.map((queue) => (<div key={queue.key} className="space-y-3 rounded-2xl bg-surface-container-low p-4">
                                        <div className="flex items-center justify-between gap-3">
                                            <div>
                                                <p className="font-semibold text-on-surface">{queue.label}</p>
                                                <p className="mt-1 text-sm text-on-surface-variant">
                                                    {queue.count} đơn cần theo dõi
                                                </p>
                                            </div>
                                            <span className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-primary shadow-sm">
                                                {queue.count}
                                            </span>
                                        </div>

                                        {queue.orders.length === 0 ? (<div className="rounded-2xl bg-white px-4 py-4 text-sm text-on-surface-variant">
                                                Hiện không có đơn trong nhóm này.
                                            </div>) : (<div className="space-y-3">
                                                {queue.orders.map((order) => (<div key={order.id} className="rounded-2xl bg-white px-4 py-4 shadow-sm">
                                                        <div className="flex flex-wrap items-start justify-between gap-4">
                                                            <div>
                                                                <p className="font-semibold text-on-surface">
                                                                    {order.order_no}
                                                                </p>
                                                                <p className="mt-1 text-sm text-on-surface-variant">
                                                                    {order.customer?.full_name ?? "Khách hàng không rõ"} ·{" "}
                                                                    {formatDate(order.created_at)}
                                                                </p>
                                                                <p className="mt-1 text-sm text-on-surface-variant">
                                                                    {paymentMethodLabels[order.payment_method] ?? order.payment_method}
                                                                    {" · "}
                                                                    {formatStatus(order.payment_status, paymentStatusLabels)}
                                                                </p>
                                                            </div>
                                                            <div className="text-right">
                                                                <p className="font-semibold text-primary">
                                                                    {formatCurrency(numberValue(order.total_amount))}
                                                                </p>
                                                                <div className="mt-2 flex flex-wrap justify-end gap-2">
                                                                    <span className={`rounded-full px-3 py-1 text-xs font-medium ${badgeClassForOrder(order.status)}`}>
                                                                        {formatStatus(order.status, orderStatusLabels)}
                                                                    </span>
                                                                    <Button variant="secondary" onClick={() => void navigate(routes.adminLogistics)}>
                                                                        Xem / Xử lý
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>))}
                                            </div>)}
                                    </div>))}
                            </div>
                        </SurfaceCard>

                        <SurfaceCard className="space-y-4">
                            <div className="border-b border-outline-variant/15 pb-4">
                                <h3 className="font-headline text-2xl font-bold">Cảnh báo tồn kho</h3>
                            </div>
                            <div className="grid gap-3 rounded-2xl bg-surface-container-low px-4 py-4 text-sm">
                                <div className="flex items-center justify-between">
                                    <span className="text-on-surface-variant">Tổng sản phẩm đang bán</span>
                                    <span className="font-semibold">{dashboard.metrics.product_count}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-on-surface-variant">Sản phẩm sắp hết hàng</span>
                                    <span className="font-semibold">{dashboard.metrics.low_stock_products}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-on-surface-variant">Ngưỡng cảnh báo</span>
                                    <span className="font-semibold">≤ {dashboard.metrics.low_stock_threshold}</span>
                                </div>
                            </div>

                            <div className="space-y-3">
                                {dashboard.low_stock_products.map((product) => (<div key={product.id} className="rounded-2xl bg-surface-container-low p-4">
                                        <div className="flex items-start justify-between gap-4">
                                            <div>
                                                <p className="font-semibold text-on-surface">{product.name}</p>
                                                <p className="mt-1 text-sm text-on-surface-variant">{product.sku}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-semibold text-primary">
                                                    {formatCurrency(product.sale_price)}
                                                </p>
                                                <p className="mt-1 text-sm text-on-surface-variant">
                                                    Tồn kho: {product.stock_quantity}
                                                </p>
                                            </div>
                                        </div>
                                    </div>))}
                            </div>
                        </SurfaceCard>
                    </section>

                    <section className="grid gap-6 xl:grid-cols-2">
                        <SurfaceCard className="space-y-4">
                            <div className="border-b border-outline-variant/15 pb-4">
                                <h3 className="font-headline text-2xl font-bold">Sản phẩm bán chạy</h3>
                            </div>
                            <div className="space-y-3">
                                {dashboard.featured_products.map((product) => (<div key={product.id ?? product.sku} className="rounded-2xl bg-surface-container-low p-4">
                                        <div className="flex items-start justify-between gap-4">
                                            <div>
                                                <p className="font-semibold text-on-surface">{product.name}</p>
                                                <p className="mt-1 text-sm text-on-surface-variant">{product.sku}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-semibold text-primary">
                                                    {formatCurrency(product.revenue)}
                                                </p>
                                                <p className="mt-1 text-sm text-on-surface-variant">
                                                    {product.sold_quantity} sản phẩm
                                                </p>
                                            </div>
                                        </div>
                                        <div className="mt-3 grid gap-2 rounded-2xl bg-white px-4 py-4 text-sm shadow-sm">
                                            <div className="flex items-center justify-between">
                                                <span className="text-on-surface-variant">Doanh thu sản phẩm</span>
                                                <span>{formatCurrency(product.revenue)}</span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-on-surface-variant">Số lượng đã bán</span>
                                                <span>{product.sold_quantity}</span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-on-surface-variant">Tồn kho hiện tại</span>
                                                <span>{product.stock_quantity}</span>
                                            </div>
                                        </div>
                                    </div>))}
                            </div>
                        </SurfaceCard>

                        <SurfaceCard className="space-y-4">
                            <div className="border-b border-outline-variant/15 pb-4">
                                <h3 className="font-headline text-2xl font-bold">Đơn gần đây</h3>
                            </div>
                            <div className="space-y-3">
                                {dashboard.recent_orders.map((order) => (<div key={order.id} className="rounded-2xl bg-surface-container-low p-4">
                                        <div className="flex flex-wrap items-start justify-between gap-3">
                                            <div>
                                                <p className="font-semibold text-on-surface">{order.order_no}</p>
                                                <p className="mt-1 text-sm text-on-surface-variant">
                                                    {order.customer?.full_name ?? "Khách hàng không rõ"} ·{" "}
                                                    {formatDate(order.created_at)}
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-semibold text-primary">
                                                    {formatCurrency(numberValue(order.total_amount))}
                                                </p>
                                                <p className="mt-1 text-xs text-on-surface-variant">
                                                    {paymentMethodLabels[order.payment_method] ?? order.payment_method}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="mt-3 flex flex-wrap gap-2">
                                            <span className={`rounded-full px-3 py-1 text-xs font-medium ${badgeClassForOrder(order.status)}`}>
                                                {formatStatus(order.status, orderStatusLabels)}
                                            </span>
                                            <span className={`rounded-full px-3 py-1 text-xs font-medium ${badgeClassForPayment(order.payment_status)}`}>
                                                {formatStatus(order.payment_status, paymentStatusLabels)}
                                            </span>
                                        </div>
                                    </div>))}
                            </div>
                        </SurfaceCard>
                    </section>
                </>) : null}
        </div>);
}
