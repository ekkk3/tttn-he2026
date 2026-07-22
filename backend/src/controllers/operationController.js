import { query } from '../config/db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ORDER_TRANSITIONS } from '../services/orderTransitions.js';

// Danh cho WAREHOUSE_STAFF/ADMIN (UC 2.2.20 Yeu cau nhap hang, 2.2.21 Quan ly kho,
// 2.2.22 Cap nhat trang thai don, 2.2.23 Xu ly don, 2.2.24 Quan ly gia nhap).
// Frontend (use-operations-data-store.js) doc { data } va adapt sang camelCase.

function inventoryStatus(quantity, reorderLevel) {
  if (quantity <= 0) return 'out-of-stock';
  if (quantity <= reorderLevel) return 'low-stock';
  return 'in-stock';
}

// Neu nguoi goi la NCC -> tra ve supplier_id cua ho de loc du lieu (chi thay san
// pham/don cua minh). WAREHOUSE_STAFF/ADMIN -> null (thay tat ca).
async function supplierScopeId(req) {
  if (req.user.role !== 'SUPPLIER') return null;
  const [supplier] = await query('SELECT id FROM suppliers WHERE user_id = ? LIMIT 1', [req.user.id]);
  return supplier ? supplier.id : -1; // -1: NCC chua co ban ghi supplier -> khong thay gi
}

// Don co chua san pham cua supplier (scopeId) hay khong — chan NCC thao tac don khong
// lien quan gi den minh (updateOrderDeliveryStatus / advanceFulfillmentTask).
async function orderBelongsToSupplier(orderId, supplierScopeIdValue) {
  const [row] = await query(
    'SELECT 1 FROM order_items oi JOIN products p ON p.id = oi.product_id WHERE oi.order_id = ? AND p.supplier_id = ? LIMIT 1',
    [orderId, supplierScopeIdValue]
  );
  return Boolean(row);
}

// Tinh so luong dang giu cho (reserved) = tong quantity trong cac don chua ket thuc.
async function reservedByProduct() {
  const rows = await query(
    `SELECT oi.product_id, COALESCE(SUM(oi.quantity),0) AS reserved
     FROM order_items oi JOIN orders o ON o.id = oi.order_id
     WHERE o.status IN ('PENDING','CONFIRMED','PACKED','SHIPPED','AWAITING_PAYMENT_CONFIRMATION')
     GROUP BY oi.product_id`
  );
  return new Map(rows.map((r) => [r.product_id, Number(r.reserved)]));
}

// --- Ton kho (derive tu products) ---
export const inventory = asyncHandler(async (req, res) => {
  const scopeId = await supplierScopeId(req);
  const rows = await query(
    `SELECT p.id AS product_id, p.sku, p.name AS product_name, p.stock_quantity, p.reorder_level,
            p.purchase_price, p.aisle, p.supplier_id, s.name AS supplier_name, s.address AS supplier_location
     FROM products p LEFT JOIN suppliers s ON s.id = p.supplier_id
     WHERE p.is_deleted = 0 ${scopeId !== null ? 'AND p.supplier_id = ?' : ''} ORDER BY p.stock_quantity ASC`,
    scopeId !== null ? [scopeId] : []
  );
  const reserved = await reservedByProduct();
  const data = rows.map((r) => ({
    // Khong bao gio tra sku null (san pham co the tao ma chua nhap SKU) -> tranh loi
    // toLowerCase() khi loc tim kiem o trang ton kho.
    sku: r.sku || `SP${r.product_id}`,
    product_id: r.product_id,
    product_name: r.product_name,
    supplier_id: r.supplier_id,
    supplier_name: r.supplier_name,
    supplier_location: r.supplier_location,
    inventory_location: r.aisle,
    quantity_on_hand: r.stock_quantity,
    reserved: reserved.get(r.product_id) || 0,
    reorder_level: r.reorder_level,
    purchase_price: r.purchase_price !== null ? Number(r.purchase_price) : null,
    aisle: r.aisle,
    status: inventoryStatus(r.stock_quantity, r.reorder_level),
  }));
  res.json({ data });
});

