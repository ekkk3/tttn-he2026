import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { routes } from "@/shared/config/routes";
import { useAccountStore } from "@/shared/lib/store/use-account-store";
import { useFeedbackStore } from "@/shared/lib/store/use-feedback-store";
import { Icon } from "@/shared/ui";
export function AccountProfilePage() {
    const navigate = useNavigate();
    const profile = useAccountStore((state) => state.profile);
    const loadProfile = useAccountStore((state) => state.loadProfile);
    const saveProfile = useAccountStore((state) => state.saveProfile);
    const updateAvatar = useAccountStore((state) => state.updateAvatar);
    const removeAvatar = useAccountStore((state) => state.removeAvatar);
    const isSaving = useAccountStore((state) => state.isSaving);
    const pushToast = useFeedbackStore((state) => state.pushToast);
    const [form, setForm] = useState(profile);
    const fileInputRef = useRef(null);
    useEffect(() => {
        void loadProfile();
    }, [loadProfile]);
    useEffect(() => {
        setForm(profile);
    }, [profile]);
    function updateField(key, value) {
        setForm((current) => ({
            ...current,
            [key]: value,
        }));
    }
    async function handleSaveChanges() {
        const result = await saveProfile({
            name: form.name,
            phone: form.phone,
            city: form.city,
            address: form.address,
            newsletter: form.newsletter,
            smsAlerts: form.smsAlerts,
            orderEmail: form.orderEmail,
            securityAlerts: form.securityAlerts,
            favoriteRegion: form.favoriteRegion,
        });
        if (result.success) {
            await loadProfile();
        }
        pushToast({
            tone: result.success ? "success" : "warning",
            message: result.success
                ? "Hồ sơ khách hàng đã được cập nhật."
                : (result.error ?? "Không thể cập nhật hồ sơ."),
        });
    }
    function handleAvatarChange(file) {
        if (!file)
            return;
        const reader = new FileReader();
        reader.onload = () => {
            const source = reader.result;
            if (typeof source !== "string") {
                pushToast({
                    tone: "warning",
                    message: "Không thể đọc tệp ảnh đã chọn.",
                });
                return;
            }
            const image = new Image();
            image.onload = async () => {
                const canvas = document.createElement("canvas");
                const maxSize = 320;
                const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
                canvas.width = Math.max(1, Math.round(image.width * scale));
                canvas.height = Math.max(1, Math.round(image.height * scale));
                const context = canvas.getContext("2d");
                if (!context) {
                    pushToast({
                        tone: "warning",
                        message: "Không thể xử lý ảnh đã chọn.",
                    });
                    return;
                }
                context.drawImage(image, 0, 0, canvas.width, canvas.height);
                const avatar = canvas.toDataURL("image/jpeg", 0.82);
                updateField("avatar", avatar);
                const result = await updateAvatar(avatar);
                if (result.success) {
                    await loadProfile();
                }
                pushToast({
                    tone: result.success ? "success" : "warning",
                    message: result.success
                        ? "Ảnh đại diện đã được thay mới."
                        : (result.error ?? "Không thể cập nhật ảnh đại diện."),
                });
            };
            image.onerror = () => {
                pushToast({
                    tone: "warning",
                    message: "Tệp ảnh không hợp lệ.",
                });
            };
            image.src = source;
        };
        reader.readAsDataURL(file);
    }
    return (<div className="mx-auto max-w-7xl px-6 pb-12 pt-24">
            <div className="flex flex-col gap-12 md:flex-row">
                <aside className="w-full flex-shrink-0 md:w-64">
                    <div className="space-y-1">
                        <Link to={routes.accountOrders} className="group flex w-full items-center gap-3 px-4 py-3 text-left text-stone-500 transition-colors hover:text-green-600">
                            <Icon name="inventory_2" className="text-xl transition-transform group-hover:scale-110"/>
                            <span className="text-sm font-medium">Đơn hàng của tôi</span>
                        </Link>
                        <div className="flex w-full items-center gap-3 rounded-xl border-r-4 border-primary bg-primary/10 px-4 py-3 font-semibold text-primary">
                            <Icon name="person" className="text-xl"/>
                            <span className="text-sm">Thông tin cá nhân</span>
                        </div>
                        <button className="group flex w-full items-center gap-3 px-4 py-3 text-left text-stone-500 transition-colors hover:text-green-600" onClick={() => void navigate(routes.accountSecurity)}>
                            <Icon name="shield" className="text-xl transition-transform group-hover:scale-110"/>
                            <span className="text-sm font-medium">Bảo mật và mật khẩu</span>
                        </button>
                        <button className="group flex w-full items-center gap-3 px-4 py-3 text-left text-stone-500 transition-colors hover:text-green-600" onClick={() => void navigate(routes.accountNotifications)}>
                            <Icon name="notifications" className="text-xl transition-transform group-hover:scale-110"/>
                            <span className="text-sm font-medium">Thông báo</span>
                        </button>
                        <button className="group flex w-full items-center gap-3 px-4 py-3 text-left text-stone-500 transition-colors hover:text-green-600" onClick={() => void navigate(routes.accountAddresses)}>
                            <Icon name="location_on" className="text-xl transition-transform group-hover:scale-110"/>
                            <span className="text-sm font-medium">Sổ địa chỉ</span>
                        </button>
                        <button className="group flex w-full items-center gap-3 px-4 py-3 text-left text-stone-500 transition-colors hover:text-green-600" onClick={() => void navigate(routes.accountDisputes)}>
                            <Icon name="gavel" className="text-xl transition-transform group-hover:scale-110"/>
                            <span className="text-sm font-medium">Khiếu nại và hỗ trợ</span>
                        </button>
                    </div>
                </aside>

                <div className="flex-1 space-y-12">
                    <div className="flex flex-col justify-between gap-6 border-b border-outline-variant/15 pb-8 sm:flex-row sm:items-end">
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight text-on-surface">
                                Thông tin cá nhân
                            </h1>
                            <p className="mt-2 text-on-surface-variant">
                                Quản lý hồ sơ khách hàng, thông tin liên hệ và kênh nhận cập nhật.
                            </p>
                        </div>
                        <button className="flex items-center justify-center gap-2 rounded-full bg-primary px-8 py-3 font-medium text-on-primary shadow-lg transition-all active:scale-95 disabled:opacity-60" disabled={isSaving} onClick={() => void handleSaveChanges()}>
                            {isSaving ? "Đang lưu..." : "Lưu thay đổi"}
                        </button>
                    </div>

                    <div className="flex items-center gap-8">
                        <div className="group relative">
                            <img src={form.avatar || "https://placehold.co/256x256?text=Avatar"} alt="Profile avatar" className="h-32 w-32 rounded-full object-cover ring-4 ring-primary/10"/>
                            <button className="absolute bottom-0 right-0 rounded-full bg-white p-2 shadow-md transition-colors hover:bg-surface-container" onClick={() => fileInputRef.current?.click()}>
                                <Icon name="photo_camera" className="text-lg text-primary"/>
                            </button>
                            <input ref={fileInputRef} className="hidden" type="file" accept="image/png,image/jpeg,image/gif" onChange={(event) => void handleAvatarChange(event.target.files?.[0])}/>
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-on-surface">Ảnh đại diện</h3>
                            <p className="mb-3 text-sm text-on-surface-variant">
                                Hỗ trợ JPG, GIF hoặc PNG. Ảnh sẽ được lưu vào tài khoản backend.
                            </p>
                            <div className="flex gap-3">
                                <button className="rounded-lg border border-primary/20 px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/5" onClick={() => fileInputRef.current?.click()}>
                                    Tải ảnh mới
                                </button>
                                <button className="rounded-lg px-4 py-2 text-sm font-semibold text-error transition-colors hover:bg-error/5" onClick={async () => {
            const result = await removeAvatar();
            pushToast({
                tone: result.success ? "success" : "warning",
                message: result.success
                    ? "Đã gỡ ảnh đại diện."
                    : (result.error ?? "Không thể gỡ ảnh đại diện."),
            });
        }}>
                                    Gỡ ảnh
                                </button>
                            </div>
                        </div>
                    </div>

                    <section className="space-y-8 rounded-xl bg-surface-container-lowest p-8">
                        <div className="flex items-center gap-3">
                            <span className="h-6 w-1 rounded-full bg-primary"/>
                            <h2 className="text-xl font-bold text-on-surface">Thông tin cơ bản</h2>
                        </div>
                        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                                    Họ và tên
                                </label>
                                <input className="w-full rounded-t-lg border-b-2 border-transparent bg-surface-container-highest px-4 py-3 transition-all focus:border-primary focus:ring-0" value={form.name} onChange={(event) => updateField("name", event.target.value)}/>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                                    Email
                                </label>
                                <input className="w-full cursor-not-allowed rounded-t-lg border-b-2 border-outline-variant/30 bg-surface-container px-4 py-3 text-stone-400" value={form.email} disabled readOnly/>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                                    Số điện thoại
                                </label>
                                <input className="w-full rounded-t-lg border-b-2 border-transparent bg-surface-container-highest px-4 py-3 transition-all focus:border-primary focus:ring-0" value={form.phone} onChange={(event) => updateField("phone", event.target.value)}/>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                                    Thành phố
                                </label>
                                <input className="w-full rounded-t-lg border-b-2 border-transparent bg-surface-container-highest px-4 py-3 transition-all focus:border-primary focus:ring-0" value={form.city} onChange={(event) => updateField("city", event.target.value)}/>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                                Địa chỉ
                            </label>
                            <input className="w-full rounded-t-lg border-b-2 border-transparent bg-surface-container-highest px-4 py-3 transition-all focus:border-primary focus:ring-0" value={form.address} onChange={(event) => updateField("address", event.target.value)}/>
                        </div>
                    </section>

                    <section className="space-y-8 rounded-xl bg-surface-container-lowest p-8">
                        <div className="flex items-center gap-3">
                            <span className="h-6 w-1 rounded-full bg-primary"/>
                            <h2 className="text-xl font-bold text-on-surface">Tùy chọn thông báo nhanh</h2>
                        </div>
                        <label className="flex items-center justify-between gap-4 rounded-xl bg-surface-container-low p-4">
                            <span>
                                <span className="block font-medium">Nhận email về bộ sưu tập mới</span>
                                <span className="text-sm text-on-surface-variant">
                                    Cập nhật mùa vụ, đặc sản mới và ưu đãi hội viên.
                                </span>
                            </span>
                            <input checked={form.newsletter} className="h-5 w-5 rounded border-outline-variant text-primary focus:ring-primary" onChange={(event) => updateField("newsletter", event.target.checked)} type="checkbox"/>
                        </label>
                        <label className="flex items-center justify-between gap-4 rounded-xl bg-surface-container-low p-4">
                            <span>
                                <span className="block font-medium">Nhận SMS về cập nhật đơn hàng</span>
                                <span className="text-sm text-on-surface-variant">
                                    Dùng cho các đơn cần giao nhanh hoặc đơn quà tặng.
                                </span>
                            </span>
                            <input checked={form.smsAlerts} className="h-5 w-5 rounded border-outline-variant text-primary focus:ring-primary" onChange={(event) => updateField("smsAlerts", event.target.checked)} type="checkbox"/>
                        </label>
                    </section>
                </div>
            </div>
        </div>);
}
