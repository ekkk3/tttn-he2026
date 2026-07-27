import { query } from '../config/db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ORDER_TRANSITIONS } from '../services/orderTransitions.js';

// Dành cho WAREHOUSE_STAFF/ADMIN (UC 2.2.20 Yêu cầu nhập hàng, 2.2.21 Quản lý kho,
// 2.2.22 Cập nhật trạng thái đơn, 2.2.23 Xử lý đơn, 2.2.24 Quản lý giá nhập).
// Frontend (use-operations-data-store.js) đọc { data } và adapt sang camelCase.

function inventoryStatus(quantity, reorderLevel) {
  if (quantity <= 0) return 'out-of-stock';
  if (quantity <= reorderLevel) return 'low-stock';
  return 'in-stock';
}

// Nếu người gọi là NCC -> trả về supplier_id của họ để lọc dữ liệu (chỉ thấy sản
// phẩm/đơn của mình). WAREHOUSE_STAFF/ADMIN -> null (thấy tất cả).
async function supplierScopeId(req) {
  if (req.user.role !== 'SUPPLIER') return null;
  const [supplier] = await query('SELECT id FROM suppliers WHERE user_id = ? LIMIT 1', [req.user.id]);
  return supplier ? supplier.id : -1; // -1: NCC chưa có bản ghi supplier -> không thấy gì
}

// Đơn có chứa sản phẩm của supplier (scopeId) hay không — chặn NCC thao tác đơn không
// liên quan gì đến mình (updateOrderDeliveryStatus / advanceFulfillmentTask).
async function orderBelongsToSupplier(orderId, supplierScopeIdValue) {
  const [row] = await query(
    'SELECT 1 FROM order_items oi JOIN products p ON p.id = oi.product_id WHERE oi.order_id = ? AND p.supplier_id = ? LIMIT 1',
    [orderId, supplierScopeIdValue]
  );
  return Boolean(row);
}

// Tính số lượng đang giữ chỗ (reserved) = tổng quantity trong các đơn chưa kết thúc.
async function reservedByProduct() {
  const rows = await query(
    `SELECT oi.product_id, COALESCE(SUM(oi.quantity),0) AS reserved
     FROM order_items oi JOIN orders o ON o.id = oi.order_id
     WHERE o.status IN ('PENDING','CONFIRMED','PACKED','SHIPPED','AWAITING_PAYMENT_CONFIRMATION')
     GROUP BY oi.product_id`
  );
  return new Map(rows.map((r) => [r.product_id, Number(r.reserved)]));
}

const INVENTORY_ROW_SELECT = `
  SELECT p.id AS product_id, p.sku, p.name AS product_name, p.stock_quantity, p.reorder_level,
         p.purchase_price, p.aisle, p.supplier_id, s.name AS supplier_name, s.address AS supplier_location
  FROM products p LEFT JOIN suppliers s ON s.id = p.supplier_id
`;
// Không bao giờ trả sku null (sản phẩm có thể tạo mà chưa nhập SKU) -> tránh lỗi
// toLowerCase() khi lọc tìm kiếm ở trang tồn kho.
function serializeInventoryRow(r, reservedByProductMap) {
  return {
    sku: r.sku || `SP${r.product_id}`,
    product_id: r.product_id,
    product_name: r.product_name,
    supplier_id: r.supplier_id,
    supplier_name: r.supplier_name,
    supplier_location: r.supplier_location,
    inventory_location: r.aisle,
    quantity_on_hand: r.stock_quantity,
    reserved: reservedByProductMap.get(r.product_id) || 0,
    reorder_level: r.reorder_level,
    purchase_price: r.purchase_price !== null ? Number(r.purchase_price) : null,
    aisle: r.aisle,
    status: inventoryStatus(r.stock_quantity, r.reorder_level),
  };
}

