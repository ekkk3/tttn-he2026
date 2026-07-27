import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { routes } from "@/shared/config/routes";
import { hasAdminPermission } from "@/shared/lib/auth";
import { downloadTextFile } from "@/shared/lib/download";
import { useAdminSettingsStore, } from "@/shared/lib/store/use-admin-settings-store";
import { useAuthStore } from "@/shared/lib/store/use-auth-store";
import { useFeedbackStore } from "@/shared/lib/store/use-feedback-store";
import { AdminPageHeader, Button, SurfaceCard } from "@/shared/ui";
export function AdminSettingsPage() {
    const navigate = useNavigate();
    const pushToast = useFeedbackStore((state) => state.pushToast);
    const settings = useAdminSettingsStore((state) => state.settings);
    const isLoading = useAdminSettingsStore((state) => state.isLoading);
    const isSaving = useAdminSettingsStore((state) => state.isSaving);
    const error = useAdminSettingsStore((state) => state.error);
    const loadSettings = useAdminSettingsStore((state) => state.loadSettings);
    const saveSettings = useAdminSettingsStore((state) => state.saveSettings);
    const user = useAuthStore((state) => state.session?.user ?? null);
    const [form, setForm] = useState(settings);
    const canViewSettings = hasAdminPermission(user, "admin.settings.view");
    const canUpdateSettings = hasAdminPermission(user, "admin.settings.update");
    useEffect(() => {
        if (canViewSettings) {
            void loadSettings();
        }
    }, [canViewSettings, loadSettings]);
    useEffect(() => {
        setForm(settings);
    }, [settings]);
    function handleExport() {
        downloadTextFile("admin-settings.json", JSON.stringify(form, null, 2), "application/json");
        pushToast({
            tone: "success",
            message: "Đã xuất cấu hình admin hiện tại.",
        });
    }
    async function handleSave() {
        const result = await saveSettings(form);
        pushToast({
            tone: result.success ? "success" : "warning",
            message: result.success
                ? "Đã lưu cấu hình quản trị."
                : (result.error ?? "Không thể lưu cấu hình quản trị."),
        });
    }
    return (<div className="space-y-8">
            <AdminPageHeader title="Cấu hình quản trị" description="Quản lý các thông số vận hành cơ bản cho tài khoản admin hiện tại."/>

            {isLoading ? (<SurfaceCard className="text-on-surface-variant">Đang tải cấu hình...</SurfaceCard>) : null}
            {!canViewSettings ? (<SurfaceCard className="text-on-surface-variant">
                    Bạn chưa có quyền xem cấu hình hiện tại.
                </SurfaceCard>) : null}
            {error ? <SurfaceCard className="text-on-surface-variant">{error}</SurfaceCard> : null}

            <SurfaceCard className="grid gap-6 lg:grid-cols-2">
                <label className="space-y-2">
                    <span className="text-sm font-semibold">Tên cửa hàng</span>
                    <input className="w-full rounded-2xl bg-surface-container-highest px-4 py-3 outline-none" value={form.storeName} onChange={(event) => setForm((current) => ({ ...current, storeName: event.target.value }))}/>
                </label>
                <label className="space-y-2">
                    <span className="text-sm font-semibold">Email hỗ trợ</span>
                    <input className="w-full rounded-2xl bg-surface-container-highest px-4 py-3 outline-none" value={form.supportEmail} onChange={(event) => setForm((current) => ({ ...current, supportEmail: event.target.value }))}/>
                </label>
                <label className="space-y-2">
                    <span className="text-sm font-semibold">Số điện thoại hỗ trợ</span>
                    <input className="w-full rounded-2xl bg-surface-container-highest px-4 py-3 outline-none" value={form.supportPhone} onChange={(event) => setForm((current) => ({ ...current, supportPhone: event.target.value }))}/>
                </label>
                <label className="space-y-2">
                    <span className="text-sm font-semibold">Ngưỡng cảnh báo tồn kho</span>
                    <input className="w-full rounded-2xl bg-surface-container-highest px-4 py-3 outline-none" min={1} type="number" value={form.lowStockThreshold} onChange={(event) => setForm((current) => ({
            ...current,
            lowStockThreshold: Number(event.target.value) || 1,
        }))}/>
                </label>
                <label className="space-y-2">
                    <span className="text-sm font-semibold">Chu kỳ làm mới dashboard (giây)</span>
                    <input className="w-full rounded-2xl bg-surface-container-highest px-4 py-3 outline-none" min={15} type="number" value={form.dashboardRefreshSeconds} onChange={(event) => setForm((current) => ({
            ...current,
            dashboardRefreshSeconds: Number(event.target.value) || 15,
        }))}/>
                </label>
                <label className="space-y-2 lg:col-span-2">
                    <span className="text-sm font-semibold">Ghi chú vận hành</span>
                    <textarea className="min-h-32 w-full rounded-2xl bg-surface-container-highest px-4 py-3 outline-none" value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}/>
                </label>
                {[
            {
                key: "orderAutoConfirm",
                title: "Tự động xác nhận đơn",
                description: "Lưu tùy chọn xử lý nhanh đơn mới cho tài khoản admin này.",
            },
            {
                key: "sendDailySummary",
                title: "Nhận tổng hợp hằng ngày",
                description: "Dùng cho nhắc việc và tổng hợp dashboard theo ngày.",
            },
            {
                key: "maintenanceMode",
                title: "Chế độ bảo trì",
                description: "Đánh dấu trạng thái quản trị đang bảo trì nội bộ.",
            },
        ].map((item) => (<label key={item.key} className="flex items-center justify-between gap-4 rounded-3xl bg-surface-container-low p-5 lg:col-span-2">
                        <span>
                            <span className="block font-semibold">{item.title}</span>
                            <span className="mt-1 block text-sm text-on-surface-variant">
                                {item.description}
                            </span>
                        </span>
                        <input className="h-5 w-5 rounded border-outline-variant text-primary focus:ring-primary" type="checkbox" checked={Boolean(form[item.key])} onChange={(event) => setForm((current) => ({
                ...current,
                [item.key]: event.target.checked,
            }))}/>
                    </label>))}
                <div className="flex flex-wrap gap-3 lg:col-span-2">
                    <Button disabled={isSaving || !canUpdateSettings} onClick={() => void handleSave()}>
                        {isSaving ? "Đang lưu..." : "Lưu cấu hình"}
                    </Button>
                    <Button variant="secondary" onClick={handleExport}>
                        Xuất JSON
                    </Button>
                    <Button variant="outline" onClick={() => void navigate(routes.logout)}>
                        Đăng xuất
                    </Button>
                </div>
                {form.updatedAt ? (<p className="text-sm text-on-surface-variant lg:col-span-2">
                        Cập nhật lần cuối: {new Date(form.updatedAt).toLocaleString("vi-VN")}
                    </p>) : null}
            </SurfaceCard>

            <div className="grid gap-6 xl:grid-cols-3">
                <SurfaceCard className="space-y-4">
                    <h3 className="font-headline text-xl font-semibold">Xuất dữ liệu</h3>
                    <p className="text-sm text-on-surface-variant">
                        Tải nhanh cấu hình admin đang hiện hành để đối chiếu hoặc lưu trữ.
                    </p>
                    <Button onClick={handleExport}>Xuất cấu hình</Button>
                </SurfaceCard>

                <SurfaceCard className="space-y-4">
                    <h3 className="font-headline text-xl font-semibold">Cấu hình vận hành</h3>
                    <p className="text-sm text-on-surface-variant">
                        Trang này đã được nối với backend, dữ liệu lưu theo tài khoản admin đang đăng nhập.
                    </p>
                    <Button variant="secondary" disabled>
                        Đang dùng API thật
                    </Button>
                </SurfaceCard>

                <SurfaceCard className="space-y-4">
                    <h3 className="font-headline text-xl font-semibold">Phiên làm việc</h3>
                    <p className="text-sm text-on-surface-variant">
                        Đăng xuất để chuyển tài khoản hoặc kiểm tra phân quyền admin khác.
                    </p>
                    <Button variant="outline" onClick={() => void navigate(routes.logout)}>
                        Đăng xuất
                    </Button>
                </SurfaceCard>
            </div>
        </div>);
}