// --- Yeu cau nhap hang / phieu nhap (delivery_requests) ---
function serializeRequisition(r) {
  return {
    id: r.id,
    inventory_sku: r.sku,
    product_id: r.product_id,
    product_name: r.product_name,
    supplier_id: r.supplier_id,
    supplier_name: r.supplier_name,
    requested_qty: r.requested_qty,
    approved_qty: r.approved_qty,
    eta_days: r.eta_days,
    status: r.status,
    note: r.reason,
    created_at: r.created_at,
  };
}
const REQUISITION_SELECT = `
  SELECT dr.*, p.sku, p.name AS product_name, p.supplier_id, s.name AS supplier_name
  FROM delivery_requests dr
  LEFT JOIN products p ON p.id = dr.product_id
  LEFT JOIN suppliers s ON s.id = p.supplier_id
`;
export const requisitions = asyncHandler(async (req, res) => {
  const scopeId = await supplierScopeId(req);
  const rows = await query(
    `${REQUISITION_SELECT} ${scopeId !== null ? 'WHERE p.supplier_id = ?' : ''} ORDER BY dr.id DESC`,
    scopeId !== null ? [scopeId] : []
  );
  res.json({ data: rows.map(serializeRequisition) });
});
export const storeRequisition = asyncHandler(async (req, res) => {
  const { product_id, requested_qty, reason, eta_days } = req.body;
  if (!product_id || !requested_qty) return res.status(422).json({ message: 'product_id va requested_qty la bat buoc.' });
  // Frontend dung status lowercase (submitted/approved/received/cancelled) - xem labels.js.
  const result = await query(
    "INSERT INTO delivery_requests (requested_by_user_id, product_id, requested_qty, reason, eta_days, status) VALUES (?, ?, ?, ?, ?, 'submitted')",
    [req.user.id, product_id, requested_qty, reason || null, eta_days || null]
  );
  const [row] = await query(`${REQUISITION_SELECT} WHERE dr.id = ?`, [result.insertId]);
  res.status(201).json({ data: serializeRequisition(row) });
});
export const updateRequisitionStatus = asyncHandler(async (req, res) => {
  const { status, approved_qty } = req.body;
  const [current] = await query('SELECT * FROM delivery_requests WHERE id = ?', [req.params.id]);
  if (!current) return res.status(404).json({ message: 'Khong tim thay phieu nhap.' });
  // Bao ve: NCC chi duoc thao tac phieu nhap cho san pham CUA MINH (UC 2.2.13).
  const scopeId = await supplierScopeId(req);
  if (scopeId !== null) {
    const [owned] = await query('SELECT id FROM products WHERE id = ? AND supplier_id = ?', [current.product_id, scopeId]);
    if (!owned) return res.status(403).json({ message: 'Ban chi co the thao tac phieu nhap cua minh.' });
  }
  await query(
    'UPDATE delivery_requests SET status = ?, approved_qty = COALESCE(?, approved_qty), approved_by_user_id = ? WHERE id = ?',
    [status, approved_qty ?? null, req.user.id, req.params.id]
  );
  // Khi phieu nhap "received" (da nhap kho) -> cong ton kho san pham (UC 2.2.21).
  if (String(status).toLowerCase() === 'received') {
    const qty = approved_qty ?? current.approved_qty ?? current.requested_qty;
    await query('UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?', [qty, current.product_id]);
  }
  const [row] = await query(`${REQUISITION_SELECT} WHERE dr.id = ?`, [req.params.id]);
  res.json({ data: serializeRequisition(row) });
});

// --- Don cung cap (derive tu orders that, goc nhin van hanh) ---
async function buildOperationOrder(order) {
  const items = await query('SELECT * FROM order_items WHERE order_id = ?', [order.id]);
  const history = await query('SELECT *, created_at AS changed_at FROM order_status_history WHERE order_id = ? ORDER BY id ASC', [order.id]);
  const [payment] = await query('SELECT * FROM payments WHERE order_id = ? ORDER BY id DESC LIMIT 1', [order.id]);
  return {
    id: order.id,
    customer_name: order.customer_name,
    customer_id: order.user_id,
    supplier_name: 'Kho Heritage Harvest',
    supplier_id: null,
    date: order.created_at,
    total: Number(order.total_amount),
    payment_status: payment?.payment_status || 'PENDING',
    delivery_status: order.status,
    shipping_tier: order.shipping_fee > 0 ? 'standard' : 'free',
    address: order.shipping_address,
    note: order.note,
    items: items.map((it) => ({
      product_id: it.product_id, product_name: it.product_name_snapshot,
      quantity: it.quantity, unit_price: Number(it.unit_price),
    })),
    timeline: history.map((h) => ({
      id: h.id, order_id: order.id, label: h.to_status, timestamp: h.changed_at, completed: true,
    })),
    status_history: history.map((h) => ({
      id: h.id, actor: 'System', label: h.to_status, created_at: h.changed_at,
    })),
    assigned_warehouse_zone: 'Zone A',
  };
}
export const supplierOrders = asyncHandler(async (req, res) => {
  const scopeId = await supplierScopeId(req);
  // NCC chi thay don co chua san pham cua ho.
  const orders = scopeId !== null
    ? await query(
        `SELECT DISTINCT o.*, u.full_name AS customer_name FROM orders o
         LEFT JOIN users u ON u.id = o.user_id
         JOIN order_items oi ON oi.order_id = o.id
         JOIN products p ON p.id = oi.product_id AND p.supplier_id = ?
         ORDER BY o.id DESC LIMIT 30`, [scopeId])
    : await query(
        `SELECT o.*, u.full_name AS customer_name FROM orders o LEFT JOIN users u ON u.id = o.user_id
         ORDER BY o.id DESC LIMIT 30`);
  const data = [];
  for (const o of orders) data.push(await buildOperationOrder(o));
  res.json({ data });
});
export const updateOrderDeliveryStatus = asyncHandler(async (req, res) => {
  const { delivery_status, note } = req.body;
  const [order] = await query('SELECT * FROM orders WHERE id = ?', [req.params.order]);
  if (!order) return res.status(404).json({ message: 'Khong tim thay don hang.' });
  // Bao ve: NCC chi duoc thao tac don hang co chua san pham CUA MINH.
  const scopeId = await supplierScopeId(req);
  if (scopeId !== null && !(await orderBelongsToSupplier(order.id, scopeId))) {
    return res.status(403).json({ message: 'Ban chi co the thao tac don hang co san pham cua minh.' });
  }
  // Chi cho phep chuyen trang thai hop le theo state machine dung chung (tranh gan
  // gia tri tuy y vao orders.status — cot nay la VARCHAR, khong phai ENUM).
  if (!(ORDER_TRANSITIONS[order.status] ?? []).includes(delivery_status)) {
    return res.status(422).json({ message: `Khong the chuyen tu ${order.status} sang ${delivery_status}.` });
  }
  await query('UPDATE orders SET status = ? WHERE id = ?', [delivery_status, req.params.order]);
  await query(
    'INSERT INTO order_status_history (order_id, from_status, to_status, note, changed_by_user_id) VALUES (?, ?, ?, ?, ?)',
    [req.params.order, order.status, delivery_status, note || null, req.user.id]
  );
  const [refreshed] = await query(
    'SELECT o.*, u.full_name AS customer_name FROM orders o LEFT JOIN users u ON u.id = o.user_id WHERE o.id = ?',
    [req.params.order]
  );
  res.json({ data: await buildOperationOrder(refreshed) });
});

