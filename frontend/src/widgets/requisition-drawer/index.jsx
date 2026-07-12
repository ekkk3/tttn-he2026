import { useEffect, useState } from "react";
import { formatCurrency } from "@/shared/lib/format";
import { inventoryHealthLabels } from "@/shared/lib/labels";
import { Badge, Button, Icon, Input, SurfaceCard, cn } from "@/shared/ui";
export function RequisitionDrawer({ open, inventoryItem, suppliers, onClose, onSubmit, }) {
    const [draft, setDraft] = useState({
        supplierId: inventoryItem?.supplierId ?? suppliers[0]?.id ?? "",
        requestedQty: Math.max(20, inventoryItem?.reorderPoint ?? 20),
        etaDays: 5,
        note: "Bổ sung tồn kho do nhu cầu tăng.",
    });
    const [error, setError] = useState("");
    useEffect(() => {
        if (!inventoryItem)
            return;
        setDraft({
            supplierId: inventoryItem.supplierId,
            requestedQty: Math.max(20, inventoryItem.reorderPoint),
            etaDays: 5,
            note: "Bổ sung tồn kho do nhu cầu tăng.",
        });
        setError("");
    }, [inventoryItem]);
    if (!open)
        return null;
    const selectedSupplier = suppliers.find((supplier) => supplier.id === draft.supplierId);
    function handleSubmit() {
        if (draft.requestedQty <= 0) {
            setError("Số lượng yêu cầu phải lớn hơn 0.");
            return;
        }
        onSubmit(draft);
        onClose();
    }
    return (<div className="fixed inset-0 z-50 bg-on-surface/30 backdrop-blur-sm">
            <div className="absolute inset-y-0 right-0 w-full max-w-xl overflow-y-auto bg-surface p-6 shadow-ambient">
                <div className="mb-6 flex items-start justify-between gap-4">
                    <div>
                        <p className="text-xs uppercase tracking-widest text-on-surface-variant">
                            Phiếu yêu cầu nhập hàng
                        </p>
                        <h3 className="mt-2 font-headline text-3xl font-bold text-primary">
                            Bộ lập kế hoạch tái nhập
                        </h3>
                    </div>
                    <button className="rounded-full bg-surface-container-low p-2 text-on-surface-variant transition hover:text-primary" onClick={onClose} aria-label="Đóng biểu mẫu">
                        <Icon name="close"/>
                    </button>
                </div>

                {inventoryItem ? (<div className="space-y-6">
                        <SurfaceCard tone="low" className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h4 className="text-xs font-label uppercase tracking-widest text-on-surface-variant">
                                    Sản phẩm đang chọn
                                </h4>
                                <Badge tone={inventoryItem.status === "critical" ? "danger" : "warning"}>
                                    {inventoryHealthLabels[inventoryItem.status]}
                                </Badge>
                            </div>
                            <div className="space-y-2">
                                <p className="font-headline text-xl font-bold text-on-surface">
                                    {inventoryItem.sku}
                                </p>
                                <p className="text-sm text-on-surface-variant">
                                    Tồn kho {inventoryItem.onHand} / đã giữ chỗ{" "}
                                    {inventoryItem.reserved}
                                </p>
                                <p className="text-sm text-on-surface-variant">
                                    Giá nhập hiện tại {formatCurrency(inventoryItem.purchasePrice)}
                                </p>
                            </div>
                        </SurfaceCard>

                        <SurfaceCard tone="lowest" className="space-y-4">
                            <label className="space-y-2 text-sm">
                                <span className="font-medium text-on-surface">Nhà cung cấp</span>
                                <select value={draft.supplierId} onChange={(event) => setDraft((current) => ({
                ...current,
                supplierId: event.target.value,
            }))} className="w-full rounded-2xl bg-surface-container-low px-4 py-3 outline-none">
                                    {suppliers.map((supplier) => (<option key={supplier.id} value={supplier.id}>
                                            {supplier.name}
                                        </option>))}
                                </select>
                            </label>

                            <div className="grid gap-4 sm:grid-cols-2">
                                <label className="space-y-2 text-sm">
                                    <span className="font-medium text-on-surface">
                                        Số lượng yêu cầu
                                    </span>
                                    <Input min={1} type="number" value={draft.requestedQty} onChange={(event) => setDraft((current) => ({
                ...current,
                requestedQty: Number(event.target.value),
            }))}/>
                                </label>
                                <label className="space-y-2 text-sm">
                                    <span className="font-medium text-on-surface">ETA (ngày)</span>
                                    <Input min={1} type="number" value={draft.etaDays} onChange={(event) => setDraft((current) => ({
                ...current,
                etaDays: Number(event.target.value),
            }))}/>
                                </label>
                            </div>

                            <label className="space-y-2 text-sm">
                                <span className="font-medium text-on-surface">Ghi chú nội bộ</span>
                                <textarea className={cn("min-h-28 w-full rounded-2xl border border-transparent bg-surface-container-highest px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary/20 focus:ring-2 focus:ring-primary/15")} value={draft.note} onChange={(event) => setDraft((current) => ({
                ...current,
                note: event.target.value,
            }))}/>
                            </label>

                            {error ? <p className="text-sm text-error">{error}</p> : null}

                            <div className="flex flex-wrap justify-end gap-3">
                                <Button variant="outline" onClick={onClose}>
                                    Hủy
                                </Button>
                                <Button onClick={handleSubmit}>Gửi phiếu yêu cầu</Button>
                            </div>
                        </SurfaceCard>

                        {selectedSupplier ? (<SurfaceCard tone="low" className="space-y-3">
                                <h4 className="text-xs font-label uppercase tracking-widest text-on-surface-variant">
                                    Thông tin nhà cung cấp
                                </h4>
                                <p className="font-headline text-lg font-semibold text-on-surface">
                                    {selectedSupplier.name}
                                </p>
                                <p className="text-sm text-on-surface-variant">
                                    {selectedSupplier.location} · {selectedSupplier.responseTime}
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    {selectedSupplier.categories.map((category) => (<Badge key={category}>{category}</Badge>))}
                                </div>
                            </SurfaceCard>) : null}
                    </div>) : null}
            </div>
        </div>);
}
