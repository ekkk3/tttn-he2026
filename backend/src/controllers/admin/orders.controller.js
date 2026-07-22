import { query } from '../../config/db.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { serializeOrderDetail, serializeOrderSummary } from '../../utils/serializers.js';
import {
  ghnConfigured, calculateFee, createShippingOrder, getShippingOrderDetail, cancelShippingOrder,
} from '../../utils/ghn.js';
import { ORDER_TRANSITIONS, PAYMENT_TRANSITIONS } from '../../services/orderTransitions.js';
import { notifyUser } from '../../services/notificationService.js';

// ---------------- Orders (admin) — UC 2.2.17 Quan ly don hang ----------------
// Frontend (admin-logistics-page.jsx + use-admin-orders-store.js) doc { data } voi
// customer/payment/shipment long, allowed_next_statuses (state machine),
// allowed_payment_statuses, status_history, payment_status_history.
// ORDER_TRANSITIONS/PAYMENT_TRANSITIONS: xem services/orderTransitions.js (nguon dung chung).

const BULK_ACTION_STATUS = {
  CONFIRM: 'CONFIRMED', SHIP: 'SHIPPED', DELIVER: 'DELIVERED',
  MARK_DELIVERY_FAILED: 'DELIVERY_FAILED', CANCEL: 'CANCELLED', RESHIP: 'SHIPPED',
};

async function notifyOrderUser(order, title, message) {
  await notifyUser(order.user_id, 'ORDER_STATUS', title, message, `/account/orders/${order.id}`);
}

async function loadAdminOrderDetail(orderId) {
  const [order] = await query(
    `SELECT o.*, u.id AS customer_id, u.full_name AS customer_name, u.email AS customer_email
     FROM orders o LEFT JOIN users u ON u.id = o.user_id WHERE o.id = ?`,
    [orderId]
  );
  if (!order) return null;
  const items = await query('SELECT * FROM order_items WHERE order_id = ?', [order.id]);
  const statusHistory = await query(
    'SELECT *, created_at AS changed_at FROM order_status_history WHERE order_id = ? ORDER BY id ASC', [order.id]
  );
  const paymentHistory = await query(
    'SELECT *, created_at AS changed_at FROM payment_status_history WHERE order_id = ? ORDER BY id ASC', [order.id]
  );
  const [payment] = await query('SELECT * FROM payments WHERE order_id = ? ORDER BY id DESC LIMIT 1', [order.id]);
  const [shipment] = await query(
    `SELECT s.*, c.name AS carrier_name, c.provider AS carrier_provider
     FROM order_shipments s LEFT JOIN shipping_carriers c ON c.id = s.shipping_carrier_id
     WHERE s.order_id = ? ORDER BY s.id DESC LIMIT 1`,
    [order.id]
  );
  const base = serializeOrderDetail(order, { items, statusHistory, payment: payment || null });
  return {
    ...base,
    customer: { id: order.customer_id, full_name: order.customer_name, email: order.customer_email },
    shipping_carrier: shipment?.carrier_name ?? null,
    shipping_code: shipment?.tracking_code ?? null,
    shipment: shipment ? {
      id: shipment.id,
      provider: shipment.provider,
      status: shipment.status,
      tracking_code: shipment.tracking_code,
      tracking_url: shipment.tracking_url,
      shipping_fee: shipment.shipping_fee !== null ? Number(shipment.shipping_fee) : null,
      cod_amount: shipment.cod_amount !== null ? Number(shipment.cod_amount) : null,
      synced_at: shipment.synced_at ?? null,
      cancelled_at: shipment.cancelled_at ?? null,
      carrier: shipment.shipping_carrier_id ? { id: shipment.shipping_carrier_id, name: shipment.carrier_name } : null,
    } : null,
    payment_status_history: paymentHistory.map((h) => ({
      id: h.id, from_status: h.from_status, to_status: h.to_status, note: h.note, changed_at: h.changed_at,
    })),
    allowed_next_statuses: ORDER_TRANSITIONS[order.status] ?? [],
    allowed_payment_statuses: PAYMENT_TRANSITIONS[payment?.payment_status ?? 'PENDING'] ?? [],
  };
}

