import { useEffect, useMemo, useState } from "react";
import { hasAdminPermission } from "@/shared/lib/auth";
import { useAdminShippingCarriersStore, } from "@/shared/lib/store/use-admin-shipping-carriers-store";
import { useAuthStore } from "@/shared/lib/store/use-auth-store";
import { useFeedbackStore } from "@/shared/lib/store/use-feedback-store";
import { ActionIconButton, AdminDrawer, AdminPageHeader, AdminToolbar, Badge, Button, DataTable, Icon, SurfaceCard, } from "@/shared/ui";
const emptyForm = {
    code: "",
    name: "",
    provider: "MANUAL",
    trackingUrlTemplate: "",
    defaultWeight: "1000",
    defaultLength: "20",
    defaultWidth: "20",
    defaultHeight: "10",
    defaultServiceTypeId: "2",
    defaultPaymentTypeId: "1",
    defaultRequiredNote: "KHONGCHOXEMHANG",
    pickupName: "",
    pickupPhone: "",
    pickupAddress: "",
    pickupWardCode: "",
    pickupWardName: "",
    pickupDistrictId: "",
    pickupDistrictName: "",
    pickupProvinceId: "",
    pickupProvinceName: "",
    isActive: true,
};
function isAvailable(carrier) {
    return carrier.is_active !== false && carrier.is_deleted !== true;
}
function statusTone(carrier) {
    return isAvailable(carrier) ? "success" : "warning";
}
function providerLabel(provider) {
    return provider === "GHN" ? "GHN" : "Thu cong";
}
function numberOrUndefined(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}
function nullableNumber(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}
function payloadFromForm(form) {
    return {
        code: form.code.trim().toUpperCase(),
        name: form.name.trim(),
        provider: form.provider,
        tracking_url_template: form.trackingUrlTemplate.trim() || null,
        default_weight: numberOrUndefined(form.defaultWeight),
        default_length: numberOrUndefined(form.defaultLength),
        default_width: numberOrUndefined(form.defaultWidth),
        default_height: numberOrUndefined(form.defaultHeight),
        default_service_type_id: nullableNumber(form.defaultServiceTypeId),
        default_payment_type_id: nullableNumber(form.defaultPaymentTypeId),
        default_required_note: form.defaultRequiredNote.trim() || null,
        pickup_name: form.pickupName.trim() || null,
        pickup_phone: form.pickupPhone.trim() || null,
        pickup_address: form.pickupAddress.trim() || null,
        pickup_ward_code: form.pickupWardCode.trim() || null,
        pickup_ward_name: form.pickupWardName.trim() || null,
        pickup_district_id: nullableNumber(form.pickupDistrictId),
        pickup_district_name: form.pickupDistrictName.trim() || null,
        pickup_province_id: nullableNumber(form.pickupProvinceId),
        pickup_province_name: form.pickupProvinceName.trim() || null,
        is_active: form.isActive,
        is_deleted: false,
    };
}
function formFromCarrier(carrier) {
    return {
        code: carrier.code,
        name: carrier.name,
        provider: carrier.provider,
        trackingUrlTemplate: carrier.tracking_url_template ?? "",
        defaultWeight: String(carrier.default_weight ?? 1000),
        defaultLength: String(carrier.default_length ?? 20),
        defaultWidth: String(carrier.default_width ?? 20),
        defaultHeight: String(carrier.default_height ?? 10),
        defaultServiceTypeId: String(carrier.default_service_type_id ?? 2),
        defaultPaymentTypeId: String(carrier.default_payment_type_id ?? 1),
        defaultRequiredNote: carrier.default_required_note ?? "KHONGCHOXEMHANG",
        pickupName: carrier.pickup_name ?? "",
        pickupPhone: carrier.pickup_phone ?? "",
        pickupAddress: carrier.pickup_address ?? "",
        pickupWardCode: carrier.pickup_ward_code ?? "",
        pickupWardName: carrier.pickup_ward_name ?? "",
        pickupDistrictId: carrier.pickup_district_id ? String(carrier.pickup_district_id) : "",
        pickupDistrictName: carrier.pickup_district_name ?? "",
        pickupProvinceId: carrier.pickup_province_id ? String(carrier.pickup_province_id) : "",
        pickupProvinceName: carrier.pickup_province_name ?? "",
        isActive: isAvailable(carrier),
    };
}
function FieldValue({ label, value }) {
    return (<div className="rounded-2xl bg-surface-container-low p-4 text-sm">
            <p className="text-xs font-label uppercase tracking-[0.14em] text-on-surface-variant">{label}</p>
            <p className="mt-2 font-medium text-on-surface">{value || "Chua cap nhat"}</p>
        </div>);
}
function FormInput({ label, value, onChange, type = "text", placeholder, }) {
    return (<label className="block space-y-2 text-sm">
            <span className="font-medium">{label}</span>
            <input className="w-full rounded-2xl bg-surface-container-highest px-4 py-3 outline-none focus:ring-2 focus:ring-primary/15" type={type} min={type === "number" ? 1 : undefined} placeholder={placeholder} value={value} onChange={(event) => onChange(event.target.value)}/>
        </label>);
}
export function AdminShippingCarriersPage() {
    const [query, setQuery] = useState("");
    const [drawer, setDrawer] = useState(null);
    const [form, setForm] = useState(emptyForm);
    const carriers = useAdminShippingCarriersStore((state) => state.carriers);
    const isLoading = useAdminShippingCarriersStore((state) => state.isLoading);
    const isSaving = useAdminShippingCarriersStore((state) => state.isSaving);
    const error = useAdminShippingCarriersStore((state) => state.error);
    const loadCarriers = useAdminShippingCarriersStore((state) => state.loadCarriers);
    const createCarrier = useAdminShippingCarriersStore((state) => state.createCarrier);
    const updateCarrier = useAdminShippingCarriersStore((state) => state.updateCarrier);
    const deleteCarrier = useAdminShippingCarriersStore((state) => state.deleteCarrier);
    const user = useAuthStore((state) => state.session?.user ?? null);
    const pushToast = useFeedbackStore((state) => state.pushToast);
    const canCreate = hasAdminPermission(user, "admin.shipping_carriers.create");
    const canUpdate = hasAdminPermission(user, "admin.shipping_carriers.update");
    const canDelete = hasAdminPermission(user, "admin.shipping_carriers.delete");
    useEffect(() => {
        void loadCarriers();
    }, [loadCarriers]);
    const filteredCarriers = useMemo(() => {
        const keyword = query.trim().toLowerCase();
        if (!keyword)
            return carriers;
        return carriers.filter((carrier) => [carrier.code, carrier.name, carrier.provider, carrier.pickup_phone, carrier.pickup_province_name]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(keyword));
    }, [carriers, query]);
    const activeCarrier = drawer?.id
        ? carriers.find((carrier) => String(carrier.id) === drawer.id)
        : undefined;
    useEffect(() => {
        if (!activeCarrier || drawer?.mode === "create")
            return;
        setForm(formFromCarrier(activeCarrier));
    }, [activeCarrier, drawer?.mode]);
    function updateField(key, value) {
        setForm((current) => ({
            ...current,
            [key]: value,
        }));
    }
    function openCreateDrawer() {
        setForm(emptyForm);
        setDrawer({ mode: "create" });
    }
    function openRecordDrawer(carrier, mode) {
        setForm(formFromCarrier(carrier));
        setDrawer({ mode, id: String(carrier.id) });
    }
    async function handleCreate() {
        if (!form.code.trim() || !form.name.trim()) {
            pushToast({ tone: "warning", message: "Can nhap ma va ten don vi van chuyen." });
            return;
        }
        const result = await createCarrier(payloadFromForm(form));
        if (!result.success || !result.data) {
            pushToast({ tone: "warning", message: result.error ?? "Khong the tao don vi van chuyen." });
            return;
        }
        setDrawer({ mode: "view", id: String(result.data.id) });
        pushToast({ tone: "success", message: `Da tao ${result.data.name}.` });
    }
    async function handleUpdate() {
        if (!activeCarrier)
            return;
        const result = await updateCarrier(activeCarrier.id, payloadFromForm(form));
        if (!result.success || !result.data) {
            pushToast({ tone: "warning", message: result.error ?? "Khong the cap nhat don vi van chuyen." });
            return;
        }
        setDrawer({ mode: "view", id: String(result.data.id) });
        pushToast({ tone: "success", message: `Da cap nhat ${result.data.name}.` });
    }
    async function handleDeactivate(carrier = activeCarrier) {
        if (!carrier)
            return;
        const result = await deleteCarrier(carrier.id);
        if (!result.success) {
            pushToast({ tone: "warning", message: result.error ?? "Khong the an don vi van chuyen." });
            return;
        }
        setDrawer({ mode: "view", id: String(carrier.id) });
        pushToast({ tone: "success", message: `Da an ${carrier.name}.` });
    }
    async function handleRestore(carrier = activeCarrier) {
        if (!carrier)
            return;
        const result = await updateCarrier(carrier.id, {
            ...payloadFromForm(formFromCarrier(carrier)),
            is_active: true,
            is_deleted: false,
        });
        if (!result.success || !result.data) {
            pushToast({ tone: "warning", message: result.error ?? "Khong the khoi phuc don vi van chuyen." });
            return;
        }
        setDrawer({ mode: "view", id: String(result.data.id) });
        pushToast({ tone: "success", message: `Da khoi phuc ${result.data.name}.` });
    }
    const columns = [
        {
            key: "carrier",
            title: "Đơn vị",
            render: (carrier) => (<div>
                    <p className="font-semibold text-on-surface">{carrier.name}</p>
                    <p className="mt-1 font-mono text-xs text-on-surface-variant">{carrier.code}</p>
                </div>),
        },
        {
            key: "provider",
            title: "Provider",
            render: (carrier) => <Badge tone={carrier.provider === "GHN" ? "primary" : "neutral"}>{providerLabel(carrier.provider)}</Badge>,
        },
        {
            key: "defaults",
            title: "Mặc định",
            render: (carrier) => (<div className="text-sm">
                    <p>
                        {carrier.default_weight}g, {carrier.default_length}x{carrier.default_width}x
                        {carrier.default_height}cm
                    </p>
                    <p className="mt-1 text-xs text-on-surface-variant">
                        Service {carrier.default_service_type_id ?? "-"} / Payment{" "}
                        {carrier.default_payment_type_id ?? "-"}
                    </p>
                </div>),
        },
        {
            key: "pickup",
            title: "Kho lấy hàng",
            render: (carrier) => (<div>
                    <p className="font-medium">{carrier.pickup_name ?? "Chưa cấu hình"}</p>
                    <p className="mt-1 text-xs text-on-surface-variant">{carrier.pickup_phone ?? "Chưa có SĐT"}</p>
                </div>),
        },
        {
            key: "status",
            title: "Trạng thái",
            render: (carrier) => (<Badge tone={statusTone(carrier)}>{isAvailable(carrier) ? "Đang hoạt động" : "Tạm dừng"}</Badge>),
        },
        {
            key: "actions",
            title: "Thao tác",
            align: "right",
            render: (carrier) => (<div className="flex justify-end gap-1">
                    <ActionIconButton label={`Xem ${carrier.name}`} icon="visibility" tone="primary" onClick={() => openRecordDrawer(carrier, "view")}/>
                    <ActionIconButton label={`Sửa ${carrier.name}`} icon="edit" disabled={!canUpdate} onClick={() => openRecordDrawer(carrier, "edit")}/>
                    {isAvailable(carrier) ? (<ActionIconButton label={`Ẩn ${carrier.name}`} icon="block" tone="danger" disabled={!canDelete} onClick={() => void handleDeactivate(carrier)}/>) : (<ActionIconButton label={`Khôi phục ${carrier.name}`} icon="settings_backup_restore" disabled={!canUpdate} onClick={() => void handleRestore(carrier)}/>)}
                </div>),
        },
    ];
    const drawerTitle = drawer?.mode === "create"
        ? "Tạo đơn vị vận chuyển"
        : activeCarrier?.name ?? "Đơn vị vận chuyển";
    return (<div className="space-y-8">
            <AdminPageHeader title="Đơn vị vận chuyển" description="Cấu hình GHN và các đơn vị vận chuyển thủ công để tạo vận đơn sau khi xác nhận đơn."/>

            <AdminToolbar actions={<Button disabled={!canCreate} iconLeft={<Icon name="add"/>} onClick={openCreateDrawer}>
                        Tạo đơn vị
                    </Button>}>
                <input className="w-full rounded-2xl bg-surface-container-highest px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/15" placeholder="Lọc theo mã, tên, provider, kho lấy hàng..." value={query} onChange={(event) => setQuery(event.target.value)}/>
            </AdminToolbar>

            {error ? <SurfaceCard className="text-sm text-error">{error}</SurfaceCard> : null}

            <SurfaceCard className="space-y-4">
                <div>
                    <h2 className="font-headline text-2xl font-bold text-on-surface">Danh sách đơn vị vận chuyển</h2>
                    <p className="mt-1 text-sm text-on-surface-variant">
                        Cau hinh GHN va cac don vi van chuyen thu cong de nhan vien tao van don sau khi xac nhan don.
                    </p>
                </div>

                <DataTable rows={filteredCarriers} columns={columns} getRowKey={(carrier) => String(carrier.id)} isLoading={isLoading} loadingMessage="Dang tai don vi van chuyen..." emptyMessage="Chua co don vi van chuyen nao phu hop." minWidth="1040px" pagination={{ pageSize: 8, itemLabel: "don vi" }} rowClassName={(carrier) => drawer?.id === String(carrier.id) ? "border-l-4 border-primary bg-primary/5" : undefined} onRowClick={(carrier) => openRecordDrawer(carrier, "view")}/>
            </SurfaceCard>

            <AdminDrawer open={drawer !== null} mode={drawer?.mode ?? "view"} title={drawerTitle} subtitle={activeCarrier ? <Badge tone={statusTone(activeCarrier)}>{providerLabel(activeCarrier.provider)}</Badge> : undefined} onClose={() => setDrawer(null)} footer={<div className="flex flex-wrap justify-end gap-3">
                        <Button variant="outline" onClick={() => setDrawer(null)}>
                            Đóng
                        </Button>
                        {drawer?.mode === "create" ? (<Button disabled={isSaving || !canCreate} onClick={() => void handleCreate()}>
                                Tạo đơn vị
                            </Button>) : null}
                        {drawer?.mode === "edit" ? (<Button disabled={isSaving || !activeCarrier || !canUpdate} onClick={() => void handleUpdate()}>
                                Lưu chỉnh sửa
                            </Button>) : null}
                        {drawer?.mode === "view" && activeCarrier ? (<>
                                <Button variant="secondary" disabled={!canUpdate} onClick={() => setDrawer({ mode: "edit", id: String(activeCarrier.id) })}>
                                    Sửa
                                </Button>
                                {isAvailable(activeCarrier) ? (<Button variant="ghost" disabled={isSaving || !canDelete} onClick={() => void handleDeactivate()}>
                                        Ẩn đơn vị
                                    </Button>) : (<Button variant="secondary" disabled={isSaving || !canUpdate} onClick={() => void handleRestore()}>
                                        Khôi phục
                                    </Button>)}
                            </>) : null}
                    </div>}>
                {drawer?.mode === "view" && activeCarrier ? (<div className="space-y-5">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <h3 className="font-headline text-xl font-bold">{activeCarrier.name}</h3>
                                <p className="mt-1 font-mono text-sm text-on-surface-variant">{activeCarrier.code}</p>
                            </div>
                            <Badge tone={statusTone(activeCarrier)}>
                                {isAvailable(activeCarrier) ? "Đang hoạt động" : "Tạm dừng"}
                            </Badge>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <FieldValue label="Provider" value={providerLabel(activeCarrier.provider)}/>
                            <FieldValue label="Tracking URL" value={activeCarrier.tracking_url_template}/>
                            <FieldValue label="Package" value={`${activeCarrier.default_weight}g - ${activeCarrier.default_length}x${activeCarrier.default_width}x${activeCarrier.default_height}cm`}/>
                            <FieldValue label="Required note" value={activeCarrier.default_required_note}/>
                            <FieldValue label="Kho lay hang" value={activeCarrier.pickup_name}/>
                            <FieldValue label="Dien thoai kho" value={activeCarrier.pickup_phone}/>
                            <FieldValue label="Dia chi kho" value={activeCarrier.pickup_address}/>
                            <FieldValue label="Khu vuc kho" value={[activeCarrier.pickup_ward_name, activeCarrier.pickup_district_name, activeCarrier.pickup_province_name].filter(Boolean).join(", ")}/>
                        </div>
                    </div>) : null}

                {drawer?.mode === "create" || drawer?.mode === "edit" ? (<div className="space-y-6">
                        <div className="grid gap-4 md:grid-cols-2">
                            <FormInput label="Ma don vi" value={form.code} onChange={(value) => updateField("code", value)}/>
                            <FormInput label="Ten don vi" value={form.name} onChange={(value) => updateField("name", value)}/>
                            <label className="block space-y-2 text-sm">
                                <span className="font-medium">Provider</span>
                                <select className="w-full rounded-2xl bg-surface-container-highest px-4 py-3 outline-none focus:ring-2 focus:ring-primary/15" value={form.provider} onChange={(event) => updateField("provider", event.target.value)}>
                                    <option value="MANUAL">Thu cong</option>
                                    <option value="GHN">GHN</option>
                                </select>
                            </label>
                            <FormInput label="Tracking URL template" value={form.trackingUrlTemplate} placeholder="https://.../{code}" onChange={(value) => updateField("trackingUrlTemplate", value)}/>
                        </div>

                        <div className="grid gap-4 md:grid-cols-4">
                            <FormInput label="Can nang (g)" type="number" value={form.defaultWeight} onChange={(value) => updateField("defaultWeight", value)}/>
                            <FormInput label="Dai (cm)" type="number" value={form.defaultLength} onChange={(value) => updateField("defaultLength", value)}/>
                            <FormInput label="Rong (cm)" type="number" value={form.defaultWidth} onChange={(value) => updateField("defaultWidth", value)}/>
                            <FormInput label="Cao (cm)" type="number" value={form.defaultHeight} onChange={(value) => updateField("defaultHeight", value)}/>
                        </div>

                        <div className="grid gap-4 md:grid-cols-3">
                            <FormInput label="Service type ID" type="number" value={form.defaultServiceTypeId} onChange={(value) => updateField("defaultServiceTypeId", value)}/>
                            <FormInput label="Payment type ID" type="number" value={form.defaultPaymentTypeId} onChange={(value) => updateField("defaultPaymentTypeId", value)}/>
                            <label className="block space-y-2 text-sm">
                                <span className="font-medium">Required note</span>
                                <select className="w-full rounded-2xl bg-surface-container-highest px-4 py-3 outline-none focus:ring-2 focus:ring-primary/15" value={form.defaultRequiredNote} onChange={(event) => updateField("defaultRequiredNote", event.target.value)}>
                                    <option value="KHONGCHOXEMHANG">KHONGCHOXEMHANG</option>
                                    <option value="CHOTHUHANG">CHOTHUHANG</option>
                                    <option value="CHOXEMHANGKHONGTHU">CHOXEMHANGKHONGTHU</option>
                                </select>
                            </label>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                            <FormInput label="Ten kho lay hang" value={form.pickupName} onChange={(value) => updateField("pickupName", value)}/>
                            <FormInput label="SDT kho" value={form.pickupPhone} onChange={(value) => updateField("pickupPhone", value)}/>
                            <FormInput label="Dia chi kho" value={form.pickupAddress} onChange={(value) => updateField("pickupAddress", value)}/>
                            <FormInput label="Ma phuong/xa kho" value={form.pickupWardCode} onChange={(value) => updateField("pickupWardCode", value)}/>
                            <FormInput label="Phuong/xa kho" value={form.pickupWardName} onChange={(value) => updateField("pickupWardName", value)}/>
                            <FormInput label="Ma quan/huyen kho" type="number" value={form.pickupDistrictId} onChange={(value) => updateField("pickupDistrictId", value)}/>
                            <FormInput label="Quan/huyen kho" value={form.pickupDistrictName} onChange={(value) => updateField("pickupDistrictName", value)}/>
                            <FormInput label="Ma tinh/thanh kho" type="number" value={form.pickupProvinceId} onChange={(value) => updateField("pickupProvinceId", value)}/>
                            <FormInput label="Tinh/thanh kho" value={form.pickupProvinceName} onChange={(value) => updateField("pickupProvinceName", value)}/>
                            <label className="flex items-center gap-3 rounded-2xl bg-surface-container-highest px-4 py-3 text-sm text-on-surface-variant md:col-span-2">
                                <input type="checkbox" checked={form.isActive} onChange={(event) => updateField("isActive", event.target.checked)}/>
                                Don vi dang hoat dong
                            </label>
                        </div>
                    </div>) : null}
            </AdminDrawer>
        </div>);
}
