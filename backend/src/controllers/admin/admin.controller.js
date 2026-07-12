import bcrypt from 'bcryptjs';
import { query } from '../../config/db.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { PRODUCT_SELECT, serializeProduct, serializeProducts, serializeOrderDetail, serializeOrderSummary } from '../../utils/serializers.js';

// Tat ca cac handler duoi day tuong ung 1-1 voi cac Controller trong
// app/Http/Controllers/Api/Admin/*.php cua repo Laravel goc, giu nguyen duong dan route
// (xem src/routes/api.routes.js) de frontend khong phai sua gi.

// ---------------- Dashboard ----------------
// Frontend (admin-dashboard-page.jsx) doc mot response giau: metrics, revenue_chart,
// top_customers, work_queue, low_stock_products, featured_products, recent_orders, filters.
// "Doanh thu thuc thu" = don da giao (DELIVERED). Xem UC 2.2.19 Bao cao thong ke.
export const dashboard = asyncHandler(async (req, res) => {
  const chartRange = req.query.chart_range || '30d';
  const dateTo = req.query.date_to || new Date().toISOString().slice(0, 10);
  const dateFrom = req.query.date_from ||
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);

  const [settings] = await query('SELECT low_stock_threshold FROM admin_settings ORDER BY id ASC LIMIT 1');
  const lowStockThreshold = settings?.low_stock_threshold ?? 10;

  const countByStatus = async (statuses) => {
    const [{ c }] = await query(
      `SELECT COUNT(*) AS c FROM orders WHERE status IN (${statuses.map(() => '?').join(',')})`, statuses
    );
    return c;
  };

  const [{ revenue, successful_orders }] = await query(
    "SELECT COALESCE(SUM(total_amount),0) AS revenue, COUNT(*) AS successful_orders FROM orders WHERE status = 'DELIVERED'"
  );
  const [{ today_revenue }] = await query(
    "SELECT COALESCE(SUM(total_amount),0) AS today_revenue FROM orders WHERE status = 'DELIVERED' AND DATE(delivered_at) = CURDATE()"
  );
  const [{ product_count }] = await query('SELECT COUNT(*) AS product_count FROM products WHERE is_deleted = 0 AND is_active = 1');
  const [{ low_stock_products }] = await query(
    'SELECT COUNT(*) AS low_stock_products FROM products WHERE is_deleted = 0 AND stock_quantity <= ?', [lowStockThreshold]
  );
  const [{ customer_reported_transfer }] = await query(
    "SELECT COUNT(*) AS customer_reported_transfer FROM orders WHERE status = 'AWAITING_PAYMENT_CONFIRMATION'"
  );

  const metrics = {
    revenue: Number(revenue),
    successful_orders,
    processing_orders: await countByStatus(['PENDING', 'CONFIRMED', 'PACKED', 'SHIPPED']),
    pending_orders: await countByStatus(['PENDING']),
    bank_transfer_pending: await countByStatus(['AWAITING_PAYMENT_CONFIRMATION']),
    customer_reported_transfer,
    shipping_orders: await countByStatus(['SHIPPED']),
    delivery_failed_orders: await countByStatus(['DELIVERY_FAILED']),
    low_stock_products,
    low_stock_threshold: lowStockThreshold,
    average_order_value: successful_orders > 0 ? Math.round(Number(revenue) / successful_orders) : 0,
    today_revenue: Number(today_revenue),
    product_count,
  };

  // Bieu do doanh thu theo ngay (so ngay tuy chart_range).
  const days = chartRange === '7d' ? 7 : chartRange === 'this_month' ? new Date().getDate() : 30;
  const revenueRows = await query(
    `SELECT DATE(delivered_at) AS d, COALESCE(SUM(total_amount),0) AS revenue, COUNT(*) AS successful_orders
     FROM orders WHERE status = 'DELIVERED' AND delivered_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
     GROUP BY DATE(delivered_at) ORDER BY d ASC`,
    [days]
  );
  const revenueMap = new Map(revenueRows.map((r) => [r.d, r]));
  const revenue_chart = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const key = date.toISOString().slice(0, 10);
    const row = revenueMap.get(key);
    revenue_chart.push({
      label: `${date.getDate()}/${date.getMonth() + 1}`,
      revenue: row ? Number(row.revenue) : 0,
      successful_orders: row ? row.successful_orders : 0,
    });
  }

  const top_customers = await query(
    `SELECT u.id, u.full_name, u.email, COUNT(o.id) AS successful_orders,
            COALESCE(SUM(o.total_amount),0) AS total_revenue, MAX(o.delivered_at) AS last_delivered_at
     FROM users u JOIN orders o ON o.user_id = u.id AND o.status = 'DELIVERED'
     GROUP BY u.id ORDER BY total_revenue DESC LIMIT 5`
  );

  const recentOrders = await query(
    `SELECT o.*, u.full_name AS customer_name,
            (SELECT payment_status FROM payments WHERE order_id = o.id ORDER BY id DESC LIMIT 1) AS payment_status
     FROM orders o LEFT JOIN users u ON u.id = o.user_id ORDER BY o.id DESC LIMIT 8`
  );
  const withCustomer = (o) => ({ ...o, customer: { full_name: o.customer_name }, total_amount: Number(o.total_amount) });
  const recent_orders = recentOrders.map(withCustomer);

  const queueGroups = [
    { key: 'pending', label: 'Chờ xác nhận', statuses: ['PENDING'] },
    { key: 'transfer', label: 'Chờ xác nhận chuyển khoản', statuses: ['AWAITING_PAYMENT_CONFIRMATION'] },
    { key: 'packing', label: 'Chờ đóng gói / giao', statuses: ['CONFIRMED', 'PACKED'] },
    { key: 'shipping', label: 'Đang giao', statuses: ['SHIPPED'] },
  ];
  const work_queue = [];
  for (const g of queueGroups) {
    const orders = await query(
      `SELECT o.*, u.full_name AS customer_name,
              (SELECT payment_status FROM payments WHERE order_id = o.id ORDER BY id DESC LIMIT 1) AS payment_status
       FROM orders o LEFT JOIN users u ON u.id = o.user_id
       WHERE o.status IN (${g.statuses.map(() => '?').join(',')}) ORDER BY o.id DESC LIMIT 5`,
      g.statuses
    );
    work_queue.push({ key: g.key, label: g.label, count: orders.length, orders: orders.map(withCustomer) });
  }

  const lowStockList = await query(
    'SELECT id, name, sku, sale_price, stock_quantity FROM products WHERE is_deleted = 0 AND stock_quantity <= ? ORDER BY stock_quantity ASC LIMIT 6',
    [lowStockThreshold]
  );

  const featured = await query(
    `SELECT p.id, p.sku, p.name, p.stock_quantity,
            COALESCE(SUM(oi.quantity),0) AS sold_quantity, COALESCE(SUM(oi.line_total),0) AS revenue
     FROM products p
     LEFT JOIN order_items oi ON oi.product_id = p.id
     LEFT JOIN orders o ON o.id = oi.order_id AND o.status = 'DELIVERED'
     WHERE p.is_deleted = 0
     GROUP BY p.id ORDER BY sold_quantity DESC, p.id DESC LIMIT 5`
  );

  res.json({
    data: {
      filters: { date_from: dateFrom, date_to: dateTo, chart_range: chartRange },
      metrics,
      revenue_chart,
      top_customers: top_customers.map((c) => ({ ...c, total_revenue: Number(c.total_revenue) })),
      work_queue,
      low_stock_products: lowStockList.map((p) => ({ ...p, sale_price: Number(p.sale_price) })),
      featured_products: featured.map((p) => ({ ...p, revenue: Number(p.revenue), sold_quantity: Number(p.sold_quantity) })),
      recent_orders,
    },
  });
});

