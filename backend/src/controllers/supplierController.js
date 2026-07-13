import bcrypt from 'bcryptjs';
import { query } from '../config/db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { PRODUCT_SELECT, serializeProduct, serializeProducts } from '../utils/serializers.js';
import { indexProduct } from '../utils/productIndex.js';

// --- UC 2.2.15 (phan NCC): NCC quan ly san pham CUA MINH ---
async function currentSupplierId(req) {
  const [supplier] = await query(
    "SELECT id FROM suppliers WHERE user_id = ? AND status = 'APPROVED' LIMIT 1", [req.user.id]
  );
  return supplier ? supplier.id : null;
}
function slugify(input) {
  return String(input).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export const myProducts = asyncHandler(async (req, res) => {
  const supplierId = await currentSupplierId(req);
  if (!supplierId) return res.status(403).json({ message: 'Tai khoan chua gan voi Nha cung cap da duyet.' });
  const rows = await query(`${PRODUCT_SELECT} WHERE p.supplier_id = ? AND p.is_deleted = 0 ORDER BY p.id DESC`, [supplierId]);
  res.json({ data: serializeProducts(rows) });
});

export const storeMyProduct = asyncHandler(async (req, res) => {
  const supplierId = await currentSupplierId(req);
  if (!supplierId) return res.status(403).json({ message: 'Tai khoan chua gan voi Nha cung cap da duyet.' });
  const { category_id, region_id, sku, name, description, short_description, origin, image_url,
    sale_price, stock_quantity = 0 } = req.body;
  if (!name || !category_id) return res.status(422).json({ message: 'Ten va danh muc la bat buoc.' });
  const slug = `${slugify(name)}-${Date.now()}`;
  // Tu sinh SKU neu NCC khong nhap (tranh sku null -> loi khi loc/hien thi).
  const finalSku = (sku && sku.trim()) || `SP${Date.now().toString().slice(-6)}`;
  const result = await query(
    `INSERT INTO products (category_id, supplier_id, region_id, sku, slug, name, description,
       short_description, origin, image_url, sale_price, stock_quantity, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    [category_id, supplierId, region_id || null, finalSku, slug, name, description || null,
      short_description || null, origin || null, image_url || null, sale_price || 0, stock_quantity]
  );
  await indexProduct(result.insertId);
  const [row] = await query(`${PRODUCT_SELECT} WHERE p.id = ?`, [result.insertId]);
  res.status(201).json({ data: serializeProduct(row) });
});

// UC "Bao cao doanh thu cho NCC": doanh thu tu don DA GIAO chua san pham cua NCC.
export const myRevenue = asyncHandler(async (req, res) => {
  const supplierId = await currentSupplierId(req);
  if (!supplierId) return res.status(403).json({ message: 'Tai khoan chua gan voi Nha cung cap da duyet.' });

  const [{ total_revenue, units_sold }] = await query(
    `SELECT COALESCE(SUM(oi.line_total),0) AS total_revenue, COALESCE(SUM(oi.quantity),0) AS units_sold
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id AND o.status = 'DELIVERED'
     JOIN products p ON p.id = oi.product_id AND p.supplier_id = ?`,
    [supplierId]
  );
  const [{ order_count }] = await query(
    `SELECT COUNT(DISTINCT o.id) AS order_count
     FROM orders o JOIN order_items oi ON oi.order_id = o.id
     JOIN products p ON p.id = oi.product_id AND p.supplier_id = ?
     WHERE o.status = 'DELIVERED'`,
    [supplierId]
  );
  const [{ product_count }] = await query(
    'SELECT COUNT(*) AS product_count FROM products WHERE supplier_id = ? AND is_deleted = 0', [supplierId]
  );

  const topProducts = await query(
    `SELECT p.id, p.name, p.sku, COALESCE(SUM(oi.quantity),0) AS sold_quantity,
            COALESCE(SUM(oi.line_total),0) AS revenue
     FROM products p
     LEFT JOIN order_items oi ON oi.product_id = p.id
     LEFT JOIN orders o ON o.id = oi.order_id AND o.status = 'DELIVERED'
     WHERE p.supplier_id = ? AND p.is_deleted = 0
     GROUP BY p.id ORDER BY revenue DESC LIMIT 10`,
    [supplierId]
  );

  const revenueRows = await query(
    `SELECT DATE(o.delivered_at) AS d, COALESCE(SUM(oi.line_total),0) AS revenue
     FROM orders o JOIN order_items oi ON oi.order_id = o.id
     JOIN products p ON p.id = oi.product_id AND p.supplier_id = ?
     WHERE o.status = 'DELIVERED' AND o.delivered_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
     GROUP BY DATE(o.delivered_at) ORDER BY d ASC`,
    [supplierId]
  );
  const revenueMap = new Map(revenueRows.map((r) => [r.d, Number(r.revenue)]));
  const revenue_chart = [];
  for (let i = 29; i >= 0; i -= 1) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const key = date.toISOString().slice(0, 10);
    revenue_chart.push({ label: `${date.getDate()}/${date.getMonth() + 1}`, revenue: revenueMap.get(key) || 0 });
  }

  res.json({
    data: {
      total_revenue: Number(total_revenue),
      units_sold: Number(units_sold),
      order_count,
      product_count,
      average_order_value: order_count > 0 ? Math.round(Number(total_revenue) / order_count) : 0,
      top_products: topProducts.map((p) => ({ ...p, sold_quantity: Number(p.sold_quantity), revenue: Number(p.revenue) })),
      revenue_chart,
    },
  });
});

export const updateMyProduct = asyncHandler(async (req, res) => {
  const supplierId = await currentSupplierId(req);
  if (!supplierId) return res.status(403).json({ message: 'Tai khoan chua gan voi Nha cung cap da duyet.' });
  // Chi cho sua san pham CUA CHINH NCC nay.
  const [owned] = await query('SELECT id FROM products WHERE id = ? AND supplier_id = ?', [req.params.id, supplierId]);
  if (!owned) return res.status(403).json({ message: 'Ban chi co the sua san pham cua minh.' });
  const fields = ['category_id', 'region_id', 'sku', 'name', 'description', 'short_description',
    'origin', 'image_url', 'sale_price', 'stock_quantity'];
  const updates = [];
  const params = [];
  for (const f of fields) {
    if (req.body[f] !== undefined) { updates.push(`${f} = ?`); params.push(req.body[f]); }
  }
  if (req.body.is_active !== undefined) { updates.push('is_active = ?'); params.push(req.body.is_active ? 1 : 0); }
  if (updates.length) {
    params.push(req.params.id);
    await query(`UPDATE products SET ${updates.join(', ')} WHERE id = ?`, params);
  }
  await indexProduct(req.params.id);
  const [row] = await query(`${PRODUCT_SELECT} WHERE p.id = ?`, [req.params.id]);
  res.json({ data: serializeProduct(row) });
});

// Chi liet ke NCC da duyet (APPROVED) cho storefront. Frontend doc { data: [...] }.
export const index = asyncHandler(async (req, res) => {
  const rows = await query(
    "SELECT * FROM suppliers WHERE is_active = 1 AND is_deleted = 0 AND status = 'APPROVED' ORDER BY name"
  );
  res.json({ data: rows });
});

export const show = asyncHandler(async (req, res) => {
  const [supplier] = await query('SELECT * FROM suppliers WHERE id = ? AND is_deleted = 0', [req.params.supplier]);
  if (!supplier) return res.status(404).json({ message: 'Khong tim thay nha cung cap.' });
  res.json({ data: supplier });
});

export const getProducts = asyncHandler(async (req, res) => {
  const rows = await query(
    `${PRODUCT_SELECT} WHERE p.supplier_id = ? AND p.is_active = 1 AND p.is_deleted = 0 ORDER BY p.id DESC`,
    [req.params.supplier]
  );
  res.json({ data: serializeProducts(rows) });
});

// --- Admin ---
export const adminIndex = asyncHandler(async (req, res) => {
  const rows = await query('SELECT * FROM suppliers WHERE is_deleted = 0 ORDER BY id DESC');
  res.json({ data: rows });
});

export const store = asyncHandler(async (req, res) => {
  const { supplier_code, name, contact_name, phone, email, address } = req.body;
  if (!name) return res.status(422).json({ message: 'Ten nha cung cap la bat buoc.' });
  const result = await query(
    `INSERT INTO suppliers (supplier_code, name, contact_name, phone, email, address, status, approved_at)
     VALUES (?, ?, ?, ?, ?, ?, 'APPROVED', NOW())`,
    [supplier_code || null, name, contact_name || null, phone || null, email || null, address || null]
  );
  const [supplier] = await query('SELECT * FROM suppliers WHERE id = ?', [result.insertId]);
  res.status(201).json({ data: supplier });
});

export const update = asyncHandler(async (req, res) => {
  const { supplier_code, name, contact_name, phone, email, address, is_active, is_deleted } = req.body;
  await query(
    `UPDATE suppliers SET supplier_code = COALESCE(?, supplier_code), name = COALESCE(?, name),
       contact_name = COALESCE(?, contact_name), phone = COALESCE(?, phone), email = COALESCE(?, email),
       address = COALESCE(?, address), is_active = COALESCE(?, is_active), is_deleted = COALESCE(?, is_deleted)
     WHERE id = ?`,
    [supplier_code ?? null, name ?? null, contact_name ?? null, phone ?? null, email ?? null, address ?? null,
      is_active === undefined ? null : (is_active ? 1 : 0),
      is_deleted === undefined ? null : (is_deleted ? 1 : 0), req.params.supplier]
  );
  const [supplier] = await query('SELECT * FROM suppliers WHERE id = ?', [req.params.supplier]);
  res.json({ data: supplier });
});

export const destroy = asyncHandler(async (req, res) => {
  await query('UPDATE suppliers SET is_active = 0 WHERE id = ?', [req.params.supplier]);
  const [supplier] = await query('SELECT * FROM suppliers WHERE id = ?', [req.params.supplier]);
  res.json({ data: supplier });
});

// ---------------- UC 2.2.12a: Dang ky Nha cung cap (public, self-service) ----------------
// POST /api/suppliers/apply (multipart/form-data, field file: license_file)
export const apply = asyncHandler(async (req, res) => {
  const {
    name, contact_name, phone, email, address, region_id, category_id, note,
    password, password_confirmation,
  } = req.body;

  if (!name || !contact_name || !phone || !email || !address || !password) {
    return res.status(422).json({ message: 'Vui long nhap day du thong tin bat buoc.' });
  }
  if (password !== password_confirmation) {
    return res.status(422).json({ message: 'Mat khau xac nhan chua khop.' });
  }

  const [existingSupplier] = await query(
    "SELECT id FROM suppliers WHERE email = ? AND status IN ('PENDING','APPROVED') LIMIT 1",
    [email]
  );
  const [existingUser] = await query('SELECT id FROM users WHERE email = ? OR phone = ? LIMIT 1', [email, phone]);
  if (existingSupplier || existingUser) {
    return res.status(422).json({ message: 'Nha cung cap da ton tai trong he thong hoac dang cho duyet.' });
  }

  const password_hash = await bcrypt.hash(password, 10);
  const licenseFileUrl = req.file ? `/uploads/supplier-licenses/${req.file.filename}` : null;

  const userResult = await query(
    `INSERT INTO users (full_name, email, phone, password_hash, role, is_active)
     VALUES (?, ?, ?, ?, 'SUPPLIER', 0)`,
    [contact_name, email, phone, password_hash]
  );
  const userId = userResult.insertId;

  const supplierResult = await query(
    `INSERT INTO suppliers
       (name, contact_name, phone, email, address, region_id, category_id, license_file_url, note, user_id, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
    [name, contact_name, phone, email, address, region_id || null, category_id || null, licenseFileUrl, note || null, userId]
  );

  const admins = await query("SELECT id FROM users WHERE role = 'ADMIN' AND is_deleted = 0");
  for (const admin of admins) {
    await query(
      `INSERT INTO notifications (user_id, type, title, message, link_url)
       VALUES (?, 'SUPPLIER_APPLICATION', 'Yeu cau dang ky Nha cung cap moi', ?, '/admin/suppliers?tab=pending')`,
      [admin.id, `${name} vua gui yeu cau dang ky lam Nha cung cap.`]
    );
  }

  res.status(201).json({
    id: supplierResult.insertId,
    message: 'Dang ky thanh cong, vui long cho Admin xet duyet.',
  });
});

// ---------------- UC 2.2.12b: Duyet dang ky Nha cung cap (Admin) ----------------
export const pending = asyncHandler(async (req, res) => {
  const rows = await query("SELECT * FROM suppliers WHERE status = 'PENDING' ORDER BY id DESC");
  res.json({ suppliers: rows });
});

export const approve = asyncHandler(async (req, res) => {
  const [supplier] = await query('SELECT * FROM suppliers WHERE id = ?', [req.params.supplier]);
  if (!supplier) return res.status(404).json({ message: 'Khong tim thay yeu cau dang ky.' });
  if (supplier.status !== 'PENDING') {
    return res.status(422).json({ message: 'Yeu cau nay da duoc xu ly truoc do.' });
  }

  await query(
    `UPDATE suppliers SET status = 'APPROVED', is_active = 1,
       approved_by_user_id = ?, approved_at = NOW() WHERE id = ?`,
    [req.user.id, supplier.id]
  );
  if (supplier.user_id) {
    await query('UPDATE users SET is_active = 1 WHERE id = ?', [supplier.user_id]);
    await query(
      `INSERT INTO notifications (user_id, type, title, message)
       VALUES (?, 'SUPPLIER_APPROVED', 'Yeu cau dang ky NCC da duoc duyet', 'Ban co the dang nhap va quan ly san pham ngay bay gio.')`,
      [supplier.user_id]
    );
  }
  res.json({ message: 'Da duyet yeu cau dang ky Nha cung cap.' });
});

export const reject = asyncHandler(async (req, res) => {
  const { reason } = req.body;
  const [supplier] = await query('SELECT * FROM suppliers WHERE id = ?', [req.params.supplier]);
  if (!supplier) return res.status(404).json({ message: 'Khong tim thay yeu cau dang ky.' });
  if (supplier.status !== 'PENDING') {
    return res.status(422).json({ message: 'Yeu cau nay da duoc xu ly truoc do.' });
  }

  await query(
    `UPDATE suppliers SET status = 'REJECTED', rejected_reason = ?,
       approved_by_user_id = ?, approved_at = NOW() WHERE id = ?`,
    [reason || null, req.user.id, supplier.id]
  );
  if (supplier.user_id) {
    await query(
      `INSERT INTO notifications (user_id, type, title, message)
       VALUES (?, 'SUPPLIER_REJECTED', 'Yeu cau dang ky NCC bi tu choi', ?)`,
      [supplier.user_id, reason || 'Yeu cau dang ky cua ban khong duoc chap thuan.']
    );
  }
  res.json({ message: 'Da tu choi yeu cau dang ky Nha cung cap.' });
});
