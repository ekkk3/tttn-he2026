import { useEffect, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { apiRequest } from "@/shared/api/backend-client";
import { formatCurrency } from "@/shared/lib/format";
import { useAuthStore } from "@/shared/lib/store/use-auth-store";

function compactCurrency(value) {
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value % 1_000_000 === 0 ? 0 : 1)}M`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(value % 1_000 === 0 ? 0 : 1)}k`;
    return `${value}`;
}

export function SupplierRevenuePage() {
    const accessToken = useAuthStore((state) => state.accessToken);
    const [data, setData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!accessToken) return;
        setIsLoading(true);
        apiRequest("/supplier/revenue", { token: accessToken })
            .then((response) => setData(response.data))
            .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Không thể tải báo cáo doanh thu."))
            .finally(() => setIsLoading(false));
    }, [accessToken]);

    const hasChartData = (data?.revenue_chart ?? []).some((point) => point.revenue > 0);

    const metrics = data
        ? [
              { label: "Doanh thu (đã giao)", value: formatCurrency(data.total_revenue), icon: "payments" },
              { label: "Số đơn đã giao", value: `${data.order_count}`, icon: "shopping_bag" },
              { label: "Sản phẩm đã bán", value: `${data.units_sold}`, icon: "inventory_2" },
              { label: "Giá trị đơn TB", value: formatCurrency(data.average_order_value), icon: "sell" },
          ]
        : [];

    return (
        <div className="space-y-6 p-6">
            <div>
                <h1 className="font-headline text-2xl font-bold text-on-surface">Báo cáo doanh thu</h1>
                <p className="mt-1 text-sm text-on-surface-variant">
                    Doanh thu từ các đơn đã giao có sản phẩm của bạn.
                </p>
            </div>

            {error ? <div className="rounded-3xl bg-white p-6 text-sm text-error shadow-sm">{error}</div> : null}
            {isLoading ? (
                <div className="rounded-3xl bg-white p-6 text-sm text-on-surface-variant shadow-sm">Đang tải báo cáo...</div>
            ) : data ? (
                <>
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        {metrics.map((metric) => (
                            <div key={metric.label} className="rounded-3xl bg-white p-5 shadow-sm">
                                <div className="flex items-center gap-2 text-on-surface-variant">
                                    <span className="material-symbols-outlined text-xl">{metric.icon}</span>
                                    <p className="text-xs uppercase tracking-widest">{metric.label}</p>
                                </div>
                                <p className="mt-3 font-headline text-2xl font-bold text-on-surface">{metric.value}</p>
                            </div>
                        ))}
                    </div>

                    <div className="rounded-3xl bg-white p-6 shadow-sm">
                        <h2 className="font-headline text-lg font-bold">Biểu đồ doanh thu 30 ngày</h2>
                        {hasChartData ? (
                            <div className="mt-4 h-72">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={data.revenue_chart} margin={{ top: 16, right: 16, left: 8, bottom: 8 }}>
                                        <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" vertical={false} />
                                        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
                                        <YAxis tickLine={false} axisLine={false} width={52} tick={{ fill: "#64748b", fontSize: 12 }} tickFormatter={compactCurrency} />
                                        <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                                        <Line type="monotone" dataKey="revenue" stroke="#0f766e" strokeWidth={3} dot={{ r: 3 }} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        ) : (
                            <p className="mt-4 rounded-2xl bg-surface-container-low p-6 text-sm text-on-surface-variant">
                                Chưa có doanh thu trong 30 ngày qua. Doanh thu được ghi nhận khi đơn hàng giao thành công.
                            </p>
                        )}
                    </div>

                    <div className="rounded-3xl bg-white p-6 shadow-sm">
                        <h2 className="font-headline text-lg font-bold">Sản phẩm theo doanh thu</h2>
                        <div className="mt-4 space-y-2">
                            {data.top_products.map((product) => (
                                <div key={product.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-surface-container-low p-4">
                                    <div>
                                        <p className="font-semibold text-on-surface">{product.name}</p>
                                        <p className="text-sm text-on-surface-variant">{product.sku ?? "—"} · Đã bán {product.sold_quantity}</p>
                                    </div>
                                    <span className="font-semibold text-primary">{formatCurrency(product.revenue)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </>
            ) : null}
        </div>
    );
}
