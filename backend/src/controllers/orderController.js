import { query, pool } from '../config/db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { buildVnpayUrl } from '../utils/vnpay.js';
import { createMomoPayment } from '../utils/momo.js';

function generateOrderNo() {
  return `DH${Date.now()}`;
}

// POST /api/orders/checkout
// Ghi chu: 'voucher_code' hien khong co bang tuong ung trong schema Laravel goc.
// Da them file sql/add_vouchers.sql (bang vouchers + order_vouchers) — chay migration do
// truoc, roi bo comment doan tinh discount_amount ben duoi neu muon dung.
export const checkout = asyncHandler(async (req, res) => {
  const { recipient_name, recipient_phone, shipping_address, payment_method, note } = req.body;

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [[cart]] = await connection.query(
      "SELECT * FROM carts WHERE user_id = ? AND status = 'ACTIVE' LIMIT 1",
      [req.user.id]
    );
    if (!cart) throw Object.assign(new Error('Gio hang dang trong.'), { status: 422 });

    const [items] = await connection.query('SELECT * FROM cart_items WHERE cart_id = ?', [cart.id]);
    if (!items.length) throw Object.assign(new Error('Gio hang dang trong.'), { status: 422 });

    const subtotal = items.reduce((sum, i) => sum + Number(i.line_total), 0);
    const shipping_fee = 30000; // TODO: thay bang phi thuc te tinh qua GHN (xem utils/ghn.js)
    const discount_amount = 0; // TODO: tinh tu vouchers sau khi chay sql/add_vouchers.sql
    const total_amount = subtotal + shipping_fee - discount_amount;

    const [orderResult] = await connection.query(
      `INSERT INTO orders (user_id, order_no, recipient_name, recipient_phone, shipping_address,
        payment_method, status, subtotal, shipping_fee, discount_amount, total_amount, note)
       VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?, ?, ?, ?, ?)`,
      [req.user.id, generateOrderNo(), recipient_name, recipient_phone, shipping_address,
        payment_method, subtotal, shipping_fee, discount_amount, total_amount, note || null]
    );
    const orderId = orderResult.insertId;

    for (const item of items) {
      await connection.query(
        `INSERT INTO order_items (order_id, product_id, product_name_snapshot, quantity, unit_price, line_total)
         SELECT ?, ?, name, ?, ?, ? FROM products WHERE id = ?`,
        [orderId, item.product_id, item.quantity, item.unit_price, item.line_total, item.product_id]
      );
    }

    await connection.query('DELETE FROM cart_items WHERE cart_id = ?', [cart.id]);
    await connection.query("UPDATE carts SET status = 'CHECKED_OUT' WHERE id = ?", [cart.id]);
    await connection.query(
      "INSERT INTO order_status_history (order_id, to_status, note) VALUES (?, 'PENDING', 'Order created')",
      [orderId]
    );

    await connection.commit();

    let paymentRedirectUrl = null;
    if (payment_method === 'VNPAY') {
      paymentRedirectUrl = buildVnpayUrl({ orderId, amount: total_amount, ipAddr: req.ip });
    } else if (payment_method === 'MOMO') {
      paymentRedirectUrl = await createMomoPayment({ orderId, amount: total_amount });
    }

    res.status(201).json({ order_id: orderId, total_amount, payment_redirect_url: paymentRedirectUrl });
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
});

export const index = asyncHandler(async (req, res) => {
  const rows = await query('SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC', [req.user.id]);
  res.json({ orders: rows });
});

export const show = asyncHandler(async (req, res) => {
  const [order] = await query('SELECT * FROM orders WHERE id = ? AND user_id = ?', [req.params.order, req.user.id]);
  if (!order) return res.status(404).json({ message: 'Khong tim thay don hang.' });
  const items = await query('SELECT * FROM order_items WHERE order_id = ?', [order.id]);
  res.json({ order: { ...order, items } });
});

export const cancel = asyncHandler(async (req, res) => {
  await query("UPDATE orders SET status = 'CANCELLED', cancelled_at = NOW() WHERE id = ? AND user_id = ?", [
    req.params.order, req.user.id,
  ]);
  await query(
    "INSERT INTO order_status_history (order_id, to_status, note) VALUES (?, 'CANCELLED', 'Cancelled by customer')",
    [req.params.order]
  );
  res.json({ message: 'Da huy don hang.' });
});

export const confirmBankTransferSubmitted = asyncHandler(async (req, res) => {
  await query("UPDATE orders SET status = 'AWAITING_PAYMENT_CONFIRMATION' WHERE id = ? AND user_id = ?", [
    req.params.order, req.user.id,
  ]);
  res.json({ message: 'Da bao da chuyen khoan, cho xac nhan.' });
});

export const confirmDelivery = asyncHandler(async (req, res) => {
  await query("UPDATE orders SET status = 'DELIVERED', delivered_at = NOW() WHERE id = ? AND user_id = ?", [
    req.params.order, req.user.id,
  ]);
  res.json({ message: 'Da xac nhan giao hang thanh cong.' });
});