// --- Tồn kho (derive từ products) ---
export const inventory = asyncHandler(async (req, res) => {
  const scopeId = await supplierScopeId(req);
  // scopeId === null (WAREHOUSE_STAFF/ADMIN) -> không thêm điều kiện, thấy toàn bộ sản phẩm.
  // scopeId là số (SUPPLIER) -> thêm "AND p.supplier_id = ?" để chỉ thấy sản phẩm của mình.
  const rows = await query(
    `${INVENTORY_ROW_SELECT} WHERE p.is_deleted = 0 ${scopeId !== null ? 'AND p.supplier_id = ?' : ''} ORDER BY p.stock_quantity ASC`,
    scopeId !== null ? [scopeId] : []
  );
  // reservedByProduct() query 1 LẦN cho TẤT CẢ sản phẩm (không phải query lại trong vòng lặp)
  // rồi tra cứu qua Map — tránh N+1 query khi danh sách tồn kho có hàng trăm sản phẩm.
  const reserved = await reservedByProduct();
  res.json({ data: rows.map((r) => serializeInventoryRow(r, reserved)) });
});

// PATCH /api/operations/inventory/:productId/purchase-price — Nhân viên kho/Admin cập nhật
// giá nhập sản phẩm (UC 2.2.24 Quản lý giá nhập sản phẩm). Trước đây cột purchase_price chỉ
// được ĐỌC (hiện read-only ở warehouse-inventory-page.jsx), không có endpoint nào ghi được.
// NCC chỉ được XEM (route /operations/* cho phép cả SUPPLIER gọi GET inventory), không được
// tự sửa giá nhập của chính mình vì đây là chi phí nội bộ phía kho, không phải giá NCC báo.
export const updatePurchasePrice = asyncHandler(async (req, res) => {
  if (req.user.role === 'SUPPLIER') {
    return res.status(403).json({ message: 'Bạn không có quyền sửa giá nhập sản phẩm.' });
  }
  const { purchase_price } = req.body;
  const isBlank = purchase_price === null || purchase_price === undefined || purchase_price === '';
  if (!isBlank && (Number.isNaN(Number(purchase_price)) || Number(purchase_price) < 0)) {
    return res.status(422).json({ message: 'Giá nhập không hợp lệ.' });
  }
  const [product] = await query('SELECT id FROM products WHERE id = ? AND is_deleted = 0', [req.params.productId]);
  if (!product) return res.status(404).json({ message: 'Không tìm thấy sản phẩm.' });

  await query('UPDATE products SET purchase_price = ? WHERE id = ?', [
    isBlank ? null : Number(purchase_price), req.params.productId,
  ]);
  const [row] = await query(`${INVENTORY_ROW_SELECT} WHERE p.id = ?`, [req.params.productId]);
  const reserved = await reservedByProduct();
  res.json({ data: serializeInventoryRow(row, reserved) });
});

// --- Yêu cầu nhập hàng / phiếu nhập (delivery_requests) ---
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
  if (!product_id || !requested_qty) return res.status(422).json({ message: 'product_id và requested_qty là bắt buộc.' });
  // Frontend dùng status lowercase (submitted/approved/received/cancelled) - xem labels.js.
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
  if (!current) return res.status(404).json({ message: 'Không tìm thấy phiếu nhập.' });
  // Bảo vệ: NCC chỉ được thao tác phiếu nhập cho sản phẩm CỦA MÌNH (UC 2.2.13).
  const scopeId = await supplierScopeId(req);
  if (scopeId !== null) {
    const [owned] = await query('SELECT id FROM products WHERE id = ? AND supplier_id = ?', [current.product_id, scopeId]);
    if (!owned) return res.status(403).json({ message: 'Bạn chỉ có thể thao tác phiếu nhập của mình.' });
  }
  await query(
    'UPDATE delivery_requests SET status = ?, approved_qty = COALESCE(?, approved_qty), approved_by_user_id = ? WHERE id = ?',
    [status, approved_qty ?? null, req.user.id, req.params.id]
  );
  // Khi phiếu nhập "received" (đã nhập kho) -> cộng tồn kho sản phẩm (UC 2.2.21).
  if (String(status).toLowerCase() === 'received') {
    // Số lượng thực nhập ưu tiên theo thứ tự: giá trị vừa duyệt trong request này -> giá trị
    // đã duyệt từ trước (nếu bước "approved" làm trước "received") -> số lượng yêu cầu ban đầu
    // (nếu chưa ai duyệt số khác thì coi như nhập đúng số đã xin).
    const qty = approved_qty ?? current.approved_qty ?? current.requested_qty;
    await query('UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?', [qty, current.product_id]);
  }
  const [row] = await query(`${REQUISITION_SELECT} WHERE dr.id = ?`, [req.params.id]);
  res.json({ data: serializeRequisition(row) });
});