// ---------------- Users ----------------
// Ghi chu: frontend (use-admin-user-store.js, da co san tu truoc) doc { data: [...] }
// va can them cot tinh toan "orders_count" tren tung user — khong co san trong DB nen
// JOIN dem tu bang orders. Xem PLAN_3_TUAN.md muc "Sua backend cho khop frontend".
const USER_LIST_SELECT = `
  SELECT u.*, COALESCE(o.orders_count, 0) AS orders_count
  FROM users u
  LEFT JOIN (SELECT user_id, COUNT(*) AS orders_count FROM orders GROUP BY user_id) o
    ON o.user_id = u.id
`;

function stripPasswordHash(user) {
  if (!user) return user;
  const { password_hash, ...rest } = user;
  return rest;
}

export const listUsers = asyncHandler(async (req, res) => {
  const rows = await query(`${USER_LIST_SELECT} WHERE u.is_deleted = 0 ORDER BY u.id DESC`);
  res.json({ data: rows.map(stripPasswordHash) });
});
export const showUser = asyncHandler(async (req, res) => {
  const [user] = await query(`${USER_LIST_SELECT} WHERE u.id = ?`, [req.params.user]);
  if (!user) return res.status(404).json({ message: 'Khong tim thay nguoi dung.' });
  res.json({ data: stripPasswordHash(user) });
});
export const userOrders = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const perPage = Math.max(1, Number(req.query.per_page) || 5);
  const [[{ total }]] = [await query('SELECT COUNT(*) AS total FROM orders WHERE user_id = ?', [req.params.user])];
  const rows = await query(
    'SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC LIMIT ? OFFSET ?',
    [req.params.user, perPage, (page - 1) * perPage]
  );
  res.json({
    data: rows,
    current_page: page,
    last_page: Math.max(1, Math.ceil(total / perPage)),
    per_page: perPage,
    total,
  });
});
export const storeUser = asyncHandler(async (req, res) => {
  const { full_name, email, phone, password, role = 'CUSTOMER' } = req.body;
  if (!full_name || !email || !phone || !password) {
    return res.status(422).json({ message: 'full_name, email, phone, password la bat buoc.' });
  }
  const password_hash = await bcrypt.hash(password, 10);
  const result = await query(
    'INSERT INTO users (full_name, email, phone, password_hash, role, created_by_admin_id) VALUES (?, ?, ?, ?, ?, ?)',
    [full_name, email, phone, password_hash, role, req.user.id]
  );
  const [user] = await query(`${USER_LIST_SELECT} WHERE u.id = ?`, [result.insertId]);
  res.status(201).json({ data: stripPasswordHash(user) });
});
export const updateUser = asyncHandler(async (req, res) => {
  const {
    full_name, phone, role, is_active, address, city, favorite_region, avatar_url,
    newsletter, sms_alerts, order_email, security_alerts, reward_points, reward_tier, next_tier_points,
  } = req.body;
  await query(
    `UPDATE users SET full_name = COALESCE(?, full_name), phone = COALESCE(?, phone),
       role = COALESCE(?, role), is_active = COALESCE(?, is_active),
       address = COALESCE(?, address), city = COALESCE(?, city),
       favorite_region = COALESCE(?, favorite_region), avatar_url = COALESCE(?, avatar_url),
       newsletter = COALESCE(?, newsletter), sms_alerts = COALESCE(?, sms_alerts),
       order_email = COALESCE(?, order_email), security_alerts = COALESCE(?, security_alerts),
       reward_points = COALESCE(?, reward_points), reward_tier = COALESCE(?, reward_tier),
       next_tier_points = COALESCE(?, next_tier_points)
     WHERE id = ?`,
    [full_name, phone, role, is_active, address, city, favorite_region, avatar_url,
      newsletter, sms_alerts, order_email, security_alerts, reward_points, reward_tier, next_tier_points,
      req.params.user]
  );
  const [user] = await query(`${USER_LIST_SELECT} WHERE u.id = ?`, [req.params.user]);
  res.json({ data: stripPasswordHash(user) });
});
export const destroyUser = asyncHandler(async (req, res) => {
  await query('UPDATE users SET is_active = 0 WHERE id = ?', [req.params.user]);
  const [user] = await query(`${USER_LIST_SELECT} WHERE u.id = ?`, [req.params.user]);
  res.json({ data: stripPasswordHash(user) });
});