export const listOrders = asyncHandler(async (req, res) => {
  const rows = await query(
    `SELECT o.*, u.full_name AS customer_name, u.email AS customer_email,
            (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) AS item_count
     FROM orders o LEFT JOIN users u ON u.id = o.user_id ORDER BY o.id DESC`
  );
  const data = [];
  for (const o of rows) {
    const [payment] = await query('SELECT * FROM payments WHERE order_id = ? ORDER BY id DESC LIMIT 1', [o.id]);
    const [shipment] = await query(
      'SELECT s.tracking_code, c.name AS carrier_name FROM order_shipments s LEFT JOIN shipping_carriers c ON c.id = s.shipping_carrier_id WHERE s.order_id = ? ORDER BY s.id DESC LIMIT 1',
      [o.id]
    );
    data.push({
      ...serializeOrderSummary(o, { itemCount: o.item_count, payment: payment || null }),
      customer: { id: o.user_id, full_name: o.customer_name, email: o.customer_email },
      shipping_code: shipment?.tracking_code ?? null,
      shipping_carrier: shipment?.carrier_name ?? null,
    });
  }
  res.json({ data });
});

export const showOrder = asyncHandler(async (req, res) => {
  const detail = await loadAdminOrderDetail(req.params.order);
  if (!detail) return res.status(404).json({ message: 'Khong tim thay don hang.' });
  res.json({ data: detail });
});

export const updateOrderStatus = asyncHandler(async (req, res) => {
  const { status, note, restock_inventory } = req.body;
  const [order] = await query('SELECT * FROM orders WHERE id = ?', [req.params.order]);
  if (!order) return res.status(404).json({ message: 'Khong tim thay don hang.' });
  if (!(ORDER_TRANSITIONS[order.status] ?? []).includes(status)) {
    return res.status(422).json({ message: `Khong the chuyen tu ${order.status} sang ${status}.` });
  }
  const sets = ['status = ?'];
  const params = [status];
  if (status === 'SHIPPED') { sets.push('shipped_at = COALESCE(shipped_at, NOW())'); }
  if (status === 'DELIVERED') { sets.push('delivered_at = NOW()'); }
  if (status === 'CANCELLED') { sets.push('cancelled_at = NOW()'); }
  await query(`UPDATE orders SET ${sets.join(', ')} WHERE id = ?`, [...params, order.id]);
  await query(
    'INSERT INTO order_status_history (order_id, from_status, to_status, note, changed_by_user_id) VALUES (?, ?, ?, ?, ?)',
    [order.id, order.status, status, note || null, req.user.id]
  );
  // Hoan kho khi huy don (neu chon restock_inventory) — UC 2.2.17/2.2.21.
  if (status === 'CANCELLED' && restock_inventory) {
    const items = await query('SELECT product_id, quantity FROM order_items WHERE order_id = ?', [order.id]);
    for (const it of items) {
      if (it.product_id) await query('UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?', [it.quantity, it.product_id]);
    }
  }
  await notifyOrderUser(order, 'Cap nhat don hang', `Don ${order.order_no} chuyen sang trang thai ${status}.`);
  res.json({ data: await loadAdminOrderDetail(order.id) });
});

export const updatePaymentStatus = asyncHandler(async (req, res) => {
  const { payment_status, note } = req.body;
  const [order] = await query('SELECT * FROM orders WHERE id = ?', [req.params.order]);
  if (!order) return res.status(404).json({ message: 'Khong tim thay don hang.' });
  const [payment] = await query('SELECT * FROM payments WHERE order_id = ? ORDER BY id DESC LIMIT 1', [order.id]);
  const current = payment?.payment_status ?? 'PENDING';
  if (!(PAYMENT_TRANSITIONS[current] ?? []).includes(payment_status)) {
    return res.status(422).json({ message: `Khong the chuyen thanh toan tu ${current} sang ${payment_status}.` });
  }
  const paidAtSql = payment_status === 'SUCCESS' ? ', paid_at = NOW()' : '';
  await query(`UPDATE payments SET payment_status = ?${paidAtSql} WHERE order_id = ?`, [payment_status, order.id]);
  await query(
    'INSERT INTO payment_status_history (order_id, from_status, to_status, note, changed_by_user_id) VALUES (?, ?, ?, ?, ?)',
    [order.id, current, payment_status, note || null, req.user.id]
  );
  res.json({ data: await loadAdminOrderDetail(order.id) });
});

