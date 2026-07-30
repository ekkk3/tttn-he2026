import { useEffect, useState } from "react";
import { apiRequest } from "@/shared/api/backend-client";
import { hasAdminPermission } from "@/shared/lib/auth";
import { formatCurrency } from "@/shared/lib/format";
import { useAuthStore } from "@/shared/lib/store/use-auth-store";
import { useFeedbackStore } from "@/shared/lib/store/use-feedback-store";
import { AdminPageHeader, Badge, Button, StatCard, SurfaceCard } from "@/shared/ui";

const statusTone = (status) =>
    ["RESOLVED", "REFUNDED", "REPLACED"].includes(status) ? "success" : status === "REJECTED" ? "danger" : "warning";
const statusLabel = (status) =>
    ({
        OPEN: "Đang chờ",
        IN_PROGRESS: "Đang xử lý",
        RESOLVED: "Đã xử lý",
        REFUNDED: "Đã hoàn tiền",
        REPLACED: "Đã đổi sản phẩm",
        REJECTED: "Từ chối",
    }[status] ?? status);

export function AdminComplaintsPage() {
    const accessToken = useAuthStore((state) => state.accessToken);
    const user = useAuthStore((state) => state.session?.user ?? null);
    const pushToast = useFeedbackStore((state) => state.pushToast);
    const canManage = hasAdminPermission(user, "admin.complaints.manage");

    const [complaints, setComplaints] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const [notes, setNotes] = useState({});
    const [processingId, setProcessingId] = useState(null);

    async function loadComplaints() {
        if (!accessToken) return;
        setIsLoading(true);
        setError("");
        try {
            const response = await apiRequest("/admin/complaints", { token: accessToken });
            setComplaints(response.data ?? []);
        } catch (loadError) {
            setError(loadError instanceof Error ? loadError.message : "Không thể tải danh sách khiếu nại.");
        } finally {
            setIsLoading(false);
        }
    }

    useEffect(() => {
        void loadComplaints();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [accessToken]);

    async function resolve(complaint, action) {
        if (!accessToken) return;
        setProcessingId(complaint.id);
        try {
            await apiRequest(`/admin/complaints/${complaint.id}/resolve`, {
                method: "PATCH",
                token: accessToken,
                body: { action, resolution_note: notes[complaint.id]?.trim() || undefined },
            });
            pushToast({ tone: "success", message: `Đã cập nhật khiếu nại #${complaint.id}.` });
            await loadComplaints();
        } catch (actionError) {
            pushToast({
                tone: "warning",
                message: actionError instanceof Error ? actionError.message : "Không thể cập nhật khiếu nại.",
            });
        } finally {
            setProcessingId(null);
        }
    }

    const openCount = complaints.filter((c) => c.status === "OPEN").length;

    return (
        <div className="space-y-8">
            <AdminPageHeader
                title="Quản lý khiếu nại"
                description="Tiếp nhận và xử lý khiếu nại của khách hàng (UC 2.2.18)."
            />

            <section className="grid gap-6 xl:grid-cols-3">
                <StatCard metric={{ id: "complaints-total", label: "Tổng khiếu nại", value: `${complaints.length}`, tone: "primary", icon: "gavel", delta: "Tất cả trạng thái" }} />
                <StatCard metric={{ id: "complaints-open", label: "Đang chờ xử lý", value: `${openCount}`, tone: "secondary", icon: "pending_actions", delta: "Cần admin phản hồi" }} />
            </section>

            <SurfaceCard className="space-y-4">
                {!canManage ? (
                    <p className="rounded-2xl bg-surface-container-low p-4 text-sm text-on-surface-variant">
                        Bạn chưa có quyền xử lý khiếu nại.
                    </p>
                ) : null}
                {error ? <p className="text-sm text-error">{error}</p> : null}
                {isLoading ? (
                    <p className="text-sm text-on-surface-variant">Đang tải khiếu nại...</p>
                ) : complaints.length === 0 ? (
                    <p className="rounded-2xl bg-surface-container-low p-4 text-sm text-on-surface-variant">
                        Chưa có khiếu nại nào.
                    </p>
                ) : (
                    complaints.map((complaint) => (
                        <div key={complaint.id} className="space-y-3 rounded-2xl border border-outline-variant/15 bg-surface-container-low p-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <p className="font-semibold text-on-surface">Khiếu nại #{complaint.id}: {complaint.reason}</p>
                                        <Badge tone={statusTone(complaint.status)}>{statusLabel(complaint.status)}</Badge>
                                    </div>
                                    <p className="mt-1 text-sm text-on-surface-variant">{complaint.content}</p>
                                    <p className="mt-2 text-xs text-on-surface-variant">
                                        Đơn: {complaint.order?.order_no ?? "—"}
                                        {complaint.order ? ` · ${formatCurrency(complaint.order.total_amount)}` : ""}
                                        {complaint.product ? ` · SP: ${complaint.product.name}` : ""}
                                    </p>
                                    {complaint.resolution_note ? (
                                        <p className="mt-2 rounded-2xl bg-primary/5 p-3 text-sm text-primary">
                                            Phản hồi: {complaint.resolution_note}
                                            {complaint.resolver ? ` — ${complaint.resolver.full_name}` : ""}
                                        </p>
                                    ) : null}
                                </div>
                            </div>

                            {complaint.status === "OPEN" || complaint.status === "IN_PROGRESS" ? (
                                <div className="space-y-3 border-t border-outline-variant/15 pt-3">
                                    <textarea
                                        className="min-h-20 w-full rounded-2xl bg-surface-container-highest px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/15"
                                        placeholder="Ghi chú xử lý gửi tới khách hàng..."
                                        value={notes[complaint.id] ?? ""}
                                        onChange={(event) => setNotes((current) => ({ ...current, [complaint.id]: event.target.value }))}
                                    />
                                    <div className="flex flex-wrap gap-2">
                                        <Button
                                            size="sm"
                                            disabled={!canManage || processingId === complaint.id || !complaint.order}
                                            title={!complaint.order ? "Khiếu nại này không gắn với đơn hàng nào." : undefined}
                                            onClick={() => void resolve(complaint, "REFUND")}
                                        >
                                            Hoàn tiền
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            disabled={!canManage || processingId === complaint.id}
                                            onClick={() => void resolve(complaint, "REPLACE")}
                                        >
                                            Đổi sản phẩm
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            disabled={!canManage || processingId === complaint.id}
                                            onClick={() => void resolve(complaint, "REJECT")}
                                        >
                                            Từ chối
                                        </Button>
                                    </div>
                                </div>
                            ) : null}
                        </div>
                    ))
                )}
            </SurfaceCard>
        </div>
    );
}