// ---------------- Admin accounts ----------------
export const listAdmins = asyncHandler(async (req, res) => {
  const rows = await query(
    `SELECT u.id, u.full_name, u.email, u.is_active, ar.name AS admin_role
     FROM users u LEFT JOIN admin_roles ar ON ar.id = u.admin_role_id
     WHERE u.role = 'ADMIN' AND u.is_deleted = 0 ORDER BY u.id DESC`
  );
  res.json({ admins: rows });
});
export const storeAdmin = asyncHandler(async (req, res) => {
  const { full_name, email, phone, password, admin_role_id } = req.body;
  const password_hash = await bcrypt.hash(password, 10);
  const result = await query(
    `INSERT INTO users (full_name, email, phone, password_hash, role, admin_role_id, created_by_admin_id)
     VALUES (?, ?, ?, ?, 'ADMIN', ?, ?)`,
    [full_name, email, phone, password_hash, admin_role_id || null, req.user.id]
  );
  res.status(201).json({ id: result.insertId });
});
export const updateAdmin = asyncHandler(async (req, res) => {
  const { full_name, admin_role_id } = req.body;
  await query(
    'UPDATE users SET full_name = COALESCE(?, full_name), admin_role_id = COALESCE(?, admin_role_id) WHERE id = ?',
    [full_name, admin_role_id, req.params.admin]
  );
  res.json({ message: 'Da cap nhat admin.' });
});
export const updateAdminStatus = asyncHandler(async (req, res) => {
  await query('UPDATE users SET is_active = ? WHERE id = ?', [req.body.is_active, req.params.admin]);
  res.json({ message: 'Da cap nhat trang thai admin.' });
});
export const updateAdminPassword = asyncHandler(async (req, res) => {
  const password_hash = await bcrypt.hash(req.body.password, 10);
  await query('UPDATE users SET password_hash = ? WHERE id = ?', [password_hash, req.params.admin]);
  res.json({ message: 'Da doi mat khau admin.' });
});

