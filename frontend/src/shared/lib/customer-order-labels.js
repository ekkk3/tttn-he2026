export const customerOrderStatusLabels = {
    PENDING: "Chờ xác nhận",
    AWAITING_PAYMENT_CONFIRMATION: "Chờ xác nhận chuyển khoản",
    CONFIRMED: "Đã xác nhận",
    PACKED: "Đã đóng gói",
    SHIPPED: "Đang giao",
    DELIVERED: "Đã giao",
    DELIVERY_FAILED: "Giao thất bại",
    CANCELLED: "Đã hủy",
};
export const customerPaymentStatusLabels = {
    PENDING: "Chờ thanh toán",
    SUCCESS: "Thanh toán thành công",
    FAILED: "Thanh toán thất bại",
    REFUNDED: "Đã hoàn tiền",
    CANCELLED: "Đã hủy",
};
export const customerPaymentMethodLabels = {
    COD: "Thanh toán khi nhận hàng",
    CREDIT_CARD: "Thẻ ngân hàng",
    BANK_TRANSFER: "Chuyển khoản ngân hàng",
};
// Dùng khi 1 giá trị status từ backend KHÔNG có trong 3 bảng nhãn phía trên (vd backend
// thêm status mới mà frontend chưa kịp cập nhật) — tự chuyển "SOME_STATUS" thành "Some status"
// để vẫn hiển thị được thứ gì đó dễ đọc thay vì crash hoặc hiện nguyên chuỗi hoa in.
export function fallbackBackendLabel(value) {
    return value
        .toLowerCase()
        .replace(/_/g, " ")
        .replace(/(^|\s)\S/g, (segment) => segment.toUpperCase());
}
