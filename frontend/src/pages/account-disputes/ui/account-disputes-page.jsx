import { useEffect, useState } from "react";
import { useAccountStore } from "@/shared/lib/store/use-account-store";
import { useCustomerOrdersStore } from "@/shared/lib/store/use-customer-orders-store";
import { useFeedbackStore } from "@/shared/lib/store/use-feedback-store";
import { Button, SurfaceCard } from "@/shared/ui";

const COMPLAINT_REASONS = [
    "Sản phẩm bị hư hỏng",
    "Giao sai sản phẩm",
    "Thiếu sản phẩm trong đơn",
    "Sản phẩm không đúng mô tả",
    "Giao hàng chậm",
    "Lý do khác",
];

const statusLabels = {
    OPEN: "Đang chờ xử lý",
    IN_PROGRESS: "Đang xử lý",
    RESOLVED: "Đã xử lý",
    REJECTED: "Từ chối",
};

export function AccountDisputesPage() {
    const complaints = useAccountStore((state) => state.complaints);
    const loadComplaints = useAccountStore((state) => state.loadComplaints);
    const createComplaint = useAccountStore((state) => state.createComplaint);
    const isComplaintsLoading = useAccountStore((state) => state.isComplaintsLoading);
    const orders = useCustomerOrdersStore((state) => state.orders);
    const loadOrders = useCustomerOrdersStore((state) => state.loadOrders);
    const pushToast = useFeedbackStore((state) => state.pushToast);

    const [orderId, setOrderId] = useState("");
    const [reason, setReason] = useState(COMPLAINT_REASONS[0]);
    const [content, setContent] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        void loadComplaints();
        void loadOrders();
    }, [loadComplaints, loadOrders]);

    async function handleSubmit(event) {
        event.preventDefault();
        if (!content.trim()) {
            setError("Vui lòng mô tả chi tiết vấn đề bạn gặp phải.");
            return;
        }
        setError("");
        setIsSubmitting(true);
        const result = await createComplaint({
            orderId: orderId || "",
            productId: "",
            reason,
            content: content.trim(),
            imageUrl: "",
        });
        setIsSubmitting(false);
        if (!result.success) {
            setError(result.error ?? "Không thể gửi khiếu nại lúc này.");
            return;
        }
        setContent("");
        setOrderId("");
        setReason(COMPLAINT_REASONS[0]);
        pushToast({ tone: "success", message: "Đã gửi khiếu nại. Đội ngũ hỗ trợ sẽ phản hồi sớm." });
    }

    return (
        <div className="mx-auto max-w-5xl px-6 pb-16 pt-24">
            <div className="space-y-8">
                <div>
                    <h1 className="font-headline text-2xl font-bold">Khiếu nại và hỗ trợ đơn hàng</h1>
                    <p className="mt-2 text-on-surface-variant">
                        Gửi phản hồi về đơn hàng và theo dõi tình trạng xử lý.
                    </p>
                </div>

                <SurfaceCard className="space-y-4">
                    <h2 className="font-headline text-xl font-bold">Gửi khiếu nại mới</h2>
                    <form className="space-y-4" onSubmit={handleSubmit}>
                        <div className="grid gap-4 md:grid-cols-2">
                            <label className="block space-y-2 text-sm">
                                <span className="font-medium text-on-surface">Đơn hàng liên quan (tùy chọn)</span>
                                <select
                                    className="w-full rounded-2xl bg-surface-container-highest px-4 py-3 text-sm outline-none"
                                    value={orderId}
                                    onChange={(event) => setOrderId(event.target.value)}
                                >
                                    <option value="">Không gắn đơn cụ thể</option>
                                    {orders.map((order) => (
                                        <option key={order.id} value={order.id}>
                                            {order.orderNo}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <label className="block space-y-2 text-sm">
                                <span className="font-medium text-on-surface">Lý do</span>
                                <select
                                    className="w-full rounded-2xl bg-surface-container-highest px-4 py-3 text-sm outline-none"
                                    value={reason}
                                    onChange={(event) => setReason(event.target.value)}
                                >
                                    {COMPLAINT_REASONS.map((item) => (
                                        <option key={item} value={item}>{item}</option>
                                    ))}
                                </select>
                            </label>
                        </div>
                        <label className="block space-y-2 text-sm">
                            <span className="font-medium text-on-surface">Mô tả chi tiết</span>
                            <textarea
                                className="min-h-28 w-full rounded-2xl bg-surface-container-highest px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/15"
                                placeholder="Mô tả cụ thể vấn đề bạn gặp phải..."
                                value={content}
                                onChange={(event) => setContent(event.target.value)}
                            />
                        </label>
                        {error ? <p className="text-sm text-error">{error}</p> : null}
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? "Đang gửi..." : "Gửi khiếu nại"}
                        </Button>
                    </form>
                </SurfaceCard>

                <div className="space-y-4">
                    <h2 className="font-headline text-xl font-bold">Khiếu nại đã gửi</h2>
                    {isComplaintsLoading ? (
                        <SurfaceCard className="text-sm text-on-surface-variant">
                            Đang tải danh sách khiếu nại...
                        </SurfaceCard>
                    ) : complaints.length === 0 ? (
                        <SurfaceCard className="text-sm text-on-surface-variant">
                            Chưa có khiếu nại nào được gửi.
                        </SurfaceCard>
                    ) : (
                        complaints.map((complaint) => (
                            <SurfaceCard key={complaint.id} className="space-y-3">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div>
                                        <p className="text-xs uppercase tracking-widest text-primary">
                                            Khiếu nại #{complaint.id}
                                        </p>
                                        <h3 className="mt-2 font-headline text-xl font-bold">{complaint.reason}</h3>
                                    </div>
                                    <span className="rounded-full bg-tertiary/10 px-3 py-1 text-xs uppercase tracking-widest text-tertiary">
                                        {statusLabels[complaint.status] ?? complaint.status}
                                    </span>
                                </div>
                                <p className="text-sm leading-7 text-on-surface-variant">{complaint.content}</p>
                                <div className="grid gap-3 md:grid-cols-3">
                                    <div className="rounded-3xl bg-surface-container-low p-4 text-sm">
                                        <p className="text-on-surface-variant">Mã đơn</p>
                                        <p className="mt-2 font-semibold">{complaint.orderNo || complaint.orderId || "—"}</p>
                                    </div>
                                    <div className="rounded-3xl bg-surface-container-low p-4 text-sm">
                                        <p className="text-on-surface-variant">Sản phẩm</p>
                                        <p className="mt-2 font-semibold">{complaint.productName || "Không rõ"}</p>
                                    </div>
                                    <div className="rounded-3xl bg-surface-container-low p-4 text-sm">
                                        <p className="text-on-surface-variant">Tổng đơn</p>
                                        <p className="mt-2 font-semibold">
                                            {complaint.orderTotalAmount.toLocaleString("vi-VN")} đ
                                        </p>
                                    </div>
                                </div>
                                {complaint.resolutionNote ? (
                                    <div className="rounded-3xl bg-primary/5 p-4 text-sm text-primary">
                                        Phản hồi từ hệ thống: {complaint.resolutionNote}
                                    </div>
                                ) : null}
                            </SurfaceCard>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
