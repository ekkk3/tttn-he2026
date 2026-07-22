// State machine dung chung cho trang thai don hang / thanh toan (UC 2.2.17 Quan ly don hang).
// Nguon duy nhat de cac controller (admin/orders.controller.js, va sau nay orderController.js
// neu can validate) cung tham chieu thay vi dinh nghia lai rai rac.
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
