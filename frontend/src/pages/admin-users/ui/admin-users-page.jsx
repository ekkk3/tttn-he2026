import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { routes } from "@/shared/config/routes";
import { hasAdminPermission } from "@/shared/lib/auth";
import { downloadTextFile } from "@/shared/lib/download";
import { useAdminUserStore } from "@/shared/lib/store/use-admin-user-store";
import { useAuthStore, } from "@/shared/lib/store/use-auth-store";
import { useFeedbackStore } from "@/shared/lib/store/use-feedback-store";
import { ActionIconButton, AdminDrawer, AdminPageHeader, AdminToolbar, Badge, Button, DataTable, StatCard, SurfaceCard, } from "@/shared/ui";
const emptyCustomerForm = {
    fullName: "",
    email: "",
    phone: "",
    password: "",
    address: "",
    city: "",
    favoriteRegion: "",
    avatarUrl: "",
    rewardPoints: "0",
    rewardTier: "Bronze",
    nextTierPoints: "500",
    isActive: true,
    newsletter: false,
    smsAlerts: false,
    orderEmail: true,
    securityAlerts: true,
};
const notificationFields = [
    { key: "newsletter", label: "Newsletter" },
    { key: "smsAlerts", label: "SMS alerts" },
    { key: "orderEmail", label: "Order email" },
    { key: "securityAlerts", label: "Security alerts" },
];
function statusTone(customer) {
    if (customer.is_active && !customer.is_deleted)
        return "success";
    return customer.is_deleted ? "danger" : "warning";
}
function statusLabel(customer) {
    return customer.is_active && !customer.is_deleted ? "ACTIVE" : "INACTIVE";
}
function initials(name) {
    return name
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join("");
}
function FieldValue({ label, value }) {
    return (<div className="rounded-2xl bg-surface-container-low p-4 text-sm">
            <p className="text-xs font-label uppercase tracking-[0.14em] text-on-surface-variant">
                {label}
            </p>
            <p className="mt-2 font-medium text-on-surface">{value || "Chua cap nhat"}</p>
        </div>);
}
export function AdminUsersPage() {
    const navigate = useNavigate();
    const [query, setQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [activeCustomerId, setActiveCustomerId] = useState("");
    const [drawerMode, setDrawerMode] = useState(null);
    const [customerForm, setCustomerForm] = useState(emptyCustomerForm);
    const user = useAuthStore((state) => state.session?.user ?? null);
    const customers = useAdminUserStore((state) => state.customers);
    const isLoading = useAdminUserStore((state) => state.isLoading);
    const isSaving = useAdminUserStore((state) => state.isSaving);
    const error = useAdminUserStore((state) => state.error);
    const loadCustomers = useAdminUserStore((state) => state.loadCustomers);
    const createCustomer = useAdminUserStore((state) => state.createCustomer);
    const updateCustomer = useAdminUserStore((state) => state.updateCustomer);
    const blockCustomer = useAdminUserStore((state) => state.blockCustomer);
    const pushToast = useFeedbackStore((state) => state.pushToast);
    const canViewUsers = hasAdminPermission(user, "admin.users.view");
    const canCreateUser = hasAdminPermission(user, "admin.users.create");
    const canUpdateUser = hasAdminPermission(user, "admin.users.update");
    const canDeleteUser = hasAdminPermission(user, "admin.users.delete");
    const canViewOrderHistory = hasAdminPermission(user, "admin.orders.view");
    useEffect(() => {
        if (!canViewUsers)
            return;
        void loadCustomers();
    }, [canViewUsers, loadCustomers]);
    const filteredCustomers = useMemo(() => {
        const keyword = query.trim().toLowerCase();
        return customers.filter((customer) => {
            const matchesStatus = statusFilter === "all" ||
                (statusFilter === "active" && statusLabel(customer) === "ACTIVE") ||
                (statusFilter === "inactive" && statusLabel(customer) === "INACTIVE");
            if (!matchesStatus)
                return false;
            if (keyword.length === 0)
                return true;
            return [
                customer.full_name,
                customer.email,
                customer.phone,
                customer.city,
                customer.favorite_region,
                customer.reward_tier,
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase()
                .includes(keyword);
        });
    }, [customers, query, statusFilter]);
    const activeCustomer = activeCustomerId && activeCustomerId !== "new"
        ? customers.find((customer) => String(customer.id) === activeCustomerId)
        : undefined;
    useEffect(() => {
        if (!activeCustomer || drawerMode === "create")
            return;
        setCustomerForm({
            fullName: activeCustomer.full_name,
            email: activeCustomer.email,
            phone: activeCustomer.phone,
            password: "",
            address: activeCustomer.address ?? "",
            city: activeCustomer.city ?? "",
            favoriteRegion: activeCustomer.favorite_region ?? "",
            avatarUrl: activeCustomer.avatar_url ?? "",
            rewardPoints: String(activeCustomer.reward_points),
            rewardTier: activeCustomer.reward_tier,
            nextTierPoints: String(activeCustomer.next_tier_points),
            isActive: activeCustomer.is_active,
            newsletter: activeCustomer.newsletter,
            smsAlerts: activeCustomer.sms_alerts,
            orderEmail: activeCustomer.order_email,
            securityAlerts: activeCustomer.security_alerts,
        });
    }, [activeCustomer, drawerMode]);
    const stats = [
        {
            id: "admin-users-total",
            label: "Danh bạ khách hàng",
            value: canViewUsers ? `${customers.length}` : "-",
            tone: "primary",
            icon: "group",
            delta: "Tổng tài khoản khách hàng",
        },
        {
            id: "admin-users-active",
            label: "Đang hoạt động",
            value: canViewUsers
                ? `${customers.filter((customer) => statusLabel(customer) === "ACTIVE").length}`
                : "-",
            tone: "success",
            icon: "verified_user",
            delta: "Có thể đăng nhập và mua hàng",
        },
        {
            id: "admin-users-orders",
            label: "Tổng đơn gắn user",
            value: canViewUsers
                ? `${customers.reduce((sum, customer) => sum + customer.orders_count, 0)}`
                : "-",
            tone: "secondary",
            icon: "shopping_bag",
            delta: "Không mất khi khóa mềm user",
        },
    ];
    function openCreateDrawer() {
        setActiveCustomerId("new");
        setCustomerForm(emptyCustomerForm);
        setDrawerMode("create");
    }
    function openCustomerDrawer(customer, mode) {
        setActiveCustomerId(String(customer.id));
        setDrawerMode(mode);
    }
    function closeDrawer() {
        setDrawerMode(null);
    }
    function handleOpenOrderHistory() {
        if (!activeCustomer) {
            return;
        }
        closeDrawer();
        void navigate(routes.adminUserOrders(String(activeCustomer.id)));
    }
    function buildPayload(includePassword) {
        const rewardPoints = Number(customerForm.rewardPoints);
        const nextTierPoints = Number(customerForm.nextTierPoints);
        return {
            full_name: customerForm.fullName.trim(),
            email: customerForm.email.trim(),
            phone: customerForm.phone.trim(),
            ...(includePassword ? { password: customerForm.password } : {}),
            address: customerForm.address.trim() || null,
            city: customerForm.city.trim() || null,
            favorite_region: customerForm.favoriteRegion.trim() || null,
            avatar_url: customerForm.avatarUrl.trim() || null,
            newsletter: customerForm.newsletter,
            sms_alerts: customerForm.smsAlerts,
            order_email: customerForm.orderEmail,
            security_alerts: customerForm.securityAlerts,
            reward_points: Number.isFinite(rewardPoints) ? rewardPoints : 0,
            reward_tier: customerForm.rewardTier.trim() || "Bronze",
            next_tier_points: Number.isFinite(nextTierPoints) ? nextTierPoints : 500,
            is_active: customerForm.isActive,
            is_deleted: false,
        };
    }
    async function handleCreateCustomer() {
        if (!customerForm.fullName.trim() ||
            !customerForm.email.trim() ||
            !customerForm.phone.trim() ||
            customerForm.password.length < 8) {
            pushToast({
                tone: "warning",
                message: "Cần nhập tên, email, số điện thoại và mật khẩu tối thiểu 8 ký tự.",
            });
            return;
        }
        const result = await createCustomer(buildPayload(true));
        if (!result.success || !result.data) {
            pushToast({ tone: "warning", message: result.error ?? "Không thể tạo user." });
            return;
        }
        setActiveCustomerId(String(result.data.id));
        setDrawerMode("view");
        pushToast({ tone: "success", message: `Đã tạo user ${result.data.full_name}.` });
    }
    async function handleUpdateCustomer() {
        if (!activeCustomer)
            return;
        const result = await updateCustomer(activeCustomer.id, buildPayload(false));
        if (!result.success || !result.data) {
            pushToast({ tone: "warning", message: result.error ?? "Không thể cập nhật user." });
            return;
        }
        setDrawerMode("view");
        pushToast({ tone: "success", message: `Đã cập nhật user ${result.data.full_name}.` });
    }
    async function handleBlockCustomer(customer = activeCustomer) {
        if (!customer)
            return;
        const result = await blockCustomer(customer.id);
        if (!result.success || !result.data) {
            pushToast({ tone: "warning", message: result.error ?? "Không thể khóa user." });
            return;
        }
        setActiveCustomerId(String(result.data.id));
        setDrawerMode("view");
        pushToast({ tone: "success", message: `Đã khóa user ${result.data.full_name}.` });
    }
    const columns = [
        {
            key: "identity",
            title: "Người dùng",
            width: "24%",
            render: (customer) => (<div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-fixed text-xs font-bold text-on-primary-fixed">
                        {initials(customer.full_name) || "U"}
                    </div>
                    <div className="min-w-0">
                        <p className="truncate font-medium text-on-surface">{customer.full_name}</p>
                        <p className="truncate text-xs text-on-surface-variant">{customer.email}</p>
                    </div>
                </div>),
        },
        {
            key: "region",
            title: "Khu vực",
            width: "22%",
            render: (customer) => (<div>
                    <p>{customer.city ?? "Chưa cập nhật"}</p>
                    <p className="text-xs text-on-surface-variant">
                        {customer.favorite_region ?? "Chưa có vùng yêu thích"}
                    </p>
                </div>),
        },
        {
            key: "orders",
            title: "Đơn",
            align: "right",
            width: "9%",
            nowrap: true,
            render: (customer) => <span className="font-semibold">{customer.orders_count}</span>,
        },
        {
            key: "reward",
            title: "Thưởng",
            width: "15%",
            render: (customer) => (<div>
                    <p className="font-medium">{customer.reward_tier}</p>
                    <p className="text-xs text-on-surface-variant">{customer.reward_points} điểm</p>
                </div>),
        },
        {
            key: "status",
            title: "Trạng thái",
            width: "14%",
            nowrap: true,
            render: (customer) => (<Badge tone={statusTone(customer)}>{statusLabel(customer)}</Badge>),
        },
        {
            key: "actions",
            title: "Thao tác",
            align: "right",
            width: "16%",
            nowrap: true,
            render: (customer) => (<div className="flex justify-end gap-1">
                    <ActionIconButton label={`Xem ${customer.full_name}`} icon="visibility" onClick={() => openCustomerDrawer(customer, "view")}/>
                    <ActionIconButton label={`Sửa ${customer.full_name}`} icon="edit" tone="primary" disabled={!canUpdateUser} onClick={() => openCustomerDrawer(customer, "edit")}/>
                    <ActionIconButton label={`Khóa ${customer.full_name}`} icon="block" tone="danger" disabled={!canDeleteUser || !customer.is_active} onClick={() => void handleBlockCustomer(customer)}/>
                </div>),
        },
    ];
    const drawerTitle = drawerMode === "create"
        ? "Tạo customer"
        : drawerMode === "edit"
            ? "Chỉnh sửa customer"
            : "Hồ sơ customer";
    return (<div className="space-y-8">
            <AdminPageHeader title="Người dùng" description="Quản lý tài khoản customer, trạng thái đăng nhập và thông tin hồ sơ trong admin shell." actions={<>
                    <Button variant="secondary" disabled={!canViewUsers} onClick={() => {
                downloadTextFile("admin-users.json", JSON.stringify(customers, null, 2), "application/json");
                pushToast({ tone: "success", message: "Đã xuất danh sách users." });
            }}>
                        Xuất dữ liệu
                    </Button>
                    <Button disabled={!canCreateUser} onClick={openCreateDrawer}>
                        Tạo user
                    </Button>
                    </>}/>

            <section className="grid gap-6 xl:grid-cols-3">
                {stats.map((stat) => (<StatCard key={stat.id} metric={stat}/>))}
            </section>

            <SurfaceCard className="space-y-5">
                <AdminToolbar>
                    <input className="min-w-0 flex-1 rounded-2xl bg-surface-container-highest px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/15" placeholder="Tìm theo tên, khu vực, email hoặc số điện thoại..." value={query} onChange={(event) => setQuery(event.target.value)}/>
                    <select className="rounded-2xl bg-surface-container-highest px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/15" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                        <option value="all">Tất cả trạng thái</option>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                    </select>
                </AdminToolbar>

                {error ? <p className="text-sm text-error">{error}</p> : null}
                {!canViewUsers ? (<p className="rounded-2xl bg-surface-container-low p-4 text-sm text-on-surface-variant">
                        Bạn chưa có quyền xem danh sách users.
                    </p>) : null}

                {canViewUsers ? (<DataTable rows={filteredCustomers} columns={columns} getRowKey={(customer) => String(customer.id)} isLoading={isLoading} emptyMessage="Không có user phù hợp bộ lọc hiện tại." minWidth="920px" pagination={{ pageSize: 5, itemLabel: "users" }} rowClassName={(customer) => activeCustomerId === String(customer.id) ? "border-l-4 border-primary bg-primary/5" : undefined} onRowClick={(customer) => openCustomerDrawer(customer, "view")}/>) : null}
            </SurfaceCard>

            <AdminDrawer open={drawerMode !== null} mode={drawerMode ?? "view"} title={drawerTitle} subtitle={drawerMode === "create"
            ? "Nhap thong tin de tao tai khoan customer moi."
            : activeCustomer
                ? `${activeCustomer.email} / ${activeCustomer.phone}`
                : undefined} onClose={closeDrawer} footer={<div className="flex flex-wrap justify-end gap-3">
                        <Button variant="outline" onClick={closeDrawer}>
                            Dong
                        </Button>
                        {drawerMode === "create" ? (<Button disabled={isSaving || !canCreateUser} onClick={() => void handleCreateCustomer()}>
                                Tao user
                            </Button>) : null}
                        {drawerMode === "view" && activeCustomer ? (<>
                                <Button variant="secondary" disabled={!canUpdateUser} onClick={() => setDrawerMode("edit")}>
                                    Sua
                                </Button>
                                <Button variant="ghost" disabled={isSaving || !canDeleteUser || !activeCustomer.is_active} onClick={() => void handleBlockCustomer()}>
                                    Khoa user
                                </Button>
                            </>) : null}
                        {drawerMode === "edit" ? (<Button disabled={!activeCustomer || isSaving || !canUpdateUser} onClick={() => void handleUpdateCustomer()}>
                                Luu chinh sua
                            </Button>) : null}
                    </div>}>
                {drawerMode === "view" && activeCustomer ? (<div className="space-y-5">
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-4">
                                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-fixed text-sm font-bold text-on-primary-fixed">
                                    {initials(activeCustomer.full_name) || "U"}
                                </div>
                                <div>
                                    <h3 className="font-headline text-xl font-bold">{activeCustomer.full_name}</h3>
                                    <p className="text-sm text-on-surface-variant">{activeCustomer.email}</p>
                                </div>
                            </div>
                            <Badge tone={statusTone(activeCustomer)}>{statusLabel(activeCustomer)}</Badge>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <FieldValue label="Phone" value={activeCustomer.phone}/>
                            <FieldValue label="City" value={activeCustomer.city}/>
                            <FieldValue label="Favorite region" value={activeCustomer.favorite_region}/>
                            <FieldValue label="Address" value={activeCustomer.address}/>
                            <FieldValue label="Orders" value={activeCustomer.orders_count}/>
                            <FieldValue label="Reward" value={`${activeCustomer.reward_tier} / ${activeCustomer.reward_points} diem`}/>
                        </div>

                        {canViewOrderHistory ? (<div className="rounded-[1.5rem] border border-outline-variant/15 bg-surface-container-low p-4">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div>
                                        <p className="text-sm font-medium text-on-surface">Lich su don hang</p>
                                        <p className="text-sm text-on-surface-variant">
                                            Mo trang danh sach don va chi tiet read-only cua customer nay.
                                        </p>
                                    </div>
                                    <Button variant="secondary" onClick={handleOpenOrderHistory}>
                                        Xem lich su don hang
                                    </Button>
                                </div>
                                {activeCustomer.orders_count === 0 ? (<p className="mt-3 text-sm text-on-surface-variant">
                                        Customer nay chua co don hang nao. Trang lich su se hien thi empty state.
                                    </p>) : null}
                            </div>) : null}
                    </div>) : null}

                {(drawerMode === "create" || drawerMode === "edit") ? (<div className="space-y-5">
                        <div className="grid gap-4 md:grid-cols-2">
                            <input className="rounded-2xl bg-surface-container-highest px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/15" placeholder="Ho ten" value={customerForm.fullName} onChange={(event) => setCustomerForm((current) => ({ ...current, fullName: event.target.value }))}/>
                            <input className="rounded-2xl bg-surface-container-highest px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/15" placeholder="So dien thoai" value={customerForm.phone} onChange={(event) => setCustomerForm((current) => ({ ...current, phone: event.target.value }))}/>
                            <input className="rounded-2xl bg-surface-container-highest px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/15 md:col-span-2" placeholder="Email" type="email" value={customerForm.email} onChange={(event) => setCustomerForm((current) => ({ ...current, email: event.target.value }))}/>
                            {drawerMode === "create" ? (<input className="rounded-2xl bg-surface-container-highest px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/15 md:col-span-2" placeholder="Mat khau moi khi tao user" type="password" value={customerForm.password} onChange={(event) => setCustomerForm((current) => ({ ...current, password: event.target.value }))}/>) : null}
                            <input className="rounded-2xl bg-surface-container-highest px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/15" placeholder="Thanh pho" value={customerForm.city} onChange={(event) => setCustomerForm((current) => ({ ...current, city: event.target.value }))}/>
                            <input className="rounded-2xl bg-surface-container-highest px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/15" placeholder="Vung yeu thich" value={customerForm.favoriteRegion} onChange={(event) => setCustomerForm((current) => ({ ...current, favoriteRegion: event.target.value }))}/>
                            <input className="rounded-2xl bg-surface-container-highest px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/15 md:col-span-2" placeholder="Dia chi" value={customerForm.address} onChange={(event) => setCustomerForm((current) => ({ ...current, address: event.target.value }))}/>
                            <input className="rounded-2xl bg-surface-container-highest px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/15" placeholder="Hang thuong" value={customerForm.rewardTier} onChange={(event) => setCustomerForm((current) => ({ ...current, rewardTier: event.target.value }))}/>
                            <input className="rounded-2xl bg-surface-container-highest px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/15" min={0} placeholder="Diem" type="number" value={customerForm.rewardPoints} onChange={(event) => setCustomerForm((current) => ({ ...current, rewardPoints: event.target.value }))}/>
                            <input className="rounded-2xl bg-surface-container-highest px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/15" min={0} placeholder="Diem len hang tiep" type="number" value={customerForm.nextTierPoints} onChange={(event) => setCustomerForm((current) => ({ ...current, nextTierPoints: event.target.value }))}/>
                            <label className="flex items-center gap-3 rounded-2xl bg-surface-container-highest px-4 py-3 text-sm text-on-surface-variant md:col-span-2">
                                <input type="checkbox" checked={customerForm.isActive} onChange={(event) => setCustomerForm((current) => ({ ...current, isActive: event.target.checked }))}/>
                                User duoc phep dang nhap
                            </label>
                        </div>

                        <div className="grid gap-3 text-sm text-on-surface-variant sm:grid-cols-2">
                            {notificationFields.map((field) => (<label key={field.key} className="flex items-center gap-3 rounded-2xl bg-surface-container-low px-4 py-3">
                                    <input type="checkbox" checked={customerForm[field.key]} onChange={(event) => setCustomerForm((current) => ({
                    ...current,
                    [field.key]: event.target.checked,
                }))}/>
                                    {field.label}
                                </label>))}
                        </div>
                    </div>) : null}
            </AdminDrawer>
        </div>);
}
