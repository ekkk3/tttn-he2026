import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { apiRequest } from "@/shared/api/backend-client";
import { routes } from "@/shared/config/routes";
import { Badge, ButtonLink, SurfaceCard } from "@/shared/ui";

// Trang khách quay về từ cổng thanh toán (VNPay/MoMo) — UC 2.2.9.
// Chuyển toàn bộ query (vnp_*/... ) lên backend để xác minh chữ ký + cập nhật trạng thái,
// rồi hiện kết quả. Backend mới là nơi cập nhật DB (idempotent), FE chỉ hiển thị.
export function PaymentResultPage({ gateway }) {
    const location = useLocation();
    const [state, setState] = useState({ status: "loading" });
    // calledRef (không phải state) đảm bảo verify() chỉ gọi ĐÚNG 1 LẦN dù React.StrictMode
    // (dev) cố tình chạy effect 2 lần để phát hiện side-effect không an toàn — gọi API xác
    // minh 2 lần tuy backend xử lý idempotent nên không hỏng dữ liệu, nhưng gây lãng phí request.
    const calledRef = useRef(false);

    useEffect(() => {
        if (calledRef.current) {
            return;
        }
        calledRef.current = true;
        async function verify() {
            try {
                const response = await apiRequest(`/payments/${gateway}/return${location.search}`);
                const data = response?.data ?? {};
                setState({
                    status: data.success ? "success" : "failed",
                    orderId: data.order_id ?? null,
                    message: data.message ?? "",
                });
            }
            catch (error) {
                setState({
                    status: "failed",
                    orderId: null,
                    message: error instanceof Error ? error.message : "Không xác minh được kết quả thanh toán.",
                });
            }
        }
        void verify();
    }, [gateway, location.search]);

    const gatewayName = gateway === "vnpay" ? "VNPay" : "MoMo";

    if (state.status === "loading") {
        return (<div className="mx-auto max-w-3xl px-6 pb-16 pt-24">
                <div className="rounded-3xl bg-surface-container-low p-8 text-center text-on-surface-variant">
                    Đang xác minh kết quả thanh toán {gatewayName}...
                </div>
            </div>);
    }

    const isSuccess = state.status === "success";
    return (<div className="mx-auto max-w-3xl px-6 pb-16 pt-24">
            <SurfaceCard className="space-y-6 text-center">
                <div className="flex justify-center">
                    <Badge tone={isSuccess ? "success" : "danger"}>
                        {isSuccess ? "Thanh toán thành công" : "Thanh toán không thành công"}
                    </Badge>
                </div>
                <h1 className="font-headline text-3xl font-bold tracking-tight text-on-surface">
                    {isSuccess ? `Đã thanh toán qua ${gatewayName}` : `Thanh toán ${gatewayName} bị hủy/thất bại`}
                </h1>
                <p className="mx-auto max-w-xl text-base leading-7 text-on-surface-variant">
                    {state.message ||
            (isSuccess
                ? "Cảm ơn bạn, đơn hàng đã được thanh toán và chuyển sang xử lý."
                : "Bạn có thể thử lại hoặc chọn phương thức thanh toán khác.")}
                </p>
                <div className="flex flex-wrap justify-center gap-3">
                    {state.orderId ? (<ButtonLink to={routes.accountOrderDetail(state.orderId)}>Xem đơn hàng</ButtonLink>) : null}
                    <ButtonLink to={routes.products} variant="secondary">
                        Tiếp tục mua sắm
                    </ButtonLink>
                </div>
            </SurfaceCard>
        </div>);
}
