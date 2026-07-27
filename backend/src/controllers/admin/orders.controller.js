import { query } from '../../config/db.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { serializeOrderDetail, serializeOrderSummary } from '../../utils/serializers.js';
import {
  ghnConfigured, calculateFee, createShippingOrder, getShippingOrderDetail, cancelShippingOrder,
} from '../../utils/ghn.js';
import { ORDER_TRANSITIONS, PAYMENT_TRANSITIONS } from '../../services/orderTransitions.js';
import { notifyUser } from '../../services/notificationService.js';

// ---------------- Orders (admin) — UC 2.2.17 Quản lý đơn hàng ----------------
// Frontend (admin-logistics-page.jsx + use-admin-orders-store.js) đọc { data } với
// customer/payment/shipment lồng, allowed_next_statuses (state machine),
// allowed_payment_statuses, status_history, payment_status_history.
// ORDER_TRANSITIONS/PAYMENT_TRANSITIONS: xem services/orderTransitions.js (nguồn dùng chung).

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
  if (!rows.length) return res.json({ data: [] });

  // Lấy hết payment/shipment liên quan trong 2 truy vấn gộp (IN (...)) thay vì 2*N truy vấn
  // trong vòng lặp (N+1), rồi gộp lại bằng Map trong bộ nhớ — giữ nguyên shape dữ liệu trả về.
  const orderIds = rows.map((o) => o.id);
  const placeholders = orderIds.map(() => '?').join(',');

  const paymentRows = await query(
    `SELECT * FROM payments WHERE order_id IN (${placeholders}) ORDER BY id DESC`, orderIds
  );
  const latestPaymentByOrder = new Map();
  for (const p of paymentRows) {
    if (!latestPaymentByOrder.has(p.order_id)) latestPaymentByOrder.set(p.order_id, p);
  }

  const shipmentRows = await query(
    `SELECT s.order_id, s.tracking_code, c.name AS carrier_name
     FROM order_shipments s LEFT JOIN shipping_carriers c ON c.id = s.shipping_carrier_id
     WHERE s.order_id IN (${placeholders}) ORDER BY s.id DESC`, orderIds
  );
  const latestShipmentByOrder = new Map();
  for (const s of shipmentRows) {
    if (!latestShipmentByOrder.has(s.order_id)) latestShipmentByOrder.set(s.order_id, s);
  }

  const data = rows.map((o) => {
    const payment = latestPaymentByOrder.get(o.id) || null;
    const shipment = latestShipmentByOrder.get(o.id) || null;
    return {
      ...serializeOrderSummary(o, { itemCount: o.item_count, payment }),
      customer: { id: o.user_id, full_name: o.customer_name, email: o.customer_email },
      shipping_code: shipment?.tracking_code ?? null,
      shipping_carrier: shipment?.carrier_name ?? null,
    };
  });
  res.json({ data });
});

export const showOrder = asyncHandler(async (req, res) => {
  const detail = await loadAdminOrderDetail(req.params.order);
  if (!detail) return res.status(404).json({ message: 'Không tìm thấy đơn hàng.' });
  res.json({ data: detail });
});

export const updateOrderStatus = asyncHandler(async (req, res) => {
  const { status, note, restock_inventory } = req.body;
  const [order] = await query('SELECT * FROM orders WHERE id = ?', [req.params.order]);
  if (!order) return res.status(404).json({ message: 'Không tìm thấy đơn hàng.' });
  if (!(ORDER_TRANSITIONS[order.status] ?? []).includes(status)) {
    return res.status(422).json({ message: `Không thể chuyển từ ${order.status} sang ${status}.` });
  }
  // Ngoài đổi status, một số trạng thái đích cần TỰ ĐỘNG ghi thêm mốc thời gian tương ứng
  // (shipped_at/delivered_at/cancelled_at) — COALESCE cho shipped_at để không ghi đè nếu
  // đơn đã từng được đánh dấu SHIPPED trước đó rồi lại chuyển qua chuyển lại.
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
  // Hoàn kho khi hủy đơn (nếu chọn restock_inventory) — UC 2.2.17/2.2.21.
  if (status === 'CANCELLED' && restock_inventory) {
    const items = await query('SELECT product_id, quantity FROM order_items WHERE order_id = ?', [order.id]);
    for (const it of items) {
      if (it.product_id) await query('UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?', [it.quantity, it.product_id]);
    }
  }
  await notifyOrderUser(order, 'Cập nhật đơn hàng', `Đơn ${order.order_no} chuyển sang trạng thái ${status}.`);
  res.json({ data: await loadAdminOrderDetail(order.id) });
});