// --- Fulfillment tasks (don can dong goi/giao: derive tu orders) ---
async function buildFulfillmentTask(order) {
  const history = await query('SELECT *, created_at AS changed_at FROM order_status_history WHERE order_id = ? ORDER BY id ASC', [order.id]);
  const priority = order.status === 'CONFIRMED' ? 'high' : order.status === 'PACKED' ? 'medium' : 'normal';
  return {
    id: order.id,
    order_id: order.id,
    customer_name: order.customer_name,
    shipping_tier: order.shipping_fee > 0 ? 'standard' : 'free',
    status: order.status,
    priority,
    assigned_zone: 'Zone A',
    eta_label: order.status === 'SHIPPED' ? 'Dang giao' : 'Trong ngay',
    notes: order.note,
    status_history: history.map((h) => ({ id: h.id, actor: 'System', label: h.to_status, created_at: h.changed_at })),
  };
}
export const fulfillmentTasks = asyncHandler(async (req, res) => {
  const scopeId = await supplierScopeId(req);
  const orders = scopeId !== null
    ? await query(
        `SELECT DISTINCT o.*, u.full_name AS customer_name FROM orders o
         LEFT JOIN users u ON u.id = o.user_id
         JOIN order_items oi ON oi.order_id = o.id
         JOIN products p ON p.id = oi.product_id AND p.supplier_id = ?
         WHERE o.status IN ('CONFIRMED','PACKED','SHIPPED') ORDER BY o.id ASC`, [scopeId])
    : await query(
        `SELECT o.*, u.full_name AS customer_name FROM orders o LEFT JOIN users u ON u.id = o.user_id
         WHERE o.status IN ('CONFIRMED','PACKED','SHIPPED') ORDER BY o.id ASC`);
  const data = [];
  for (const o of orders) data.push(await buildFulfillmentTask(o));
  res.json({ data });
});
export const advanceFulfillmentTask = asyncHandler(async (req, res) => {
  // State machine dong goi: CONFIRMED -> PACKED -> SHIPPED.
  const flow = { CONFIRMED: 'PACKED', PACKED: 'SHIPPED' };
  const [order] = await query('SELECT o.*, u.full_name AS customer_name FROM orders o LEFT JOIN users u ON u.id = o.user_id WHERE o.id = ?', [req.params.order]);
  if (!order) return res.status(404).json({ message: 'Khong tim thay don.' });
  const scopeId = await supplierScopeId(req);
  if (scopeId !== null && !(await orderBelongsToSupplier(order.id, scopeId))) {
    return res.status(403).json({ message: 'Ban chi co the thao tac don hang co san pham cua minh.' });
  }
  const next = flow[order.status];
  if (!next) return res.status(422).json({ message: 'Khong the chuyen trang thai tiep theo.' });
  await query('UPDATE orders SET status = ? WHERE id = ?', [next, req.params.order]);
  await query(
    'INSERT INTO order_status_history (order_id, from_status, to_status, note, changed_by_user_id) VALUES (?, ?, ?, ?, ?)',
    [req.params.order, order.status, next, req.body.note || null, req.user.id]
  );
  res.json({ data: await buildFulfillmentTask({ ...order, status: next }) });
});
