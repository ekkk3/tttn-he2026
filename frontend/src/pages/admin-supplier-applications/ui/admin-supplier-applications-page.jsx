import { useEffect, useState } from "react";
import { apiRequest } from "@/shared/api/backend-client";
import { hasAdminPermission } from "@/shared/lib/auth";
import { useAuthStore } from "@/shared/lib/store/use-auth-store";
import { useFeedbackStore } from "@/shared/lib/store/use-feedback-store";
import { ActionIconButton, AdminPageHeader, Badge, Button, DataTable, StatCard, SurfaceCard } from "@/shared/ui";

function formatAdminDate(value) {
    if (!value) return "Chưa có";
    return new Intl.DateTimeFormat("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    }).format(new Date(value));
}

export function AdminSupplierApplicationsPage() {
    const accessToken = useAuthStore((state) => state.accessToken);
    const user = useAuthStore((state) => state.session?.user ?? null);
    const pushToast = useFeedbackStore((state) => state.pushToast);
    const canManage = hasAdminPermission(user, "admin.suppliers.update");

    const [applications, setApplications] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const [processingId, setProcessingId] = useState(null);

    async function loadPending() {
        if (!accessToken) return;
        setIsLoading(true);
        setError("");
        try {
            const response = await apiRequest("/admin/suppliers/pending", { token: accessToken });
            setApplications(response.data ?? []);
        } catch (loadError) {
            setError(loadError instanceof Error ? loadError.message : "Không thể tải danh sách chờ duyệt.");
        } finally {
            setIsLoading(false);
        }
    }

    useEffect(() => {
        void loadPending();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [accessToken]);

    async function handleApprove(supplier) {
        if (!accessToken) return;
        setProcessingId(supplier.id);
        try {
            await apiRequest(`/admin/suppliers/${supplier.id}/approve`, { method: "PATCH", token: accessToken });
            pushToast({ tone: "success", message: `Đã duyệt ${supplier.name}.` });
            setApplications((current) => current.filter((item) => item.id !== supplier.id));
        } catch (actionError) {
            pushToast({
                tone: "warning",
                message: actionError instanceof Error ? actionError.message : "Không thể duyệt yêu cầu này.",
            });
        } finally {
            setProcessingId(null);
        }
    }

    async function handleReject(supplier) {
        if (!accessToken) return;
        const reason = window.prompt(`Lý do từ chối "${supplier.name}" (không bắt buộc):`, "") ?? "";
        setProcessingId(supplier.id);
        try {
            await apiRequest(`/admin/suppliers/${supplier.id}/reject`, {
                method: "PATCH",
                token: accessToken,
                body: { reason: reason.trim() || undefined },
            });
            pushToast({ tone: "success", message: `Đã từ chối ${supplier.name}.` });
            setApplications((current) => current.filter((item) => item.id !== supplier.id));
        } catch (actionError) {
            pushToast({
                tone: "warning",
                message: actionError instanceof Error ? actionError.message : "Không thể từ chối yêu cầu này.",
            });
        } finally {
            setProcessingId(null);
        }
    }

    const columns = [
        {
            key: "supplier",
            title: "Nhà cung cấp",
            width: "28%",
            render: (supplier) => (
                <div>
                    <p className="font-semibold text-on-surface">{supplier.name}</p>
                    <p className="mt-1 text-xs text-on-surface-variant">{supplier.address || "Chưa có địa chỉ"}</p>
                </div>
            ),
        },
        {
            key: "contact",
            title: "Liên hệ",
            width: "22%",
            render: (supplier) => (
                <div>
                    <p>{supplier.contact_name || "Chưa có"}</p>
                    <p className="text-xs text-on-surface-variant">{supplier.phone}</p>
                    <p className="text-xs text-on-surface-variant">{supplier.email}</p>
                </div>
            ),
        },
        {
            key: "license",
            title: "Hồ sơ",
            width: "16%",
            render: (supplier) =>
                supplier.license_file_url ? (
                    <a
                        className="text-primary hover:underline"
                        href={`${(import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000/api").replace(/\/api\/?$/, "")}${supplier.license_file_url}`}
                        target="_blank"
                        rel="noreferrer"
                    >
                        Xem file đính kèm
                    </a>
                ) : (
                    <span className="text-xs text-on-surface-variant">Không có file</span>
                ),
        },
        {
            key: "created",
            title: "Ngày gửi",
            width: "14%",
            nowrap: true,
            render: (supplier) => formatAdminDate(supplier.created_at),
        },
        {
            key: "actions",
            title: "Thao tác",
            align: "right",
            width: "20%",
            nowrap: true,
            render: (supplier) => (
                <div className="flex justify-end gap-2">
                    <Button
                        size="sm"
                        variant="secondary"
                        disabled={!canManage || processingId === supplier.id}
                        onClick={() => void handleApprove(supplier)}
                    >
                        Duyệt
                    </Button>
                    <ActionIconButton
                        label={`Từ chối ${supplier.name}`}
                        icon="close"
                        tone="danger"
                        disabled={!canManage || processingId === supplier.id}
                        onClick={() => void handleReject(supplier)}
                    />
                </div>
            ),
        },
    ];

    return (
        <div className="space-y-8">
            <AdminPageHeader
                title="Yêu cầu đăng ký Nhà cung cấp"
                description="Xét duyệt hồ sơ Nhà cung cấp tự đăng ký trên storefront (UC 2.2.12b)."
            />

            <section className="grid gap-6 xl:grid-cols-3">
                <StatCard
                    metric={{
                        id: "supplier-applications-pending",
                        label: "Đang chờ duyệt",
                        value: `${applications.length}`,
                        tone: "primary",
                        icon: "hourglass_top",
                        delta: "Yêu cầu status = PENDING",
                    }}
                />
            </section>

            <SurfaceCard className="space-y-5">
                {!canManage ? (
                    <p className="rounded-2xl bg-surface-container-low p-4 text-sm text-on-surface-variant">
                        Bạn chưa có quyền duyệt Nhà cung cấp.
                    </p>
                ) : null}
                {error ? <p className="text-sm text-error">{error}</p> : null}
                <DataTable
                    rows={applications}
                    columns={columns}
                    getRowKey={(supplier) => String(supplier.id)}
                    isLoading={isLoading}
                    emptyMessage="Không có yêu cầu đăng ký nào đang chờ duyệt."
                    minWidth="960px"
                    pagination={{ pageSize: 8, itemLabel: "yêu cầu" }}
                />
            </SurfaceCard>
        </div>
    );
}
