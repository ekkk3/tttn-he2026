import { useEffect, useMemo, useState } from "react";
import { formatCurrency, formatDate } from "@/shared/lib/format";
import { inventoryHealthLabels, requisitionStatusLabels } from "@/shared/lib/labels";
import { useFeedbackStore } from "@/shared/lib/store/use-feedback-store";
import { useOperationsDataStore } from "@/shared/lib/store/use-operations-data-store";
import { useUiStore } from "@/shared/lib/store/use-ui-store";
import { AdminDrawer, AdminPageHeader, AdminToolbar, Button, DataTable, Input, StatCard, SurfaceCard } from "@/shared/ui";
import { PurchasePriceDrawer } from "@/widgets/purchase-price-drawer";
import { RequisitionDrawer } from "@/widgets/requisition-drawer";
export function WarehouseInventoryPage() {
    const [query, setQuery] = useState("");
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
    const [confirmation, setConfirmation] = useState("");
    const selectedWarehouseSku = useUiStore((state) => state.selectedWarehouseSku);
    const setSelectedWarehouseSku = useUiStore((state) => state.setSelectedWarehouseSku);
    const inventory = useOperationsDataStore((state) => state.inventory);
    const requisitions = useOperationsDataStore((state) => state.requisitions);
    const purchasePrices = useOperationsDataStore((state) => state.purchasePrices);
    const supplierRecords = useOperationsDataStore((state) => state.suppliers);
    const loadOperations = useOperationsDataStore((state) => state.loadOperations);
    const createRequisition = useOperationsDataStore((state) => state.createRequisition);
    const updatePurchasePrice = useOperationsDataStore((state) => state.updatePurchasePrice);
    const createPurchasePriceRecord = useOperationsDataStore((state) => state.createPurchasePriceRecord);
    const updatePurchasePriceRecord = useOperationsDataStore((state) => state.updatePurchasePriceRecord);
    const deletePurchasePriceRecord = useOperationsDataStore((state) => state.deletePurchasePriceRecord);
    const pushToast = useFeedbackStore((state) => state.pushToast);
    const [isEditingPrice, setIsEditingPrice] = useState(false);
    const [priceDraft, setPriceDraft] = useState("");
    const [priceHistoryQuery, setPriceHistoryQuery] = useState("");
    const [priceDrawerOpen, setPriceDrawerOpen] = useState(false);
    const [priceDrawerMode, setPriceDrawerMode] = useState("create");
    const [editingPriceRecord, setEditingPriceRecord] = useState(null);
    const productOptions = useMemo(() => [
        ...new Map(inventory.map((item) => [item.productId, { id: item.productId, sku: item.sku, name: item.productName ?? item.sku }])).values(),
    ], [inventory]);
    const filteredPurchasePrices = useMemo(() => purchasePrices.filter((record) => [
        record.sku ?? "",
        record.productName ?? "",
        record.supplierName ?? "",
    ].some((value) => value.toLowerCase().includes(priceHistoryQuery.toLowerCase()))), [purchasePrices, priceHistoryQuery]);
    useEffect(() => {
        void loadOperations();
    }, [loadOperations]);
    const filteredInventory = inventory.filter((item) => [
        item.sku,
        item.productName ?? "",
        item.supplierName ?? "",
    ].some((value) => value.toLowerCase().includes(query.toLowerCase())));
    const activeItem = filteredInventory.find((item) => item.sku === selectedWarehouseSku) ?? filteredInventory[0];
    const totalInventoryValue = inventory.reduce((sum, item) => sum + item.onHand * item.purchasePrice, 0);
    // Đổi sang SKU khác (hoặc dữ liệu SKU đang xem vừa được cập nhật) -> thoát chế độ sửa +
    // nạp lại giá nháp từ dữ liệu mới nhất, tránh giữ giá đang gõ dở của SKU trước đó.
    useEffect(() => {
        setIsEditingPrice(false);
        setPriceDraft(activeItem?.purchasePrice != null ? String(activeItem.purchasePrice) : "");
    }, [activeItem]);
    async function handleSavePurchasePrice() {
        if (!activeItem)
            return;
        // Bỏ trống ô nhập = XÓA giá nhập (gửi null); có nhập số thì mới gửi số đó — phân biệt
        // "chưa biết giá nhập" (null) với "giá nhập bằng 0" (0), 2 ý nghĩa khác nhau.
        const trimmed = priceDraft.trim();
        const value = trimmed === "" ? null : Number(trimmed);
        if (value !== null && (Number.isNaN(value) || value < 0)) {
            pushToast({ tone: "warning", message: "Giá nhập không hợp lệ." });
            return;
        }
        const result = await updatePurchasePrice(activeItem.productId, value);
        if (!result.success) {
            pushToast({ tone: "warning", message: result.error ?? "Không thể cập nhật giá nhập." });
            return;
        }
        setIsEditingPrice(false);
        pushToast({ tone: "success", message: `Đã cập nhật giá nhập cho ${activeItem.sku}.` });
    }
    async function handleSubmitPriceRecord(draft) {
        const result = priceDrawerMode === "edit" && editingPriceRecord
            ? await updatePurchasePriceRecord(editingPriceRecord.id, draft)
            : await createPurchasePriceRecord(draft);
        if (result.success) {
            pushToast({ tone: "success", message: priceDrawerMode === "edit" ? "Đã cập nhật giá nhập." : "Đã thêm giá nhập mới." });
        }
        return result;
    }
    async function handleDeletePriceRecord(record) {
        const result = await deletePurchasePriceRecord(record.id);
        if (!result.success) {
            pushToast({ tone: "warning", message: result.error ?? "Không thể xóa giá nhập." });
            return;
        }
        pushToast({ tone: "success", message: `Đã xóa giá nhập #${record.id}.` });
    }
    const purchasePriceColumns = [
        {
            key: "product",
            title: "Sản phẩm",
            render: (record) => (<div>
                <span className="font-semibold">{record.sku}</span>
                <p className="text-xs text-on-surface-variant">{record.productName}</p>
            </div>),
        },
        {
            key: "supplier",
            title: "Nhà cung cấp",
            render: (record) => record.supplierName ?? "—",
        },
        {
            key: "price",
            title: "Giá nhập",
            render: (record) => formatCurrency(record.price),
        },
        {
            key: "effectiveDate",
            title: "Ngày áp dụng",
            render: (record) => formatDate(record.effectiveDate),
        },
        {
            key: "note",
            title: "Ghi chú",
            render: (record) => record.note ?? "—",
        },
        {
            key: "action",
            title: "Thao tác",
            align: "right",
            render: (record) => (<div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => {
                    setEditingPriceRecord(record);
                    setPriceDrawerMode("edit");
                    setPriceDrawerOpen(true);
                }}>
                    Sửa
                </Button>
                <Button variant="ghost" size="sm" onClick={() => void handleDeletePriceRecord(record)}>
                    Xóa
                </Button>
            </div>),
        },
    ];
    const columns = [
        {
            key: "sku",
            title: "SKU",
            render: (item) => <span className="font-semibold">{item.sku}</span>,
        },
        {
            key: "stock",
            title: "Tồn kho",
            render: (item) => (<span className="text-on-surface-variant">
                    {item.onHand} / giữ chỗ {item.reserved}
                </span>),
        },
        {
            key: "product",
            title: "Sản phẩm",
            render: (item) => (<span className="text-on-surface-variant">
                    {item.productName ?? item.productId}
                </span>),
        },
        {
            key: "purchase",
            title: "Giá nhập",
            render: (item) => formatCurrency(item.purchasePrice),
        },
        {
            key: "status",
            title: "Trạng thái",
            render: (item) => (<span className="rounded-full bg-surface-container-low px-3 py-1 text-xs uppercase tracking-widest text-primary">
                    {inventoryHealthLabels[item.status]}
                </span>),
        },
        {
            key: "action",
            title: "Thao tác",
            align: "right",
            render: (item) => (<Button variant="ghost" size="sm" onClick={(event) => {
                    event.stopPropagation();
                    setSelectedWarehouseSku(item.sku);
                    setDetailDrawerOpen(true);
                }}>
                    Xem chi tiết
                </Button>),
        },
    ];
    const stats = [
        {
            id: "warehouse-skus",
            label: "Tổng SKU đang theo dõi",
            value: `${inventory.length}`,
            tone: "primary",
            icon: "inventory",
            delta: `${requisitions.length} phiếu nhập`,
            helperText: "quy mô tồn kho runtime hiện tại",
        },
        {
            id: "warehouse-alerts",
            label: "Cảnh báo tồn kho",
            value: `${inventory.filter((item) => item.status !== "in-stock").length}`,
            tone: "danger",
            icon: "warning",
            delta: "Cần xử lý",
            helperText: "SKU dưới ngưỡng hoặc mức nguy cấp",
        },
        {
            id: "warehouse-value",
            label: "Giá trị tồn kho",
            value: formatCurrency(totalInventoryValue),
            tone: "tertiary",
            icon: "payments",
            helperText: "ước tính theo giá nhập hiện có",
        },
    ];
    return (<div className="space-y-8">
            <AdminPageHeader title="Tồn kho kho vận" description="Kiểm tra sức khỏe tồn kho, mức dự trữ và các SKU cần xử lý trong kho."/>
            <AdminToolbar>
                <input className="w-full rounded-2xl bg-surface-container-highest px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/15" placeholder="Tìm theo SKU, tên sản phẩm hoặc nhà cung cấp..." value={query} onChange={(event) => setQuery(event.target.value)}/>
            </AdminToolbar>

            <section className="grid gap-6 md:grid-cols-3">
                {stats.map((stat) => (<StatCard key={stat.id} metric={stat}/>))}
            </section>

            {confirmation ? (<SurfaceCard className="text-sm text-primary">{confirmation}</SurfaceCard>) : null}

            <section>
                <SurfaceCard className="overflow-hidden p-0">
                    <div className="border-b border-outline-variant/15 px-6 py-5">
                        <h3 className="font-headline text-xl font-semibold">Danh mục tồn kho</h3>
                    </div>
                    <div className="p-6">
                        <DataTable rows={filteredInventory} columns={columns} getRowKey={(item) => item.sku} pagination={{ pageSize: 8, itemLabel: "mặt hàng" }} rowClassName={(item) => item.sku === activeItem?.sku
            ? "border-l-4 border-primary bg-primary/5"
            : undefined} onRowClick={(item) => {
            setSelectedWarehouseSku(item.sku);
            setDetailDrawerOpen(true);
        }}/>
                    </div>
                </SurfaceCard>
            </section>

            <section>
                <SurfaceCard className="overflow-hidden p-0">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-outline-variant/15 px-6 py-5">
                        <h3 className="font-headline text-xl font-semibold">Lịch sử giá nhập sản phẩm</h3>
                        <Button size="sm" onClick={() => {
                            setEditingPriceRecord(null);
                            setPriceDrawerMode("create");
                            setPriceDrawerOpen(true);
                        }}>
                            Thêm giá nhập
                        </Button>
                    </div>
                    <div className="space-y-4 p-6">
                        <Input
                            placeholder="Tìm theo SKU, tên sản phẩm hoặc nhà cung cấp..."
                            value={priceHistoryQuery}
                            onChange={(event) => setPriceHistoryQuery(event.target.value)}
                        />
                        <DataTable
                            rows={filteredPurchasePrices}
                            columns={purchasePriceColumns}
                            getRowKey={(record) => record.id}
                            pagination={{ pageSize: 8, itemLabel: "bản ghi" }}
                            emptyMessage="Chưa có lịch sử giá nhập nào."
                        />
                    </div>
                </SurfaceCard>
            </section>

            <PurchasePriceDrawer
                open={priceDrawerOpen}
                mode={priceDrawerMode}
                record={editingPriceRecord}
                products={productOptions}
                suppliers={supplierRecords}
                onClose={() => setPriceDrawerOpen(false)}
                onSubmit={handleSubmitPriceRecord}
            />

            <AdminDrawer open={detailDrawerOpen && Boolean(activeItem)} mode="view" title={activeItem
            ? (activeItem.productName ?? activeItem.sku)
            : "Chi tiết tồn kho"} subtitle={activeItem?.sku} onClose={() => setDetailDrawerOpen(false)} footer={<div className="flex justify-end gap-3">
                        <Button variant="outline" onClick={() => setDetailDrawerOpen(false)}>
                            Đóng
                        </Button>
                        <Button onClick={() => setDrawerOpen(true)}>Tạo phiếu nhập hàng</Button>
                    </div>}>
                {activeItem ? (<div className="space-y-5">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="rounded-2xl bg-surface-container-low p-4 text-sm">
                                <p className="text-on-surface-variant">Vị trí kệ</p>
                                <p className="mt-2 font-semibold">{activeItem.aisle}</p>
                            </div>
                            <div className="rounded-2xl bg-surface-container-low p-4 text-sm">
                                <p className="text-on-surface-variant">Ngưỡng nhập lại</p>
                                <p className="mt-2 font-semibold">{activeItem.reorderPoint}</p>
                            </div>
                            <div className="rounded-2xl bg-surface-container-low p-4 text-sm">
                                <div className="flex items-center justify-between gap-2">
                                    <p className="text-on-surface-variant">Giá nhập hiện tại</p>
                                    {!isEditingPrice ? (<button type="button" className="text-xs font-semibold text-primary hover:underline" onClick={() => setIsEditingPrice(true)}>
                                            Sửa
                                        </button>) : null}
                                </div>
                                {isEditingPrice ? (<div className="mt-2 space-y-2">
                                        <input type="number" min="0" step="1000" className="w-full rounded-xl border border-outline-variant/20 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/15" placeholder="Bỏ trống để xóa giá nhập" value={priceDraft} onChange={(event) => setPriceDraft(event.target.value)}/>
                                        <div className="flex gap-2">
                                            <Button size="sm" onClick={() => void handleSavePurchasePrice()}>
                                                Lưu
                                            </Button>
                                            <Button size="sm" variant="ghost" onClick={() => {
                        setIsEditingPrice(false);
                        setPriceDraft(activeItem.purchasePrice != null ? String(activeItem.purchasePrice) : "");
                    }}>
                                                Hủy
                                            </Button>
                                        </div>
                                    </div>) : (<p className="mt-2 font-semibold">{formatCurrency(activeItem.purchasePrice)}</p>)}
                            </div>
                            <div className="rounded-2xl bg-surface-container-low p-4 text-sm">
                                <p className="text-on-surface-variant">Nhà cung cấp</p>
                                <p className="mt-2 font-semibold">
                                    {activeItem.supplierName ?? activeItem.supplierId}
                                </p>
                            </div>
                        </div>
                        <div>
                            <h3 className="font-headline text-lg font-semibold">Phiếu liên quan</h3>
                            <div className="mt-3 space-y-3">
                                {requisitions
                .filter((requisition) => requisition.inventorySku === activeItem.sku)
                .map((requisition) => (<div key={requisition.id} className="rounded-2xl bg-surface-container-low p-4 text-sm">
                                            <p className="font-semibold text-on-surface">{requisition.id}</p>
                                            <p className="text-on-surface-variant">
                                                {requisition.inventorySku} / SL {requisition.requestedQty} /{" "}
                                                {requisitionStatusLabels[requisition.status]}
                                            </p>
                                        </div>))}
                            </div>
                        </div>
                    </div>) : null}
            </AdminDrawer>

            <RequisitionDrawer open={drawerOpen} inventoryItem={activeItem} suppliers={supplierRecords} onClose={() => setDrawerOpen(false)} onSubmit={async (draft) => {
            if (!activeItem)
                return;
            const result = await createRequisition({
                productId: activeItem.productId,
                requestedQty: draft.requestedQty,
                note: draft.note,
            });
            if (!result.success || !result.data) {
                pushToast({
                    tone: "warning",
                    message: result.error ?? "Không thể tạo phiếu nhập hàng.",
                });
                return;
            }
            setConfirmation(`Đã gửi phiếu ${result.data.id} cho ${draft.requestedQty} đơn vị, ETA ${draft.etaDays} ngày.`);
            pushToast({
                tone: "success",
                message: `Phiếu nhập ${result.data.id} đã được ghi về database.`,
            });
        }}/>
        </div>);
}
