import { useEffect, useState } from "react";
import { useAccountStore } from "@/shared/lib/store/use-account-store";
import { useFeedbackStore } from "@/shared/lib/store/use-feedback-store";
import { Button, SurfaceCard } from "@/shared/ui";
export function AccountNotificationsPage() {
    const profile = useAccountStore((state) => state.profile);
    const notifications = useAccountStore((state) => state.notifications);
    const loadProfile = useAccountStore((state) => state.loadProfile);
    const loadNotifications = useAccountStore((state) => state.loadNotifications);
    const saveProfile = useAccountStore((state) => state.saveProfile);
    const markNotificationRead = useAccountStore((state) => state.markNotificationRead);
    const isSaving = useAccountStore((state) => state.isSaving);
    const isNotificationsLoading = useAccountStore((state) => state.isNotificationsLoading);
    const pushToast = useFeedbackStore((state) => state.pushToast);
    const [message, setMessage] = useState("");
    const [preferences, setPreferences] = useState({
        newsletter: profile.newsletter,
        smsAlerts: profile.smsAlerts,
        orderEmail: profile.orderEmail,
        securityAlerts: profile.securityAlerts,
    });
    useEffect(() => {
        void loadProfile();
        void loadNotifications();
    }, [loadNotifications, loadProfile]);
    useEffect(() => {
        setPreferences({
            newsletter: profile.newsletter,
            smsAlerts: profile.smsAlerts,
            orderEmail: profile.orderEmail,
            securityAlerts: profile.securityAlerts,
        });
    }, [profile]);
    async function handleSavePreferences() {
        const result = await saveProfile(preferences);
        if (!result.success) {
            setMessage(result.error ?? "Không thể lưu tùy chọn thông báo.");
            return;
        }
        setMessage("Đã lưu cấu hình thông báo.");
        pushToast({
            tone: "success",
            message: "Tùy chọn thông báo đã được cập nhật.",
        });
    }
    return (<div className="mx-auto max-w-4xl px-6 pb-16 pt-24">
            <div className="space-y-8">
                <div>
                    <h1 className="font-headline text-2xl font-bold">Thông báo và liên lạc</h1>
                    <p className="mt-2 text-on-surface-variant">
                        Tùy chỉnh cách hệ thống liên hệ với bạn trong quá trình mua hàng.
                    </p>
                </div>

                <SurfaceCard className="space-y-4">
                    {[
            {
                field: "newsletter",
                title: "Bản tin mùa vụ",
                description: "Nhận email về bộ sưu tập mới và nội dung vùng miền.",
            },
            {
                field: "smsAlerts",
                title: "SMS giao vận",
                description: "Thông báo đơn cần giao gấp hoặc thay đổi ca giao.",
            },
            {
                field: "orderEmail",
                title: "Email trạng thái đơn",
                description: "Xác nhận đơn, hoàn tiền và cập nhật bàn giao vận chuyển.",
            },
            {
                field: "securityAlerts",
                title: "Cảnh báo bảo mật",
                description: "Thông báo khi đổi mật khẩu hoặc có đăng nhập bất thường.",
            },
        ].map((item) => (<label key={item.field} className="flex items-center justify-between gap-4 rounded-3xl bg-surface-container-low p-5">
                            <span>
                                <span className="block font-semibold">{item.title}</span>
                                <span className="mt-1 block text-sm text-on-surface-variant">
                                    {item.description}
                                </span>
                            </span>
                            <input className="h-5 w-5 rounded border-outline-variant text-primary focus:ring-primary" type="checkbox" checked={Boolean(preferences[item.field])} onChange={(event) => setPreferences((current) => ({
                ...current,
                [item.field]: event.target.checked,
            }))}/>
                        </label>))}

                    <div className="flex items-center justify-between rounded-3xl bg-surface-container-low p-5">
                        <div>
                            <p className="font-semibold">Cập nhật tùy chọn thông báo</p>
                            <p className="mt-1 text-sm text-on-surface-variant">
                                Các tùy chọn này sẽ được lưu trên tài khoản backend của bạn.
                            </p>
                        </div>
                        <Button variant="secondary" disabled={isSaving} onClick={() => void handleSavePreferences()}>
                            {isSaving ? "Đang lưu..." : "Lưu thay đổi"}
                        </Button>
                    </div>
                    {message ? <p className="text-sm text-primary">{message}</p> : null}
                </SurfaceCard>

                <SurfaceCard className="space-y-4">
                    <h2 className="font-headline text-2xl font-bold">Danh sách thông báo</h2>
                    {isNotificationsLoading ? (<p className="text-sm text-on-surface-variant">Đang tải thông báo...</p>) : notifications.length === 0 ? (<p className="text-sm text-on-surface-variant">Chưa có thông báo nào.</p>) : (<div className="space-y-3">
                            {notifications.map((notification) => (<div key={notification.id} className="rounded-3xl bg-surface-container-low p-4">
                                    <div className="flex items-start justify-between gap-4">
                                        <div>
                                            <p className="font-semibold">{notification.title}</p>
                                            <p className="mt-1 text-sm text-on-surface-variant">
                                                {notification.message}
                                            </p>
                                            <p className="mt-2 text-xs text-on-surface-variant">
                                                {notification.createdAt
                    ? new Date(notification.createdAt).toLocaleString("vi-VN")
                    : notification.channel}
                                            </p>
                                        </div>
                                        {!notification.readAt ? (<Button size="sm" variant="outline" onClick={async () => {
                        const result = await markNotificationRead(notification.id);
                        pushToast({
                            tone: result.success ? "success" : "warning",
                            message: result.success
                                ? "Đã đánh dấu thông báo đã đọc."
                                : (result.error ?? "Không thể cập nhật thông báo."),
                        });
                    }}>
                                                Đánh dấu đã đọc
                                            </Button>) : (<span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                                                Đã đọc
                                            </span>)}
                                    </div>
                                </div>))}
                        </div>)}
                </SurfaceCard>
            </div>
        </div>);
}
