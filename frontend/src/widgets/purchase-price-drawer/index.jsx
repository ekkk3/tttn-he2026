import { useEffect, useState } from "react";
import { Badge, Button, Icon, Input, Select, SurfaceCard } from "@/shared/ui";

// Form thêm/sửa 1 dòng lịch sử giá nhập (UC 2.2.24 Quản lý giá nhập sản phẩm) — khác với
// ô "Sửa giá nhập hiện tại" nhanh trong drawer chi tiết tồn kho (đó chỉ sửa 1 giá trị scalar
// products.purchase_price; ở đây là quản lý NHIỀU dòng lịch sử theo NCC/ngày áp dụng).
export function PurchasePriceDrawer({ open, mode, record, products, suppliers, onClose, onSubmit }) {
    const [draft, setDraft] = useState({
        productId: "",
        supplierId: "",
        price: "",
        effectiveDate: new Date().toISOString().slice(0, 10),
        note: "",
    });
    const [error, setError] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (mode === "edit" && record) {
            setDraft({
                productId: record.productId,
                supplierId: record.supplierId ?? "",
                price: String(record.price ?? ""),
                effectiveDate: record.effectiveDate ? record.effectiveDate.slice(0, 10) : "",
                note: record.note ?? "",
            });
        } else {
            setDraft({
                productId: products[0]?.id ?? "",
                supplierId: "",
                price: "",
                effectiveDate: new Date().toISOString().slice(0, 10),
                note: "",
            });
        }
        setError("");
    }, [mode, record, open, products]);

    if (!open) return null;

    async function handleSubmit() {
        if (!draft.productId) {
            setError("Vui lòng chọn sản phẩm.");
            return;
        }
        const priceValue = Number(draft.price);
        if (draft.price === "" || Number.isNaN(priceValue) || priceValue < 0) {
            setError("Giá nhập không hợp lệ.");
            return;
        }
        if (!draft.effectiveDate) {
            setError("Vui lòng chọn ngày áp dụng.");
            return;
        }
        setIsSaving(true);
        setError("");
        const result = await onSubmit({ ...draft, price: priceValue });
        setIsSaving(false);
        if (!result?.success) {
            setError(result?.error ?? "Không thể lưu giá nhập.");
            return;
        }
        onClose();
    }

    return (
        <div className="fixed inset-0 z-[80] bg-on-surface/30 backdrop-blur-sm">
            <div className="absolute inset-y-0 right-0 w-full max-w-lg overflow-y-auto bg-surface p-6 shadow-ambient">
                <div className="mb-6 flex items-start justify-between gap-4">
                    <div>
                        <p className="text-xs uppercase tracking-widest text-on-surface-variant">
                            {mode === "edit" ? "Chỉnh sửa giá nhập" : "Thêm giá nhập mới"}
                        </p>
                        <h3 className="mt-2 font-headline text-2xl font-bold text-primary">
                            Giá nhập sản phẩm
                        </h3>
                    </div>
                    <button className="rounded-full bg-surface-container-low p-2 text-on-surface-variant transition hover:text-primary" onClick={onClose} aria-label="Đóng biểu mẫu">
                        <Icon name="close" />
                    </button>
                </div>

                <SurfaceCard tone="lowest" className="space-y-4">
                    <label className="space-y-2 text-sm">
                        <span className="font-medium text-on-surface">Sản phẩm</span>
                        <Select
                            value={draft.productId}
                            disabled={mode === "edit"}
                            onChange={(event) => setDraft((current) => ({ ...current, productId: event.target.value }))}
                        >
                            {products.map((product) => (
                                <option key={product.id} value={product.id}>
                                    {product.sku} — {product.name}
                                </option>
                            ))}
                        </Select>
                    </label>

                    <label className="space-y-2 text-sm">
                        <span className="font-medium text-on-surface">Nhà cung cấp</span>
                        <Select
                            value={draft.supplierId}
                            onChange={(event) => setDraft((current) => ({ ...current, supplierId: event.target.value }))}
                        >
                            <option value="">Theo NCC mặc định của sản phẩm</option>
                            {suppliers.map((supplier) => (
                                <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
                            ))}
                        </Select>
                    </label>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <label className="space-y-2 text-sm">
                            <span className="font-medium text-on-surface">Giá nhập (đ)</span>
                            <Input
                                type="number"
                                min={0}
                                step={1000}
                                value={draft.price}
                                onChange={(event) => setDraft((current) => ({ ...current, price: event.target.value }))}
                            />
                        </label>
                        <label className="space-y-2 text-sm">
                            <span className="font-medium text-on-surface">Ngày áp dụng</span>
                            <Input
                                type="date"
                                value={draft.effectiveDate}
                                onChange={(event) => setDraft((current) => ({ ...current, effectiveDate: event.target.value }))}
                            />
                        </label>
                    </div>

                    <label className="space-y-2 text-sm">
                        <span className="font-medium text-on-surface">Ghi chú</span>
                        <textarea
                            className="min-h-20 w-full rounded-2xl border border-transparent bg-surface-container-highest px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary/20 focus:ring-2 focus:ring-primary/15"
                            value={draft.note}
                            onChange={(event) => setDraft((current) => ({ ...current, note: event.target.value }))}
                        />
                    </label>

                    {error ? <p className="text-sm text-error">{error}</p> : null}

                    <div className="flex flex-wrap justify-end gap-3">
                        <Button variant="outline" onClick={onClose}>Hủy</Button>
                        <Button disabled={isSaving} onClick={() => void handleSubmit()}>
                            {isSaving ? "Đang lưu..." : "Lưu"}
                        </Button>
                    </div>
                </SurfaceCard>

                {mode === "edit" && record ? (
                    <SurfaceCard tone="low" className="mt-4 space-y-2">
                        <Badge tone="secondary">Đang sửa #{record.id}</Badge>
                        <p className="text-xs text-on-surface-variant">
                            Tạo lúc {record.createdAt ? new Date(record.createdAt).toLocaleString("vi-VN") : "—"}
                        </p>
                    </SurfaceCard>
                ) : null}
            </div>
        </div>
    );
}
