// State machine dùng chung cho trạng thái đơn hàng / thanh toán (UC 2.2.17 Quản lý đơn hàng).
// Nguồn duy nhất để các controller (admin/orders.controller.js, và sau này orderController.js
// nếu cần validate) cùng tham chiếu thay vì định nghĩa lại rải rác.
// Đọc bảng này như sau: key = trạng thái HIỆN TẠI, value = mảng trạng thái ĐƯỢC PHÉP
// chuyển tới tiếp theo. Mảng rỗng ([]) nghĩa là trạng thái cuối (terminal), không đi tiếp được.
// Nơi gọi (vd operationController.js) kiểm tra `ORDER_TRANSITIONS[status].includes(next)`
// trước khi cho phép cập nhật, để không ai gán bừa 1 chuỗi tùy ý vào cột orders.status.
export const ORDER_TRANSITIONS = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  AWAITING_PAYMENT_CONFIRMATION: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PACKED', 'CANCELLED'],
  PACKED: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED', 'DELIVERY_FAILED'],
  DELIVERY_FAILED: ['SHIPPED', 'CANCELLED'],
  DELIVERED: [],
  CANCELLED: [],
};

export const PAYMENT_TRANSITIONS = {
  PENDING: ['SUCCESS', 'FAILED'],
  FAILED: ['PENDING', 'SUCCESS'],
  SUCCESS: ['REFUNDED'],
  REFUNDED: [],
};
