import { useEffect, useState } from "react";
import { apiRequest } from "@/shared/api/backend-client";
import { hasAdminPermission } from "@/shared/lib/auth";
import { formatCurrency } from "@/shared/lib/format";
import { useAuthStore } from "@/shared/lib/store/use-auth-store";
import { useFeedbackStore } from "@/shared/lib/store/use-feedback-store";
import { AdminPageHeader, Badge, Button, StatCard, SurfaceCard } from "@/shared/ui";

const emptyForm = {
    code: "",
    description: "",
    discount_type: "PERCENT",
    discount_value: "10",
    min_order_amount: "0",
    max_discount_amount: "",
    usage_limit: "",
};

export function AdminVouchersPage() {
    const accessToken = useAuthStore((state) => state.accessToken);
    const user = useAuthStore((state) => state.session?.user ?? null);
    const pushToast = useFeedbackStore((state) => state.pushToast);
    const canManage = hasAdminPermission(user, "admin.vouchers.manage");

    const [vouchers, setVouchers] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const [form, setForm] = useState(emptyForm);
    const [isSaving, setIsSaving] = useState(false);

    async function loadVouchers() {
        if (!accessToken) return;
        setIsLoading(true);
        setError("");
        try {
            const response = await apiRequest("/admin/vouchers", { token: accessToken });
            setVouchers(response.data ?? []);
        } catch (loadError) {
            setError(loadError instanceof Error ? loadError.message : "Không thể tải voucher.");
        } finally {
            setIsLoading(false);
        }
    }

    useEffect(() => {
        void loadVouchers();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [accessToken]);

    function updateField(key, value) {
        setForm((current) => ({ ...current, [key]: value }));
    }

    async function handleCreate(event) {
        event.preventDefault();
        if (!form.code.trim() || !form.discount_value) {
            pushToast({ tone: "warning", message: "Cần nhập mã và giá trị giảm." });
            return;
        }
        setIsSaving(true);
        try {
            await apiRequest("/admin/vouchers", {
                method: "POST",
                token: accessToken,
                body: {
                    code: form.code.trim().toUpperCase(),
                    description: form.description.trim() || null,
                    discount_type: form.discount_type,
                    discount_value: Number(form.discount_value),
                    min_order_amount: Number(form.min_order_amount) || 0,
                    max_discount_amount: form.max_discount_amount ? Number(form.max_discount_amount) : null,
                    usage_limit: form.usage_limit ? Number(form.usage_limit) : null,
                },
            });
            setForm(emptyForm);
            await loadVouchers();
            pushToast({ tone: "success", message: "Đã tạo voucher." });
        } catch (createError) {
            pushToast({ tone: "warning", message: createError instanceof Error ? createError.message : "Không thể tạo voucher." });
        } finally {
            setIsSaving(false);
        }
    }

    async function toggleActive(voucher) {
        try {
            if (voucher.is_active) {
                await apiRequest(`/admin/vouchers/${voucher.id}`, { method: "DELETE", token: accessToken });
            } else {
                await apiRequest(`/admin/vouchers/${voucher.id}`, { method: "PUT", token: accessToken, body: { is_active: true } });
            }
            await loadVouchers();
        } catch (actionError) {
            pushToast({ tone: "warning", message: actionError instanceof Error ? actionError.message : "Không thể cập nhật." });
        }
    }

    return (
        <div className="space-y-8">
            <AdminPageHeader title="Quản lý Voucher" description="Tạo và quản lý mã giảm giá (UC 2.2.14a)." />

            <section className="grid gap-6 xl:grid-cols-3">
                <StatCard metric={{ id: "voucher-total", label: "Tổng voucher", value: `${vouchers.length}`, tone: "primary", icon: "sell", delta: "Tất cả mã" }} />
                <StatCard metric={{ id: "voucher-active", label: "Đang hoạt động", value: `${vouchers.filter((v) => v.is_active).length}`, tone: "success", icon: "check_circle", delta: "Khách có thể dùng" }} />
            </section>

            {canManage ? (
                <SurfaceCard className="space-y-4">
                    <h3 className="font-headline text-xl font-bold">Tạo voucher mới</h3>
                    <form className="grid gap-4 md:grid-cols-3" onSubmit={handleCreate}>
                        <input className="rounded-2xl bg-surface-container-highest px-4 py-3 text-sm outline-none" placeholder="Mã (VD: SALE10)" value={form.code} onChange={(e) => updateField("code", e.target.value)} />
                        <select className="rounded-2xl bg-surface-container-highest px-4 py-3 text-sm outline-none" value={form.discount_type} onChange={(e) => updateField("discount_type", e.target.value)}>
                            <option value="PERCENT">Giảm theo %</option>
                            <option value="FIXED">Giảm số tiền cố định</option>
                        </select>
                        <input className="rounded-2xl bg-surface-container-highest px-4 py-3 text-sm outline-none" type="number" min={0} placeholder={form.discount_type === "PERCENT" ? "Phần trăm giảm" : "Số tiền giảm"} value={form.discount_value} onChange={(e) => updateField("discount_value", e.target.value)} />
                        <input className="rounded-2xl bg-surface-container-highest px-4 py-3 text-sm outline-none" type="number" min={0} placeholder="Đơn tối thiểu" value={form.min_order_amount} onChange={(e) => updateField("min_order_amount", e.target.value)} />
                        <input className="rounded-2xl bg-surface-container-highest px-4 py-3 text-sm outline-none" type="number" min={0} placeholder="Giảm tối đa (tùy chọn)" value={form.max_discount_amount} onChange={(e) => updateField("max_discount_amount", e.target.value)} />
                        <input className="rounded-2xl bg-surface-container-highest px-4 py-3 text-sm outline-none" type="number" min={0} placeholder="Giới hạn lượt (tùy chọn)" value={form.usage_limit} onChange={(e) => updateField("usage_limit", e.target.value)} />
                        <input className="rounded-2xl bg-surface-container-highest px-4 py-3 text-sm outline-none md:col-span-2" placeholder="Mô tả" value={form.description} onChange={(e) => updateField("description", e.target.value)} />
                        <Button type="submit" disabled={isSaving}>{isSaving ? "Đang tạo..." : "Tạo voucher"}</Button>
                    </form>
                </SurfaceCard>
            ) : null}

            <SurfaceCard className="space-y-3">
                {error ? <p className="text-sm text-error">{error}</p> : null}
                {isLoading ? (
                    <p className="text-sm text-on-surface-variant">Đang tải voucher...</p>
                ) : vouchers.length === 0 ? (
                    <p className="rounded-2xl bg-surface-container-low p-4 text-sm text-on-surface-variant">Chưa có voucher nào.</p>
                ) : (
                    vouchers.map((voucher) => (
                        <div key={voucher.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-outline-variant/15 bg-surface-container-low p-4">
                            <div>
                                <div className="flex items-center gap-2">
                                    <p className="font-mono font-bold text-on-surface">{voucher.code}</p>
                                    <Badge tone={voucher.is_active ? "success" : "warning"}>{voucher.is_active ? "Đang bật" : "Đã tắt"}</Badge>
                                </div>
                                <p className="mt-1 text-sm text-on-surface-variant">
                                    {voucher.discount_type === "PERCENT" ? `Giảm ${voucher.discount_value}%` : `Giảm ${formatCurrency(voucher.discount_value)}`}
                                    {" · "}Đơn tối thiểu {formatCurrency(voucher.min_order_amount)}
                                    {voucher.usage_limit != null ? ` · Đã dùng ${voucher.used_count}/${voucher.usage_limit}` : ""}
                                </p>
                                {voucher.description ? <p className="mt-1 text-xs text-on-surface-variant">{voucher.description}</p> : null}
                            </div>
                            <Button size="sm" variant={voucher.is_active ? "outline" : "secondary"} disabled={!canManage} onClick={() => void toggleActive(voucher)}>
                                {voucher.is_active ? "Tắt" : "Bật lại"}
                            </Button>
                        </div>
                    ))
                )}
            </SurfaceCard>
        </div>
    );
}