export const updatePaymentStatus = asyncHandler(async (req, res) => {
  const { payment_status, note } = req.body;
  const [order] = await query('SELECT * FROM orders WHERE id = ?', [req.params.order]);
  if (!order) return res.status(404).json({ message: 'Không tìm thấy đơn hàng.' });
  const [payment] = await query('SELECT * FROM payments WHERE order_id = ? ORDER BY id DESC LIMIT 1', [order.id]);
  const current = payment?.payment_status ?? 'PENDING';
  if (!(PAYMENT_TRANSITIONS[current] ?? []).includes(payment_status)) {
    return res.status(422).json({ message: `Không thể chuyển thanh toán từ ${current} sang ${payment_status}.` });
  }
  const paidAtSql = payment_status === 'SUCCESS' ? ', paid_at = NOW()' : '';
  await query(`UPDATE payments SET payment_status = ?${paidAtSql} WHERE order_id = ?`, [payment_status, order.id]);
  await query(
    'INSERT INTO payment_status_history (order_id, from_status, to_status, note, changed_by_user_id) VALUES (?, ?, ?, ?, ?)',
    [order.id, current, payment_status, note || null, req.user.id]
  );
  res.json({ data: await loadAdminOrderDetail(order.id) });
});

// Xử lý TỪNG đơn độc lập (không bọc trong 1 transaction chung): 1 đơn lỗi (vd sai state
// machine) không làm hỏng các đơn khác trong cùng lượt chọn — kết quả trả về mảng `results`
// để frontend hiện rõ đơn nào thành công/thất bại và vì sao.
export const bulkUpdateStatus = asyncHandler(async (req, res) => {
  const { orderIds, order_ids, action, status } = req.body;
  const ids = orderIds || order_ids || [];
  const targetStatus = action ? BULK_ACTION_STATUS[action] : status;
  if (!ids.length || !targetStatus) return res.status(422).json({ message: 'Thiếu orderIds hoặc action.' });

  const results = [];
  for (const id of ids) {
    const [order] = await query('SELECT * FROM orders WHERE id = ?', [id]);
    if (!order) { results.push({ orderId: id, orderNo: null, success: false, message: 'Không tìm thấy đơn.' }); continue; }
    if (!(ORDER_TRANSITIONS[order.status] ?? []).includes(targetStatus)) {
      results.push({ orderId: id, orderNo: order.order_no, success: false, message: `Không thể chuyển ${order.status} -> ${targetStatus}.` });
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
    await notifyOrderUser(order, 'Cập nhật đơn hàng', `Đơn ${order.order_no} chuyển sang ${targetStatus}.`);
    results.push({ orderId: id, orderNo: order.order_no, success: true, message: `Đã chuyển sang ${targetStatus}.` });
  }
  const success = results.filter((r) => r.success).length;
  res.json({ data: { total: ids.length, success, failed: ids.length - success, results } });
});

// ---------------- Order shipment (UC 2.2.17 / 2.2.22) ----------------
// GHN thực: nếu carrier là GHN + đã cấu hình GHN_TOKEN/GHN_SHOP_ID + đơn có địa chỉ
// huyện/xã -> gọi API tạo vận đơn thật (có mã vận đơn, phí, thời gian giao dự kiến).
// Ngược lại -> tạo vận đơn thủ công (mã nội bộ) để vẫn vận hành khi chưa có token.
function parseGhnTime(v) {
  if (!v) return null;
  const d = typeof v === 'number' ? new Date(v * 1000) : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

// POST /api/admin/orders/:order/shipment/fee-preview — xem trước phí GHN trước khi tạo vận đơn.
export const previewShipmentFee = asyncHandler(async (req, res) => {
  const [order] = await query('SELECT * FROM orders WHERE id = ?', [req.params.order]);
  if (!order) return res.status(404).json({ message: 'Không tìm thấy đơn hàng.' });
  const toDistrict = req.body.to_district_id || order.shipping_district_id;
  const toWard = req.body.to_ward_code || order.shipping_ward_code;

  if (!ghnConfigured()) {
    return res.json({
      data: { configured: false, source: 'ORDER', fee: order.shipping_fee != null ? Number(order.shipping_fee) : null },
    });
  }
  if (!toDistrict || !toWard) {
    return res.status(422).json({ message: 'Đơn hàng thiếu quận/huyện hoặc phường/xã GHN để tính phí.' });
  }
  try {
    const fee = await calculateFee({ toDistrictId: toDistrict, toWardCode: toWard, insuranceValue: Number(order.total_amount) });
    res.json({ data: { configured: true, source: 'GHN', fee: fee?.total != null ? Number(fee.total) : null, detail: fee } });
  } catch (err) {
    res.status(502).json({ message: 'GHN tính phí thất bại: ' + (err.response?.data?.message || err.message) });
  }
});

export const storeShipment = asyncHandler(async (req, res) => {
  const {
    shipping_carrier_id, tracking_code, tracking_url, weight, length, width, height,
    to_district_id, to_ward_code, cod_amount,
  } = req.body;
  const [order] = await query('SELECT * FROM orders WHERE id = ?', [req.params.order]);
  if (!order) return res.status(404).json({ message: 'Không tìm thấy đơn hàng.' });
  const [carrier] = await query('SELECT * FROM shipping_carriers WHERE id = ?', [shipping_carrier_id]);

  const provider = carrier?.provider || 'MANUAL';
  const toDistrict = to_district_id || order.shipping_district_id;
  const toWard = to_ward_code || order.shipping_ward_code;
  // COD: mặc định thu hộ tổng tiền đơn nếu thanh toán COD, còn thanh toán online -> 0.
  const codAmount = cod_amount != null ? Number(cod_amount)
    : (order.payment_method === 'COD' ? Number(order.total_amount) : 0);

  // Các biến này sẽ được GHN trả về ghi đè (nếu gọi API thật thành công), hoặc giữ giá trị
  // mặc định/thủ công (nhánh fallback ngay dưới) nếu không phải GHN hoặc GHN lỗi.
  let trackingCode = tracking_code || null;
  let trackingUrl = tracking_url || null;
  let shippingFee = null;
  let expectedDelivery = null;
  let status = 'created';
  let ghnError = null;

  // Chỉ thực sự gọi API GHN khi: carrier chọn là GHN + đã cấu hình token/shop id + đơn có
  // đủ thông tin quận/huyện + phường/xã GHN (bắt buộc để GHN tính được tuyến giao).
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
      // Lỗi GHN KHÔNG làm hỏng cả request — chỉ ghi lại lỗi (trả về cho admin biết) rồi
      // để code rơi xuống nhánh fallback thủ công bên dưới, đơn vẫn tạo được vận đơn (nội bộ).
      ghnError = err.response?.data?.message || err.message;
      console.error('[ghn] createShippingOrder thất bại, tạo vận đơn thủ công:', ghnError);
    }
  }

  // Fallback thủ công: sinh mã vận đơn nội bộ + lấy phí từ đơn hàng nếu GHN không trả.
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
  if (!shipment) return res.status(404).json({ message: 'Đơn hàng chưa có vận đơn.' });

  let newStatus = shipment.status;
  if (shipment.provider === 'GHN' && ghnConfigured() && shipment.tracking_code) {
    try {
      const detail = await getShippingOrderDetail(shipment.tracking_code);
      if (detail?.status) newStatus = detail.status;
    } catch (err) {
      console.error('[ghn] getShippingOrderDetail thất bại:', err.response?.data?.message || err.message);
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
      console.error('[ghn] cancelShippingOrder thất bại:', err.response?.data?.message || err.message);
    }
  }
  await query('DELETE FROM order_shipments WHERE order_id = ?', [req.params.order]);
  res.json({ data: await loadAdminOrderDetail(req.params.order) });
});
