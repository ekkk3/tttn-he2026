import { query, pool } from '../config/db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { buildVnpayUrl } from '../utils/vnpay.js';
import { createMomoPayment } from '../utils/momo.js';
import { serializeOrderDetail, serializeOrderSummary, paginated, parsePagination } from '../utils/serializers.js';
import { computeVoucherDiscount } from './voucherController.js';
import { notifyUser } from '../services/notificationService.js';

function generateOrderNo() {
  return `DH${Date.now()}`;
}

// Phi van chuyen tinh phia server, giu dong logic voi checkout-page.jsx de tong tien
// hien thi tren UI khop voi don hang thuc te luu trong DB.
function normalizeVietnamese(value) {
  return String(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/đ/g, 'd')
    .replace(/[̀-ͯ]/g, '');
}
function calculateShippingFee(subtotal, shippingAddress) {
  if (subtotal >= 500000) return 0;
  const addr = normalizeVietnamese(shippingAddress);
  if (addr.includes('ha noi')) return 20000;
  const northern = ['ha giang', 'cao bang', 'bac kan', 'tuyen quang', 'lao cai', 'yen bai', 'thai nguyen',
    'lang son', 'quang ninh', 'bac giang', 'phu tho', 'vinh phuc', 'bac ninh', 'hai duong', 'hai phong',
    'hung yen', 'thai binh', 'ha nam', 'nam dinh', 'ninh binh', 'hoa binh', 'son la', 'dien bien', 'lai chau'];
  if (northern.some((k) => addr.includes(k))) return 30000;
  return 45000;
}

// Doc order + items + status_history + payment roi serialize theo dinh dang frontend.
async function loadOrderDetail(orderId, userId = null) {
  const params = userId ? [orderId, userId] : [orderId];
  const [order] = await query(
    `SELECT * FROM orders WHERE id = ?${userId ? ' AND user_id = ?' : ''}`,
    params
  );
  if (!order) return null;
  const items = await query('SELECT * FROM order_items WHERE order_id = ?', [order.id]);
  const statusHistory = await query(
    'SELECT *, created_at AS changed_at FROM order_status_history WHERE order_id = ? ORDER BY id ASC',
    [order.id]
  );
  const [payment] = await query('SELECT * FROM payments WHERE order_id = ? ORDER BY id DESC LIMIT 1', [order.id]);
  return serializeOrderDetail(order, { items, statusHistory, payment: payment || null });
}