// --- Đơn cung cấp (derive từ orders thật, góc nhìn vận hành) ---
// Không có bảng riêng cho "đơn cung cấp" — đây là 1 "view model" dựng lại từ orders +
// order_items + order_status_history để khớp shape mà trang vận hành (operations) cần.
// Vài field UI cần nhưng schema không lưu theo từng đơn (supplier_name, assigned_warehouse_zone)
// tạm để giá trị cố định (kho chung, khu A) vì hệ thống hiện chỉ có 1 kho duy nhất.
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
  // NCC chỉ thấy đơn có chứa sản phẩm của họ.
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
  if (!order) return res.status(404).json({ message: 'Không tìm thấy đơn hàng.' });
  // Bảo vệ: NCC chỉ được thao tác đơn hàng có chứa sản phẩm CỦA MÌNH.
  const scopeId = await supplierScopeId(req);
  if (scopeId !== null && !(await orderBelongsToSupplier(order.id, scopeId))) {
    return res.status(403).json({ message: 'Bạn chỉ có thể thao tác đơn hàng có sản phẩm của mình.' });
  }
  // Chỉ cho phép chuyển trạng thái hợp lệ theo state machine dùng chung (tránh gán
  // giá trị tùy ý vào orders.status — cột này là VARCHAR, không phải ENUM).
  if (!(ORDER_TRANSITIONS[order.status] ?? []).includes(delivery_status)) {
    return res.status(422).json({ message: `Không thể chuyển từ ${order.status} sang ${delivery_status}.` });
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

// --- Fulfillment tasks (đơn cần đóng gói/giao: derive từ orders) ---
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
    eta_label: order.status === 'SHIPPED' ? 'Đang giao' : 'Trong ngày',
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
  // State machine đóng gói: CONFIRMED -> PACKED -> SHIPPED.
  const flow = { CONFIRMED: 'PACKED', PACKED: 'SHIPPED' };
  const [order] = await query('SELECT o.*, u.full_name AS customer_name FROM orders o LEFT JOIN users u ON u.id = o.user_id WHERE o.id = ?', [req.params.order]);
  if (!order) return res.status(404).json({ message: 'Không tìm thấy đơn.' });
  const scopeId = await supplierScopeId(req);
  if (scopeId !== null && !(await orderBelongsToSupplier(order.id, scopeId))) {
    return res.status(403).json({ message: 'Bạn chỉ có thể thao tác đơn hàng có sản phẩm của mình.' });
  }
  const next = flow[order.status];
  if (!next) return res.status(422).json({ message: 'Không thể chuyển trạng thái tiếp theo.' });
  await query('UPDATE orders SET status = ? WHERE id = ?', [next, req.params.order]);
  await query(
    'INSERT INTO order_status_history (order_id, from_status, to_status, note, changed_by_user_id) VALUES (?, ?, ?, ?, ?)',
    [req.params.order, order.status, next, req.body.note || null, req.user.id]
  );
  // Dựng response từ `order` đã có sẵn trong bộ nhớ (ghi đè status = next) thay vì SELECT lại
  // từ DB — tiết kiệm 1 round-trip vì ta đã biết chắc DB vừa được cập nhật đúng giá trị này.
  res.json({ data: await buildFulfillmentTask({ ...order, status: next }) });
});