export const bulkUpdateStatus = asyncHandler(async (req, res) => {
  const { orderIds, order_ids, action, status } = req.body;
  const ids = orderIds || order_ids || [];
  const targetStatus = action ? BULK_ACTION_STATUS[action] : status;
  if (!ids.length || !targetStatus) return res.status(422).json({ message: 'Thieu orderIds hoac action.' });

  const results = [];
  for (const id of ids) {
    const [order] = await query('SELECT * FROM orders WHERE id = ?', [id]);
    if (!order) { results.push({ orderId: id, orderNo: null, success: false, message: 'Khong tim thay don.' }); continue; }
    if (!(ORDER_TRANSITIONS[order.status] ?? []).includes(targetStatus)) {
      results.push({ orderId: id, orderNo: order.order_no, success: false, message: `Khong the chuyen ${order.status} -> ${targetStatus}.` });
      continue;
    }
    const sets = ['status = ?'];
    const params = [targetStatus];
    if (targetStatus === 'SHIPPED') sets.push('shipped_at = COALESCE(shipped_at, NOW())');
    if (targetStatus === 'DELIVERED') sets.push('delivered_at = NOW()');
    if (targetStatus === 'CANCELLED') sets.push('cancelled_at = NOW()');
    await query(`UPDATE orders SET ${sets.join(', ')} WHERE id = ?`, [...params, id]);
    await query(
      'INSERT INTO order_status_history (order_id, from_status, to_status, note, changed_by_user_id) VALUES (?, ?, ?, ?, ?)',
      [id, order.status, targetStatus, req.body.note || null, req.user.id]
    );
    await notifyOrderUser(order, 'Cap nhat don hang', `Don ${order.order_no} chuyen sang ${targetStatus}.`);
    results.push({ orderId: id, orderNo: order.order_no, success: true, message: `Da chuyen sang ${targetStatus}.` });
  }
  const success = results.filter((r) => r.success).length;
  res.json({ data: { total: ids.length, success, failed: ids.length - success, results } });
});

