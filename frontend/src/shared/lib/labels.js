// Key của 3 nhóm nhãn dưới đây (payment/delivery/fulfillment) dùng đúng chuỗi CHỮ HOA mà
// backend lưu thật (xem ORDER_TRANSITIONS/PAYMENT_TRANSITIONS trong
// backend/services/orderTransitions.js) — KHÔNG được tự đổi sang chữ thường/từ khác, vì
// đây chính là bug đã từng khiến badge trạng thái hiện trống (đã sửa). inventoryHealthLabels
// dùng key có gạch ngang vì bám theo inventoryStatus() ở operationController.js. Các nhóm
// còn lại (stockStatusLabels, requisitionStatusLabels) đã đúng từ trước vì đó là 2 khái niệm
// được TÍNH RIÊNG ở phía frontend/1 nơi khác, không liên quan tới enum ở trên.
export const paymentStatusLabels = {
    PENDING: "Chờ thanh toán",
    SUCCESS: "Đã thanh toán",
    FAILED: "Thanh toán thất bại",
    REFUNDED: "Đã hoàn tiền",
};
export const deliveryStatusLabels = {
    PENDING: "Chờ xác nhận",
    AWAITING_PAYMENT_CONFIRMATION: "Chờ xác nhận chuyển khoản",
    CONFIRMED: "Đang xử lý",
    PACKED: "Sẵn sàng giao",
    SHIPPED: "Đang vận chuyển",
    DELIVERY_FAILED: "Giao thất bại",
    DELIVERED: "Đã giao",
    CANCELLED: "Đã hủy",
};
export const shippingTierLabels = {
    standard: "Tiêu chuẩn",
    free: "Miễn phí",
};
export const stockStatusLabels = {
    "in-stock": "Còn hàng",
    "low-stock": "Sắp hết",
    preorder: "Đặt trước",
};
export const inventoryHealthLabels = {
    "in-stock": "Ổn định",
    "low-stock": "Cảnh báo",
    "out-of-stock": "Khẩn cấp",
};
export const requisitionStatusLabels = {
    draft: "Nháp",
    submitted: "Đã gửi",
    approved: "Đã duyệt",
    received: "Đã nhận",
    cancelled: "Đã hủy",
};
export const fulfillmentStatusLabels = {
    CONFIRMED: "Đang lấy hàng",
    PACKED: "Chờ đơn vị vận chuyển",
    SHIPPED: "Đã gửi hàng",
};
export const customerStatusLabels = {
    loyal: "Thân thiết",
    new: "Mới",
    "at-risk": "Cần chăm sóc",
};
export const supplierStatusLabels = {
    active: "Đang hợp tác",
    reviewing: "Đang đánh giá",
};
