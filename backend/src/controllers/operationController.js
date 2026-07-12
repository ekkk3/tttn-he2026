import { query } from '../config/db.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// Danh cho vai tro WAREHOUSE_STAFF (theo de cuong: "Theo doi/quan ly ton kho, Tao yeu cau
// nhap hang, Xu ly don hang, Cap nhat trang thai dong goi/giao hang, Quan ly gia nhap").

export const inventory = asyncHandler(async (req, res) => {
  const rows = await query(
    `SELECT ii.*, p.name AS product_name, i.name AS inventory_name
     FROM inventory_items ii
     JOIN products p ON p.id = ii.product_id
     JOIN inventories i ON i.id = ii.inventory_id
     ORDER BY ii.id DESC`
  );
  res.json({ inventory: rows });
});

export const requisitions = asyncHandler(async (req, res) => {
  const rows = await query('SELECT * FROM delivery_requests ORDER BY id DESC');
  res.json({ requisitions: rows });
});

export const storeRequisition = asyncHandler(async (req, res) => {
  const { product_id, requested_qty, reason } = req.body;
  const result = await query(
    'INSERT INTO delivery_requests (requested_by_user_id, product_id, requested_qty, reason) VALUES (?, ?, ?, ?)',
    [req.user.id, product_id, requested_qty, reason || null]
  );
  res.status(201).json({ id: result.insertId });
});

export const updateRequisitionStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  await query('UPDATE delivery_requests SET status = ?, approved_by_user_id = ? WHERE id = ?', [
    status, req.user.id, req.params.id,
  ]);
  res.json({ message: 'Da cap nhat trang thai yeu cau nhap hang.' });
});

export const supplierOrders = asyncHandler(async (req, res) => {
  const rows = await query('SELECT * FROM supply_orders ORDER BY id DESC');
  res.json({ supplier_orders: rows });
});

export const fulfillmentTasks = asyncHandler(async (req, res) => {
  const rows = await query("SELECT * FROM orders WHERE status IN ('PAID','PROCESSING','PACKED') ORDER BY id ASC");
  res.json({ tasks: rows });
});

export const updateOrderDeliveryStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  await query('UPDATE orders SET status = ? WHERE id = ?', [status, req.params.order]);
  await query('INSERT INTO order_status_history (order_id, to_status, changed_by_user_id) VALUES (?, ?, ?)', [
    req.params.order, status, req.user.id,
  ]);
  res.json({ message: 'Da cap nhat trang thai giao hang.' });
});

export const advanceFulfillmentTask = asyncHandler(async (req, res) => {
  // State machine don gian: PAID -> PROCESSING -> PACKED -> SHIPPED
  const flow = { PAID: 'PROCESSING', PROCESSING: 'PACKED', PACKED: 'SHIPPED' };
  const [order] = await query('SELECT status FROM orders WHERE id = ?', [req.params.order]);
  const next = flow[order?.status];
  if (!next) return res.status(422).json({ message: 'Khong the chuyen trang thai tiep theo.' });
  await query('UPDATE orders SET status = ? WHERE id = ?', [next, req.params.order]);
  await query('INSERT INTO order_status_history (order_id, to_status, changed_by_user_id) VALUES (?, ?, ?)', [
    req.params.order, next, req.user.id,
  ]);
  res.json({ message: `Da chuyen don hang sang trang thai ${next}.` });
});