// ---------------- Order shipment (UC 2.2.17 / 2.2.22) ----------------
// GHN thuc: neu carrier la GHN + da cau hinh GHN_TOKEN/GHN_SHOP_ID + don co dia chi
// huyen/xa -> goi API tao van don that (co ma van don, phi, thoi gian giao du kien).
// Nguoc lai -> tao van don thu cong (ma noi bo) de van van hanh khi chua co token.
function parseGhnTime(v) {
  if (!v) return null;
  const d = typeof v === 'number' ? new Date(v * 1000) : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

// POST /api/admin/orders/:order/shipment/fee-preview — xem truoc phi GHN truoc khi tao van don.
export const previewShipmentFee = asyncHandler(async (req, res) => {
  const [order] = await query('SELECT * FROM orders WHERE id = ?', [req.params.order]);
  if (!order) return res.status(404).json({ message: 'Khong tim thay don hang.' });
  const toDistrict = req.body.to_district_id || order.shipping_district_id;
  const toWard = req.body.to_ward_code || order.shipping_ward_code;

  if (!ghnConfigured()) {
    return res.json({
      data: { configured: false, source: 'ORDER', fee: order.shipping_fee != null ? Number(order.shipping_fee) : null },
    });
  }
  if (!toDistrict || !toWard) {
    return res.status(422).json({ message: 'Don hang thieu quan/huyen hoac phuong/xa GHN de tinh phi.' });
  }
  try {
    const fee = await calculateFee({ toDistrictId: toDistrict, toWardCode: toWard, insuranceValue: Number(order.total_amount) });
    res.json({ data: { configured: true, source: 'GHN', fee: fee?.total != null ? Number(fee.total) : null, detail: fee } });
  } catch (err) {
    res.status(502).json({ message: 'GHN tinh phi that bai: ' + (err.response?.data?.message || err.message) });
  }
});

export const storeShipment = asyncHandler(async (req, res) => {
  const {
    shipping_carrier_id, tracking_code, tracking_url, weight, length, width, height,
    to_district_id, to_ward_code, cod_amount,
  } = req.body;
  const [order] = await query('SELECT * FROM orders WHERE id = ?', [req.params.order]);
  if (!order) return res.status(404).json({ message: 'Khong tim thay don hang.' });
  const [carrier] = await query('SELECT * FROM shipping_carriers WHERE id = ?', [shipping_carrier_id]);

  const provider = carrier?.provider || 'MANUAL';
  const toDistrict = to_district_id || order.shipping_district_id;
  const toWard = to_ward_code || order.shipping_ward_code;
  // COD: mac dinh thu ho tong tien don neu thanh toan COD, con thanh toan online -> 0.
  const codAmount = cod_amount != null ? Number(cod_amount)
    : (order.payment_method === 'COD' ? Number(order.total_amount) : 0);

  let trackingCode = tracking_code || null;
  let trackingUrl = tracking_url || null;
  let shippingFee = null;
  let expectedDelivery = null;
  let status = 'created';
  let ghnError = null;

  if (provider === 'GHN' && ghnConfigured() && toDistrict && toWard) {
    try {
      const items = await query(
        'SELECT product_name_snapshot AS name, quantity FROM order_items WHERE order_id = ?', [order.id]
      );
      const ghnRes = await createShippingOrder({
        order, toDistrictId: toDistrict, toWardCode: toWard,
        items: items.map((it) => ({ name: it.name, quantity: it.quantity, weight: 200 })),
        weight, length, width, height, codAmount, insuranceValue: Number(order.total_amount),
      });
      if (ghnRes) {
        trackingCode = ghnRes.order_code;
        trackingUrl = `https://donhang.ghn.vn/?order_code=${ghnRes.order_code}`;
        shippingFee = ghnRes.total_fee != null ? Number(ghnRes.total_fee) : null;
        expectedDelivery = parseGhnTime(ghnRes.expected_delivery_time);
        status = 'ready_to_pick';
      }
    } catch (err) {
      ghnError = err.response?.data?.message || err.message;
      console.error('[ghn] createShippingOrder that bai, tao van don thu cong:', ghnError);
    }
  }

  // Fallback thu cong: sinh ma van don noi bo + lay phi tu don hang neu GHN khong tra.
  if (!trackingCode) trackingCode = `${carrier?.code || 'SHIP'}${Date.now()}`;
  if (shippingFee == null) shippingFee = order.shipping_fee != null ? Number(order.shipping_fee) : null;

  await query(
    `INSERT INTO order_shipments (order_id, shipping_carrier_id, provider, status, tracking_code, tracking_url,
       weight, length, width, height, shipping_fee, cod_amount, expected_delivery_time, created_by_user_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [order.id, shipping_carrier_id, provider, status, trackingCode, trackingUrl,
      weight || null, length || null, width || null, height || null,
      shippingFee, codAmount, expectedDelivery, req.user.id]
  );
  res.status(201).json({ data: await loadAdminOrderDetail(order.id), ghn_error: ghnError });
});

export const syncShipment = asyncHandler(async (req, res) => {
  const [shipment] = await query(
    `SELECT s.*, c.provider AS carrier_provider FROM order_shipments s
     LEFT JOIN shipping_carriers c ON c.id = s.shipping_carrier_id
     WHERE s.order_id = ? ORDER BY s.id DESC LIMIT 1`,
    [req.params.order]
  );
  if (!shipment) return res.status(404).json({ message: 'Don hang chua co van don.' });

  let newStatus = shipment.status;
  if (shipment.provider === 'GHN' && ghnConfigured() && shipment.tracking_code) {
    try {
      const detail = await getShippingOrderDetail(shipment.tracking_code);
      if (detail?.status) newStatus = detail.status;
    } catch (err) {
      console.error('[ghn] getShippingOrderDetail that bai:', err.response?.data?.message || err.message);
    }
  }
  await query('UPDATE order_shipments SET status = ?, synced_at = NOW() WHERE id = ?', [newStatus, shipment.id]);
  res.json({ data: await loadAdminOrderDetail(req.params.order) });
});

export const destroyShipment = asyncHandler(async (req, res) => {
  const [shipment] = await query(
    `SELECT s.*, c.provider AS carrier_provider FROM order_shipments s
     LEFT JOIN shipping_carriers c ON c.id = s.shipping_carrier_id
     WHERE s.order_id = ? ORDER BY s.id DESC LIMIT 1`,
    [req.params.order]
  );
  if (shipment && shipment.provider === 'GHN' && ghnConfigured() && shipment.tracking_code) {
    try {
      await cancelShippingOrder(shipment.tracking_code);
    } catch (err) {
      console.error('[ghn] cancelShippingOrder that bai:', err.response?.data?.message || err.message);
    }
  }
  await query('DELETE FROM order_shipments WHERE order_id = ?', [req.params.order]);
  res.json({ data: await loadAdminOrderDetail(req.params.order) });
});
