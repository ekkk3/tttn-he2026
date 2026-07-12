import { useEffect, useState } from "react";
import { apiRequest } from "@/shared/api/backend-client";
import { hasAdminPermission } from "@/shared/lib/auth";
import { useAuthStore } from "@/shared/lib/store/use-auth-store";
import { useFeedbackStore } from "@/shared/lib/store/use-feedback-store";
import { AdminPageHeader, Badge, Button, Icon, StatCard, SurfaceCard } from "@/shared/ui";

const statusTone = (status) => (status === "VISIBLE" ? "success" : "danger");
const statusLabel = (status) => (status === "VISIBLE" ? "Hiển thị" : "Đã ẩn");

export function AdminReviewsPage() {
    const accessToken = useAuthStore((state) => state.accessToken);
    const user = useAuthStore((state) => state.session?.user ?? null);
    const pushToast = useFeedbackStore((state) => state.pushToast);
    const canManage = hasAdminPermission(user, "admin.reviews.moderate");

    const [reviews, setReviews] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const [processingId, setProcessingId] = useState(null);

    async function loadReviews() {
        if (!accessToken) return;
        setIsLoading(true);
        setError("");
        try {
            const response = await apiRequest("/admin/reviews", { token: accessToken });
            setReviews(response.data ?? []);
        } catch (loadError) {
            setError(loadError instanceof Error ? loadError.message : "Không thể tải đánh giá.");
        } finally {
            setIsLoading(false);
        }
    }

    useEffect(() => {
        void loadReviews();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [accessToken]);

    async function moderate(review, status) {
        if (!accessToken) return;
        setProcessingId(review.id);
        try {
            await apiRequest(`/admin/reviews/${review.id}/moderate`, {
                method: "PATCH",
                token: accessToken,
                body: { status },
            });
            pushToast({ tone: "success", message: `Đã ${status === "HIDDEN" ? "ẩn" : "hiển thị"} đánh giá #${review.id}.` });
            await loadReviews();
        } catch (actionError) {
            pushToast({
                tone: "warning",
                message: actionError instanceof Error ? actionError.message : "Không thể cập nhật đánh giá.",
            });
        } finally {
            setProcessingId(null);
        }
    }

    const hiddenCount = reviews.filter((r) => r.status === "HIDDEN").length;

    return (
        <div className="space-y-8">
            <AdminPageHeader
                title="Kiểm duyệt đánh giá"
                description="Ẩn/hiện đánh giá sản phẩm để chống spam (UC 2.2.10a)."
            />

            <section className="grid gap-6 xl:grid-cols-3">
                <StatCard metric={{ id: "reviews-total", label: "Tổng đánh giá", value: `${reviews.length}`, tone: "primary", icon: "reviews", delta: "Tất cả sản phẩm" }} />
                <StatCard metric={{ id: "reviews-hidden", label: "Đã ẩn", value: `${hiddenCount}`, tone: "secondary", icon: "visibility_off", delta: "Bị kiểm duyệt" }} />
            </section>

            <SurfaceCard className="space-y-4">
                {!canManage ? (
                    <p className="rounded-2xl bg-surface-container-low p-4 text-sm text-on-surface-variant">
                        Bạn chưa có quyền kiểm duyệt đánh giá.
                    </p>
                ) : null}
                {error ? <p className="text-sm text-error">{error}</p> : null}
                {isLoading ? (
                    <p className="text-sm text-on-surface-variant">Đang tải đánh giá...</p>
                ) : reviews.length === 0 ? (
                    <p className="rounded-2xl bg-surface-container-low p-4 text-sm text-on-surface-variant">Chưa có đánh giá nào.</p>
                ) : (
                    reviews.map((review) => (
                        <div key={review.id} className="space-y-2 rounded-2xl border border-outline-variant/15 bg-surface-container-low p-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <p className="font-semibold text-on-surface">{review.product?.name ?? `SP #${review.product_id}`}</p>
                                        <div className="flex items-center text-tertiary">
                                            {Array.from({ length: review.rating }).map((_, index) => (
                                                <Icon key={index} name="star" className="text-sm" fill />
                                            ))}
                                        </div>
                                        <Badge tone={statusTone(review.status)}>{statusLabel(review.status)}</Badge>
                                    </div>
                                    <p className="mt-1 text-sm text-on-surface-variant">{review.comment}</p>
                                    <p className="mt-1 text-xs text-on-surface-variant">Bởi {review.user?.full_name ?? "Khách hàng"}</p>
                                </div>
                                <div className="flex gap-2">
                                    {review.status === "VISIBLE" ? (
                                        <Button size="sm" variant="outline" disabled={!canManage || processingId === review.id} onClick={() => void moderate(review, "HIDDEN")}>
                                            Ẩn
                                        </Button>
                                    ) : (
                                        <Button size="sm" variant="secondary" disabled={!canManage || processingId === review.id} onClick={() => void moderate(review, "VISIBLE")}>
                                            Hiển thị lại
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </SurfaceCard>
        </div>
    );
}