// POST /api/orders/checkout
export const checkout = asyncHandler(async (req, res) => {
  const {
    recipient_name, recipient_phone, shipping_address, payment_method = 'COD', payment_gateway, note, voucher_code,
    shipping_province_id, shipping_province_name, shipping_district_id, shipping_district_name,
    shipping_ward_code, shipping_ward_name,
  } = req.body;
  if (!recipient_name || !recipient_phone || !shipping_address) {
    return res.status(422).json({ message: 'Thieu thong tin nguoi nhan hoac dia chi giao hang.' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [[cart]] = await connection.query(
      "SELECT * FROM carts WHERE user_id = ? AND status = 'ACTIVE' LIMIT 1",
      [req.user.id]
    );
    if (!cart) throw Object.assign(new Error('Gio hang dang trong.'), { status: 422 });

    const [items] = await connection.query(
      `SELECT ci.*, p.name AS product_name, p.stock_quantity
       FROM cart_items ci JOIN products p ON p.id = ci.product_id WHERE ci.cart_id = ?`,
      [cart.id]
    );
    if (!items.length) throw Object.assign(new Error('Gio hang dang trong.'), { status: 422 });

    const subtotal = items.reduce((sum, i) => sum + Number(i.line_total), 0);
    const shipping_fee = calculateShippingFee(subtotal, shipping_address);

    // UC 2.2.9a: ap dung voucher neu khach nhap ma hop le.
    let discount_amount = 0;
    let appliedVoucher = null;
    if (voucher_code) {
      const [[voucher]] = await connection.query('SELECT * FROM vouchers WHERE code = ? LIMIT 1', [voucher_code]);
      discount_amount = computeVoucherDiscount(voucher, subtotal); // nem 422 neu khong hop le
      appliedVoucher = voucher;
    }
    const total_amount = subtotal + shipping_fee - discount_amount;
    const orderNo = generateOrderNo();

    const [orderResult] = await connection.query(
      `INSERT INTO orders (user_id, order_no, recipient_name, recipient_phone, shipping_address,
        shipping_province_id, shipping_province_name, shipping_district_id, shipping_district_name,
        shipping_ward_code, shipping_ward_name,
        payment_method, status, subtotal, shipping_fee, discount_amount, total_amount, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?, ?, ?, ?)`,
      [req.user.id, orderNo, recipient_name, recipient_phone, shipping_address,
        shipping_province_id || null, shipping_province_name || null,
        shipping_district_id || null, shipping_district_name || null,
        shipping_ward_code || null, shipping_ward_name || null,
        payment_method, subtotal, shipping_fee, discount_amount, total_amount, note || null]
    );
    const orderId = orderResult.insertId;

    for (const item of items) {
      await connection.query(
        `INSERT INTO order_items (order_id, product_id, product_name_snapshot, quantity, unit_price, line_total)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [orderId, item.product_id, item.product_name, item.quantity, item.unit_price, item.line_total]
      );
      // Tru ton kho + kiem tra du hang trong CUNG 1 cau UPDATE (dieu kien stock_quantity >= ?),
      // dua vao row lock cua InnoDB de tranh race condition: neu chi SELECT roi so sanh truoc,
      // 2 request checkout dong thoi cho cung san pham co the cung "thay" con du hang va cung
      // duoc tao don, dan den ban vuot ton kho thuc te (oversell).
      const [stockResult] = await connection.query(
        'UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ? AND stock_quantity >= ?',
        [item.quantity, item.product_id, item.quantity]
      );
      if (stockResult.affectedRows === 0) {
        throw Object.assign(
          new Error(`San pham "${item.product_name}" khong du ton kho (vua het hang hoac co nguoi khac mua truoc).`),
          { status: 422 }
        );
      }
    }

    // Tao ban ghi thanh toan. BANK_TRANSFER luu huong dan chuyen khoan vao raw_payload
    // (checkout-page.jsx doc payment.raw_payload de hien modal QR + so tai khoan).
    let rawPayload = null;
    if (payment_method === 'BANK_TRANSFER') {
      rawPayload = JSON.stringify({
        bank_name: process.env.BANK_NAME || 'MB Bank',
        account_name: process.env.BANK_ACCOUNT_NAME || 'HERITAGE HARVEST',
        account_number: process.env.BANK_ACCOUNT_NUMBER || '0123456789',
        transfer_content: orderNo,
      });
    }
    await connection.query(
      `INSERT INTO payments (order_id, provider, payment_method, amount, payment_status, gateway_name, raw_payload)
       VALUES (?, ?, ?, ?, 'PENDING', ?, ?)`,
      [orderId, payment_method, payment_method, total_amount, payment_gateway || null, rawPayload]
    );

    // Ghi nhan voucher da dung (UC 2.2.9a) + tang used_count.
    if (appliedVoucher && discount_amount > 0) {
      await connection.query(
        'INSERT INTO order_vouchers (order_id, voucher_id, discount_amount) VALUES (?, ?, ?)',
        [orderId, appliedVoucher.id, discount_amount]
      );
      // Tang used_count co dieu kien lai usage_limit (giong logic tru ton kho o tren):
      // computeVoucherDiscount() da kiem tra usage_limit tu ban ghi doc truoc do, neu 2 don
      // dung chung 1 ma cung luc thi ca 2 co the cung "thay" con luot — kiem tra lai ngay
      // luc UPDATE moi chan duoc vuot usage_limit thuc te.
      const [voucherResult] = await connection.query(
        'UPDATE vouchers SET used_count = used_count + 1 WHERE id = ? AND (usage_limit IS NULL OR used_count < usage_limit)',
        [appliedVoucher.id]
      );
      if (voucherResult.affectedRows === 0) {
        throw Object.assign(new Error('Ma giam gia vua het luot su dung, vui long thu lai.'), { status: 422 });
      }
    }

    await connection.query('DELETE FROM cart_items WHERE cart_id = ?', [cart.id]);
    await connection.query("UPDATE carts SET status = 'CHECKED_OUT' WHERE id = ?", [cart.id]);
    await connection.query(
      "INSERT INTO order_status_history (order_id, to_status, note) VALUES (?, 'PENDING', 'Khach hang dat hang')",
      [orderId]
    );

    await connection.commit();

    // Thong bao "Da dat hang" (UC 2.2.5a).
    await notifyUser(
      req.user.id, 'ORDER_PLACED', 'Dat hang thanh cong',
      `Don hang ${orderNo} da duoc tao va dang cho xu ly.`, `/account/orders/${orderId}`
    );

    // Voucher VNPay/MoMo van hoat dong neu frontend gui payment_method tuong ung (bonus,
    // frontend hien tai chi dung COD + BANK_TRANSFER).
    let paymentRedirectUrl = null;
    if (payment_method === 'VNPAY') {
      paymentRedirectUrl = buildVnpayUrl({ orderId, amount: total_amount, ipAddr: req.ip });
    } else if (payment_method === 'MOMO') {
      paymentRedirectUrl = await createMomoPayment({ orderId, amount: total_amount });
    }

    const detail = await loadOrderDetail(orderId, req.user.id);
    res.status(201).json({ data: { ...detail, payment_redirect_url: paymentRedirectUrl } });
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
});

// GET /api/orders?page=&per_page=
export const index = asyncHandler(async (req, res) => {
  const { page, perPage, offset } = parsePagination(req.query);
  const [{ total }] = await query('SELECT COUNT(*) AS total FROM orders WHERE user_id = ?', [req.user.id]);
  const orders = await query(
    `SELECT o.*, (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) AS item_count
     FROM orders o WHERE o.user_id = ? ORDER BY o.id DESC LIMIT ? OFFSET ?`,
    [req.user.id, perPage, offset]
  );
  const data = [];
  for (const order of orders) {
    const [payment] = await query('SELECT * FROM payments WHERE order_id = ? ORDER BY id DESC LIMIT 1', [order.id]);
    data.push(serializeOrderSummary(order, { itemCount: order.item_count, payment: payment || null }));
  }
  res.json(paginated(data, { page, perPage, total }));
});

export const show = asyncHandler(async (req, res) => {
  const detail = await loadOrderDetail(req.params.order, req.user.id);
  if (!detail) return res.status(404).json({ message: 'Khong tim thay don hang.' });
  res.json({ data: detail });
});

export const cancel = asyncHandler(async (req, res) => {
  const [order] = await query('SELECT * FROM orders WHERE id = ? AND user_id = ?', [req.params.order, req.user.id]);
  if (!order) return res.status(404).json({ message: 'Khong tim thay don hang.' });
  await query("UPDATE orders SET status = 'CANCELLED', cancelled_at = NOW() WHERE id = ?", [order.id]);
  await query(
    "INSERT INTO order_status_history (order_id, from_status, to_status, note, changed_by_user_id) VALUES (?, ?, 'CANCELLED', ?, ?)",
    [order.id, order.status, req.body.reason || 'Khach hang huy don', req.user.id]
  );
  await notifyUser(req.user.id, 'ORDER_CANCELLED', 'Da huy don hang', `Don hang ${order.order_no} da duoc huy.`, `/account/orders/${order.id}`);
  const detail = await loadOrderDetail(order.id, req.user.id);
  res.json({ data: detail });
});

export const confirmBankTransferSubmitted = asyncHandler(async (req, res) => {
  const [order] = await query('SELECT * FROM orders WHERE id = ? AND user_id = ?', [req.params.order, req.user.id]);
  if (!order) return res.status(404).json({ message: 'Khong tim thay don hang.' });
  await query("UPDATE orders SET status = 'AWAITING_PAYMENT_CONFIRMATION' WHERE id = ?", [order.id]);
  await query(
    "INSERT INTO order_status_history (order_id, from_status, to_status, note, changed_by_user_id) VALUES (?, ?, 'AWAITING_PAYMENT_CONFIRMATION', 'Khach bao da chuyen khoan', ?)",
    [order.id, order.status, req.user.id]
  );
  const detail = await loadOrderDetail(order.id, req.user.id);
  res.json({ data: detail });
});

export const confirmDelivery = asyncHandler(async (req, res) => {
  const [order] = await query('SELECT * FROM orders WHERE id = ? AND user_id = ?', [req.params.order, req.user.id]);
  if (!order) return res.status(404).json({ message: 'Khong tim thay don hang.' });
  await query("UPDATE orders SET status = 'DELIVERED', delivered_at = NOW() WHERE id = ?", [order.id]);
  await query(
    "INSERT INTO order_status_history (order_id, from_status, to_status, note, changed_by_user_id) VALUES (?, ?, 'DELIVERED', 'Khach xac nhan da nhan hang', ?)",
    [order.id, order.status, req.user.id]
  );
  const detail = await loadOrderDetail(order.id, req.user.id);
  res.json({ data: detail });
});
