// Truoc dot sua nay, don COD sau khi giao xong VAN GIU payment_status=PENDING mai mai cho
// toi khi Admin tu tay bam "Da thanh toan" - dung nhu hạn chế đã ghi trong báo cáo (mục 4).
// paymentService.js#markCodOrderPaidIfDelivered() duoc goi tu 3 diem co the dua don sang
// DELIVERED (admin doi tung don, admin doi hang loat, nhan vien kho cap nhat giao hang) +
// 1 diem khach tu xac nhan da nhan hang - test nay khoa lai ca 4 truong hop, cong 1 truong
// hop am (don khong phai COD thi KHONG duoc tu dong doi payment_status).
import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import app from '../../app.js';
import { authHeader, createAdmin, createCustomer, createOrder, createWarehouseStaff } from '../helpers.js';
import { query } from '../../config/db.js';

async function paymentStatusOf(orderId) {
  const [payment] = await query('SELECT payment_status, paid_at FROM payments WHERE order_id = ?', [orderId]);
  return payment;
}

describe('Đơn COD tự động chuyển payment_status sang SUCCESS khi giao thành công', () => {
  let admin;
  let warehouse;

  beforeAll(async () => {
    admin = await createAdmin();
    warehouse = await createWarehouseStaff();
  });

  it('khách tự xác nhận đã nhận hàng (PATCH /orders/:order/confirm-delivery)', async () => {
    const customer = await createCustomer();
    const order = await createOrder({ userId: customer.id, status: 'SHIPPED', paymentMethod: 'COD' });

    const res = await request(app)
      .patch(`/api/orders/${order.id}/confirm-delivery`)
      .set(authHeader(customer.token));
    expect(res.status).toBe(200);

    const payment = await paymentStatusOf(order.id);
    expect(payment.payment_status).toBe('SUCCESS');
    expect(payment.paid_at).not.toBeNull();
  });

  it('Admin chuyển đơn sang DELIVERED (PATCH /admin/orders/:order/status)', async () => {
    const customer = await createCustomer();
    const order = await createOrder({ userId: customer.id, status: 'SHIPPED', paymentMethod: 'COD' });

    const res = await request(app)
      .patch(`/api/admin/orders/${order.id}/status`)
      .set(authHeader(admin.token))
      .send({ status: 'DELIVERED' });
    expect(res.status).toBe(200);

    const payment = await paymentStatusOf(order.id);
    expect(payment.payment_status).toBe('SUCCESS');
  });

  it('Admin chuyển hàng loạt sang DELIVERED (POST /admin/orders/bulk-status)', async () => {
    const customer = await createCustomer();
    const order = await createOrder({ userId: customer.id, status: 'SHIPPED', paymentMethod: 'COD' });

    const res = await request(app)
      .post('/api/admin/orders/bulk-status')
      .set(authHeader(admin.token))
      .send({ orderIds: [order.id], status: 'DELIVERED' });
    expect(res.status).toBe(200);

    const payment = await paymentStatusOf(order.id);
    expect(payment.payment_status).toBe('SUCCESS');
  });

  it('Nhân viên kho cập nhật giao hàng (PATCH /operations/orders/:order/delivery-status)', async () => {
    const customer = await createCustomer();
    const order = await createOrder({ userId: customer.id, status: 'SHIPPED', paymentMethod: 'COD' });

    const res = await request(app)
      .patch(`/api/operations/orders/${order.id}/delivery-status`)
      .set(authHeader(warehouse.token))
      .send({ delivery_status: 'DELIVERED' });
    expect(res.status).toBe(200);

    const payment = await paymentStatusOf(order.id);
    expect(payment.payment_status).toBe('SUCCESS');
  });

  it('đơn KHÔNG phải COD (VNPAY) thì KHÔNG tự đổi payment_status khi giao xong', async () => {
    const customer = await createCustomer();
    const order = await createOrder({ userId: customer.id, status: 'SHIPPED', paymentMethod: 'VNPAY', paymentStatus: 'PENDING' });

    const res = await request(app)
      .patch(`/api/admin/orders/${order.id}/status`)
      .set(authHeader(admin.token))
      .send({ status: 'DELIVERED' });
    expect(res.status).toBe(200);

    const payment = await paymentStatusOf(order.id);
    expect(payment.payment_status).toBe('PENDING');
  });

  it('đơn COD đã thanh toán SUCCESS từ trước (Admin đã tự bấm tay) thì không bị đổi/ghi đè lại', async () => {
    const customer = await createCustomer();
    const order = await createOrder({ userId: customer.id, status: 'SHIPPED', paymentMethod: 'COD', paymentStatus: 'SUCCESS' });

    const res = await request(app)
      .patch(`/api/admin/orders/${order.id}/status`)
      .set(authHeader(admin.token))
      .send({ status: 'DELIVERED' });
    expect(res.status).toBe(200);

    const historyCountRows = await query('SELECT COUNT(*) AS c FROM payment_status_history WHERE order_id = ?', [order.id]);
    expect(Number(historyCountRows[0].c)).toBe(0);
  });
});
