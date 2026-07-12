import { useEffect, useState } from "react";
import { formatCurrency } from "@/shared/lib/format";
import { inventoryHealthLabels, requisitionStatusLabels } from "@/shared/lib/labels";
import { useFeedbackStore } from "@/shared/lib/store/use-feedback-store";
import { useOperationsDataStore } from "@/shared/lib/store/use-operations-data-store";
import { useUiStore } from "@/shared/lib/store/use-ui-store";
import { AdminDrawer, AdminPageHeader, AdminToolbar, Button, DataTable, StatCard, SurfaceCard } from "@/shared/ui";
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
    const supplierRecords = useOperationsDataStore((state) => state.suppliers);
    const loadOperations = useOperationsDataStore((state) => state.loadOperations);
    const createRequisition = useOperationsDataStore((state) => state.createRequisition);
    const pushToast = useFeedbackStore((state) => state.pushToast);
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
            value: `${inventory.filter((item) => item.status !== "healthy").length}`,
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
                        <DataTable rows={filteredInventory} columns={columns} getRowKey={(item) => item.sku} pagination={{ pageSize: 8, itemLabel: "mat hang" }} rowClassName={(item) => item.sku === activeItem?.sku
            ? "border-l-4 border-primary bg-primary/5"
            : undefined} onRowClick={(item) => {
            setSelectedWarehouseSku(item.sku);
            setDetailDrawerOpen(true);
        }}/>
                    </div>
                </SurfaceCard>
            </section>

            <AdminDrawer open={detailDrawerOpen && Boolean(activeItem)} mode="view" title={activeItem
            ? (activeItem.productName ?? activeItem.sku)
            : "Chi tiet ton kho"} subtitle={activeItem?.sku} onClose={() => setDetailDrawerOpen(false)} footer={<div className="flex justify-end gap-3">
                        <Button variant="outline" onClick={() => setDetailDrawerOpen(false)}>
                            Dong
                        </Button>
                        <Button onClick={() => setDrawerOpen(true)}>Tao phieu nhap hang</Button>
                    </div>}>
                {activeItem ? (<div className="space-y-5">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="rounded-2xl bg-surface-container-low p-4 text-sm">
                                <p className="text-on-surface-variant">Vi tri ke</p>
                                <p className="mt-2 font-semibold">{activeItem.aisle}</p>
                            </div>
                            <div className="rounded-2xl bg-surface-container-low p-4 text-sm">
                                <p className="text-on-surface-variant">Nguong nhap lai</p>
                                <p className="mt-2 font-semibold">{activeItem.reorderPoint}</p>
                            </div>
                            <div className="rounded-2xl bg-surface-container-low p-4 text-sm">
                                <p className="text-on-surface-variant">Gia nhap hien tai</p>
                                <p className="mt-2 font-semibold">{formatCurrency(activeItem.purchasePrice)}</p>
                            </div>
                            <div className="rounded-2xl bg-surface-container-low p-4 text-sm">
                                <p className="text-on-surface-variant">Nha cung cap</p>
                                <p className="mt-2 font-semibold">
                                    {activeItem.supplierName ?? activeItem.supplierId}
                                </p>
                            </div>
                        </div>
                        <div>
                            <h3 className="font-headline text-lg font-semibold">Phieu lien quan</h3>
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
                    message: result.error ?? "Khong the tao phieu nhap hang.",
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
