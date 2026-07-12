import { useEffect, useMemo, useState } from "react";
import { useAdminAdminsStore } from "@/shared/lib/store/use-admin-admins-store";
import { useFeedbackStore } from "@/shared/lib/store/use-feedback-store";
import { AdminPageHeader, Badge, Button, Input, SurfaceCard } from "@/shared/ui";

const emptyAdminForm = {
    id: "",
    fullName: "",
    email: "",
    phone: "",
    password: "",
    isActive: true,
};

function statusTone(admin) {
    return admin.is_active && !admin.is_deleted ? "success" : "warning";
}

function statusLabel(admin) {
    return admin.is_active && !admin.is_deleted ? "Đang hoạt động" : "Đã khóa";
}

export function AdminAdminsPage() {
    const [query, setQuery] = useState("");
    const [form, setForm] = useState(emptyAdminForm);
    const admins = useAdminAdminsStore((state) => state.admins);
    const isLoading = useAdminAdminsStore((state) => state.isLoading);
    const isSaving = useAdminAdminsStore((state) => state.isSaving);
    const error = useAdminAdminsStore((state) => state.error);
    const loadAdmins = useAdminAdminsStore((state) => state.loadAdmins);
    const saveAdmin = useAdminAdminsStore((state) => state.saveAdmin);
    const updateAdminStatus = useAdminAdminsStore((state) => state.updateAdminStatus);
    const updateAdminPassword = useAdminAdminsStore((state) => state.updateAdminPassword);
    const pushToast = useFeedbackStore((state) => state.pushToast);

    useEffect(() => {
        void loadAdmins();
    }, [loadAdmins]);

    const filteredAdmins = useMemo(() => {
        const keyword = query.trim().toLowerCase();
        if (!keyword) {
            return admins;
        }

        return admins.filter((admin) => [
            admin.full_name,
            admin.email,
            admin.phone,
            admin.created_by_admin?.full_name,
        ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(keyword));
    }, [admins, query]);

    function selectAdmin(admin) {
        setForm({
            id: admin.id,
            fullName: admin.full_name,
            email: admin.email,
            phone: admin.phone,
            password: "",
            isActive: admin.is_active && !admin.is_deleted,
        });
    }

    function resetForm() {
        setForm(emptyAdminForm);
    }

    async function handleSave() {
        if (!form.fullName.trim() || !form.email.trim() || !form.phone.trim()) {
            pushToast({ tone: "warning", message: "Cần nhập họ tên, email và số điện thoại." });
            return;
        }

        if (!form.id && form.password.trim().length < 8) {
            pushToast({ tone: "warning", message: "Mật khẩu admin mới phải có ít nhất 8 ký tự." });
            return;
        }

        const result = await saveAdmin(form);
        if (!result.success || !result.data) {
            pushToast({ tone: "warning", message: result.error ?? "Không thể lưu tài khoản admin." });
            return;
        }

        if (form.id && form.password.trim()) {
            const passwordResult = await updateAdminPassword(form.id, form.password);
            if (!passwordResult.success) {
                pushToast({ tone: "warning", message: passwordResult.error ?? "Không thể cập nhật mật khẩu admin." });
                return;
            }
        }

        pushToast({
            tone: "success",
            message: form.id ? `Đã cập nhật ${result.data.full_name}.` : `Đã tạo ${result.data.full_name}.`,
        });
        setForm({
            id: result.data.id,
            fullName: result.data.full_name,
            email: result.data.email,
            phone: result.data.phone,
            password: "",
            isActive: result.data.is_active && !result.data.is_deleted,
        });
    }

    async function handleToggleStatus(admin) {
        const result = await updateAdminStatus(admin.id, !(admin.is_active && !admin.is_deleted));
        if (!result.success || !result.data) {
            pushToast({ tone: "warning", message: result.error ?? "Không thể cập nhật trạng thái admin." });
            return;
        }

        pushToast({
            tone: "success",
            message: result.data.is_active && !result.data.is_deleted
                ? `Đã kích hoạt ${result.data.full_name}.`
                : `Đã khóa ${result.data.full_name}.`,
        });

        if (String(form.id) === String(result.data.id)) {
            selectAdmin(result.data);
        }
    }

    return (<div className="space-y-6">
            <AdminPageHeader title="Tài khoản admin" description="Quản lý trực tiếp tài khoản quản trị mà không còn role hay permission." actions={<div className="flex gap-2">
                        <Button variant="outline" onClick={() => void loadAdmins()} disabled={isLoading || isSaving}>
                            Tải lại
                        </Button>
                        <Button onClick={resetForm} disabled={isSaving}>
                            Tạo admin mới
                        </Button>
                    </div>}/>

            {error ? <SurfaceCard className="text-sm text-error">{error}</SurfaceCard> : null}

            <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
                <SurfaceCard className="space-y-4">
                    <div className="flex flex-wrap items-end justify-between gap-3">
                        <div>
                            <h3 className="font-headline text-2xl font-bold">Danh sách admin</h3>
                            <p className="mt-1 text-sm text-on-surface-variant">{admins.length} tài khoản</p>
                        </div>
                        <div className="w-full max-w-sm">
                            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm theo tên, email, số điện thoại"/>
                        </div>
                    </div>

                    {isLoading ? <div className="text-sm text-on-surface-variant">Đang tải danh sách admin...</div> : null}

                    <div className="space-y-3">
                        {filteredAdmins.map((admin) => (<div key={admin.id} className="rounded-3xl border border-outline-variant/15 bg-surface-container-low p-4">
                                <div className="flex flex-wrap items-start justify-between gap-4">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <p className="font-semibold text-on-surface">{admin.full_name}</p>
                                            <Badge tone={statusTone(admin)}>{statusLabel(admin)}</Badge>
                                        </div>
                                        <p className="text-sm text-on-surface-variant">{admin.email}</p>
                                        <p className="text-sm text-on-surface-variant">{admin.phone}</p>
                                        <p className="text-xs text-on-surface-variant">
                                            Tạo bởi {admin.created_by_admin?.full_name ?? "Hệ thống"}
                                        </p>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <Button variant="outline" size="sm" onClick={() => selectAdmin(admin)}>
                                            Sửa
                                        </Button>
                                        <Button variant="secondary" size="sm" onClick={() => void handleToggleStatus(admin)} disabled={isSaving}>
                                            {admin.is_active && !admin.is_deleted ? "Khóa" : "Kích hoạt"}
                                        </Button>
                                    </div>
                                </div>
                            </div>))}

                        {!isLoading && filteredAdmins.length === 0 ? (<div className="rounded-3xl border border-dashed border-outline-variant/30 bg-surface-container-low p-6 text-sm text-on-surface-variant">
                                Không có tài khoản admin nào khớp bộ lọc.
                            </div>) : null}
                    </div>
                </SurfaceCard>

                <SurfaceCard className="space-y-4">
                    <div>
                        <h3 className="font-headline text-2xl font-bold">{form.id ? "Sửa tài khoản admin" : "Tạo tài khoản admin"}</h3>
                        <p className="mt-1 text-sm text-on-surface-variant">
                            {form.id ? "Cập nhật hồ sơ, trạng thái và đổi mật khẩu khi cần." : "Tạo một tài khoản ROLE_ADMIN mới."}
                        </p>
                    </div>

                    <div className="grid gap-4">
                        <label className="space-y-2 text-sm">
                            <span className="text-on-surface-variant">Họ tên</span>
                            <Input value={form.fullName} onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))}/>
                        </label>
                        <label className="space-y-2 text-sm">
                            <span className="text-on-surface-variant">Email</span>
                            <Input value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}/>
                        </label>
                        <label className="space-y-2 text-sm">
                            <span className="text-on-surface-variant">Số điện thoại</span>
                            <Input value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}/>
                        </label>
                        <label className="space-y-2 text-sm">
                            <span className="text-on-surface-variant">{form.id ? "Mật khẩu mới nếu cần" : "Mật khẩu"}</span>
                            <Input type="password" value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}/>
                        </label>
                        <label className="flex items-center gap-3 text-sm text-on-surface-variant">
                            <input className="h-4 w-4" type="checkbox" checked={form.isActive} onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))}/>
                            <span>Cho phép đăng nhập admin</span>
                        </label>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <Button onClick={() => void handleSave()} disabled={isSaving}>
                            {form.id ? "Lưu thay đổi" : "Tạo admin"}
                        </Button>
                        <Button variant="outline" onClick={resetForm} disabled={isSaving}>
                            Làm mới form
                        </Button>
                    </div>
                </SurfaceCard>
            </div>
        </div>);
}