// ---------------- Products (admin CRUD) ----------------
// Frontend (use-admin-catalog-store.js) doc { data } va can quan he long
// (product.category, product.supplier) de hien ten trong bang.
async function loadAdminProduct(id) {
  const [product] = await query(`${PRODUCT_SELECT} WHERE p.id = ?`, [id]);
  return product ? serializeProduct(product) : null;
}
function slugify(input) {
  return String(input).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
export const listProducts = asyncHandler(async (req, res) => {
  const rows = await query(`${PRODUCT_SELECT} WHERE p.is_deleted = 0 ORDER BY p.id DESC`);
  res.json({ data: serializeProducts(rows) });
});
export const showProduct = asyncHandler(async (req, res) => {
  const product = await loadAdminProduct(req.params.id);
  if (!product) return res.status(404).json({ message: 'Khong tim thay san pham.' });
  res.json({ data: product });
});
export const storeProduct = asyncHandler(async (req, res) => {
  const {
    category_id, supplier_id, region_id, sku, name, description, short_description,
    origin, image_url, sale_price, stock_quantity = 0, is_active = true,
  } = req.body;
  let { slug } = req.body;
  if (!name || !category_id) return res.status(422).json({ message: 'Ten va danh muc la bat buoc.' });
  slug = slug || `${slugify(name)}-${Date.now()}`;
  const result = await query(
    `INSERT INTO products (category_id, supplier_id, region_id, sku, slug, name, description,
       short_description, origin, image_url, sale_price, stock_quantity, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [category_id, supplier_id || null, region_id || null, sku || null, slug, name,
      description || null, short_description || null, origin || null, image_url || null,
      sale_price || 0, stock_quantity, is_active ? 1 : 0]
  );
  // TODO: index san pham nay vao Elasticsearch tai day (esClient.index) de fuzzy search cap nhat kip thoi.
  res.status(201).json({ data: await loadAdminProduct(result.insertId) });
});
export const updateProduct = asyncHandler(async (req, res) => {
  const fields = ['category_id', 'supplier_id', 'region_id', 'sku', 'name', 'description',
    'short_description', 'origin', 'image_url', 'sale_price', 'stock_quantity'];
  const updates = [];
  const params = [];
  for (const f of fields) {
    if (req.body[f] !== undefined) { updates.push(`${f} = ?`); params.push(req.body[f]); }
  }
  if (req.body.is_active !== undefined) { updates.push('is_active = ?'); params.push(req.body.is_active ? 1 : 0); }
  if (req.body.is_deleted !== undefined) { updates.push('is_deleted = ?'); params.push(req.body.is_deleted ? 1 : 0); }
  if (updates.length) {
    params.push(req.params.id);
    await query(`UPDATE products SET ${updates.join(', ')} WHERE id = ?`, params);
  }
  res.json({ data: await loadAdminProduct(req.params.id) });
});
export const updateProductStatus = asyncHandler(async (req, res) => {
  await query('UPDATE products SET is_active = ? WHERE id = ?', [req.body.is_active ? 1 : 0, req.params.id]);
  res.json({ data: await loadAdminProduct(req.params.id) });
});
export const destroyProduct = asyncHandler(async (req, res) => {
  // "Xoa" = an san pham (is_active=0) de van hien trong danh sach admin voi trang thai Tam dung.
  await query('UPDATE products SET is_active = 0 WHERE id = ?', [req.params.id]);
  res.json({ data: await loadAdminProduct(req.params.id) });
});

// ---------------- Orders (admin) — UC 2.2.17 Quan ly don hang ----------------
// Frontend (admin-logistics-page.jsx + use-admin-orders-store.js) doc { data } voi
// customer/payment/shipment long, allowed_next_statuses (state machine),
// allowed_payment_statuses, status_history, payment_status_history.

const ORDER_TRANSITIONS = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  AWAITING_PAYMENT_CONFIRMATION: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PACKED', 'CANCELLED'],
  PACKED: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED', 'DELIVERY_FAILED'],
  DELIVERY_FAILED: ['SHIPPED', 'CANCELLED'],
  DELIVERED: [],
  CANCELLED: [],
};
const PAYMENT_TRANSITIONS = {
  PENDING: ['SUCCESS', 'FAILED'],
  FAILED: ['PENDING', 'SUCCESS'],
  SUCCESS: ['REFUNDED'],
  REFUNDED: [],
};
const BULK_ACTION_STATUS = {
  CONFIRM: 'CONFIRMED', SHIP: 'SHIPPED', DELIVER: 'DELIVERED',
  MARK_DELIVERY_FAILED: 'DELIVERY_FAILED', CANCEL: 'CANCELLED', RESHIP: 'SHIPPED',
};

async function notifyOrderUser(order, title, message) {
  await query(
    'INSERT INTO notifications (user_id, type, title, message, link_url) VALUES (?, ?, ?, ?, ?)',
    [order.user_id, 'ORDER_STATUS', title, message, `/account/orders/${order.id}`]
  );
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

// ---------------- Order shipment (UC 2.2.17) ----------------
// GHN that can token; khong co token -> tao van don thu cong (manual) + tracking mock.
export const storeShipment = asyncHandler(async (req, res) => {
  const {
    shipping_carrier_id, tracking_code, tracking_url, weight, length, width, height,
  } = req.body;
  const [carrier] = await query('SELECT * FROM shipping_carriers WHERE id = ?', [shipping_carrier_id]);
  const trackingCode = tracking_code || `${carrier?.code || 'SHIP'}${Date.now()}`;
  await query(
    `INSERT INTO order_shipments (order_id, shipping_carrier_id, provider, status, tracking_code, tracking_url,
       weight, length, width, height, created_by_user_id)
     VALUES (?, ?, ?, 'created', ?, ?, ?, ?, ?, ?, ?)`,
    [req.params.order, shipping_carrier_id, carrier?.provider || 'MANUAL', trackingCode, tracking_url || null,
      weight || null, length || null, width || null, height || null, req.user.id]
  );
  res.status(201).json({ data: await loadAdminOrderDetail(req.params.order) });
});
export const syncShipment = asyncHandler(async (req, res) => {
  // GHN sandbox chua noi — chi cap nhat synced_at de UI phan anh (xem README muc GHTK/GHN).
  await query('UPDATE order_shipments SET synced_at = NOW() WHERE order_id = ?', [req.params.order]);
  res.json({ data: await loadAdminOrderDetail(req.params.order) });
});
export const destroyShipment = asyncHandler(async (req, res) => {
  await query('UPDATE order_shipments SET cancelled_at = NOW() WHERE order_id = ?', [req.params.order]);
  await query('DELETE FROM order_shipments WHERE order_id = ?', [req.params.order]);
  res.json({ data: await loadAdminOrderDetail(req.params.order) });
});

// ---------------- Shipping carriers ----------------
export const listShippingCarriers = asyncHandler(async (req, res) => {
  const onlyActive = req.query.active_only === 'true' || req.query.active_only === '1';
  const rows = await query(
    `SELECT * FROM shipping_carriers WHERE is_deleted = 0 ${onlyActive ? 'AND is_active = 1' : ''} ORDER BY id DESC`
  );
  res.json({ data: rows });
});
export const storeShippingCarrier = asyncHandler(async (req, res) => {
  const { code, name, provider = 'MANUAL' } = req.body;
  const result = await query('INSERT INTO shipping_carriers (code, name, provider) VALUES (?, ?, ?)', [
    code, name, provider,
  ]);
  const [carrier] = await query('SELECT * FROM shipping_carriers WHERE id = ?', [result.insertId]);
  res.status(201).json({ data: carrier });
});
export const updateShippingCarrier = asyncHandler(async (req, res) => {
  const { name, is_active } = req.body;
  await query(
    'UPDATE shipping_carriers SET name = COALESCE(?, name), is_active = COALESCE(?, is_active) WHERE id = ?',
    [name ?? null, is_active === undefined ? null : (is_active ? 1 : 0), req.params.carrier]
  );
  const [carrier] = await query('SELECT * FROM shipping_carriers WHERE id = ?', [req.params.carrier]);
  res.json({ data: carrier });
});
export const destroyShippingCarrier = asyncHandler(async (req, res) => {
  await query('UPDATE shipping_carriers SET is_deleted = 1 WHERE id = ?', [req.params.carrier]);
  const [carrier] = await query('SELECT * FROM shipping_carriers WHERE id = ?', [req.params.carrier]);
  res.json({ data: carrier });
});

// ---------------- Settings ----------------
export const showSettings = asyncHandler(async (req, res) => {
  const [settings] = await query('SELECT * FROM admin_settings WHERE user_id = ?', [req.user.id]);
  res.json({ settings: settings || null });
});
export const updateSettings = asyncHandler(async (req, res) => {
  const { store_name, support_email, support_phone, low_stock_threshold } = req.body;
  await query(
    `INSERT INTO admin_settings (user_id, store_name, support_email, support_phone, low_stock_threshold)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE store_name = VALUES(store_name), support_email = VALUES(support_email),
       support_phone = VALUES(support_phone), low_stock_threshold = VALUES(low_stock_threshold)`,
    [req.user.id, store_name, support_email, support_phone, low_stock_threshold]
  );
  res.json({ message: 'Da cap nhat cai dat.' });
});

// ---------------- Community (moi NCC + kiem duyet bai viet) ----------------
export const listCommunity = asyncHandler(async (req, res) => {
  const invitations = await query('SELECT * FROM supplier_invitations ORDER BY id DESC');
  res.json({ invitations });
});
export const storeInvitation = asyncHandler(async (req, res) => {
  const { supplier_name, contact_name, email, note } = req.body;
  const result = await query(
    'INSERT INTO supplier_invitations (supplier_name, contact_name, email, note, created_by_user_id) VALUES (?, ?, ?, ?, ?)',
    [supplier_name, contact_name, email, note || null, req.user.id]
  );
  res.status(201).json({ id: result.insertId });
});

// ---------------- Admin posts CRUD ----------------
export const listAdminPosts = asyncHandler(async (req, res) => {
  const rows = await query('SELECT * FROM posts ORDER BY id DESC');
  res.json({ posts: rows });
});
export const storePost = asyncHandler(async (req, res) => {
  const { title, excerpt, body, cover_image_url, status = 'DRAFT' } = req.body;
  const result = await query(
    `INSERT INTO posts (created_by_user_id, title, excerpt, body, cover_image_url, status, published_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [req.user.id, title, excerpt || null, body, cover_image_url || null, status, status === 'PUBLISHED' ? new Date() : null]
  );
  res.status(201).json({ id: result.insertId });
});
export const updatePost = asyncHandler(async (req, res) => {
  const { title, excerpt, body, status } = req.body;
  await query(
    'UPDATE posts SET title = COALESCE(?, title), excerpt = COALESCE(?, excerpt), body = COALESCE(?, body), status = COALESCE(?, status) WHERE id = ?',
    [title, excerpt, body, status, req.params.post]
  );
  res.json({ message: 'Da cap nhat bai viet.' });
});
export const destroyPost = asyncHandler(async (req, res) => {
  await query('DELETE FROM posts WHERE id = ?', [req.params.post]);
  res.json({ message: 'Da xoa bai viet.' });
});
export const updateCommentVisibility = asyncHandler(async (req, res) => {
  const { status } = req.body; // 'VISIBLE' | 'HIDDEN'
  await query(
    'UPDATE post_comments SET status = ?, hidden_by_user_id = ?, hidden_at = NOW() WHERE id = ?',
    [status, req.user.id, req.params.comment]
  );
  res.json({ message: 'Da cap nhat trang thai binh luan.' });
});
