import bcrypt from 'bcryptjs';
import { query } from '../config/db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { PRODUCT_SELECT, serializeProduct, serializeProducts } from '../utils/serializers.js';
import { indexProduct } from '../utils/productIndex.js';

// --- UC 2.2.15 (phần NCC): NCC quản lý sản phẩm CỦA MÌNH ---
async function currentSupplierId(req) {
  const [supplier] = await query(
    "SELECT id FROM suppliers WHERE user_id = ? AND status = 'APPROVED' LIMIT 1", [req.user.id]
  );
  return supplier ? supplier.id : null;
}
// Chuyển tên sản phẩm (có dấu) thành slug URL-safe: normalize('NFD') tách chữ cái khỏi
// dấu thanh (vd "á" -> "a" + dấu sắc riêng), regex sau đó xóa các dấu đã tách; "đ" phải
// thay tay vì Unicode không tách "đ" thành "d" + dấu như các chữ có dấu khác; cuối cùng
// thay mọi ký tự không phải a-z0-9 bằng "-" và cắt "-" thừa ở 2 đầu.
function slugify(input) {
  return String(input).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export const myProducts = asyncHandler(async (req, res) => {
  const supplierId = await currentSupplierId(req);
  if (!supplierId) return res.status(403).json({ message: 'Tài khoản chưa gắn với Nhà cung cấp đã duyệt.' });
  const rows = await query(`${PRODUCT_SELECT} WHERE p.supplier_id = ? AND p.is_deleted = 0 ORDER BY p.id DESC`, [supplierId]);
  res.json({ data: serializeProducts(rows) });
});

export const storeMyProduct = asyncHandler(async (req, res) => {
  const supplierId = await currentSupplierId(req);
  if (!supplierId) return res.status(403).json({ message: 'Tài khoản chưa gắn với Nhà cung cấp đã duyệt.' });
  const { category_id, region_id, sku, name, description, short_description, origin, image_url,
    sale_price, stock_quantity = 0 } = req.body;
  if (!name || !category_id) return res.status(422).json({ message: 'Tên và danh mục là bắt buộc.' });
  const slug = `${slugify(name)}-${Date.now()}`;
  // Tự sinh SKU nếu NCC không nhập (tránh sku null -> lỗi khi lọc/hiển thị).
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

// UC "Báo cáo doanh thu cho NCC": doanh thu từ đơn ĐÃ GIAO chứa sản phẩm của NCC.
export const myRevenue = asyncHandler(async (req, res) => {
  const supplierId = await currentSupplierId(req);
  if (!supplierId) return res.status(403).json({ message: 'Tài khoản chưa gắn với Nhà cung cấp đã duyệt.' });

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
  // Query trên chỉ trả về NGÀY CÓ DOANH THU (GROUP BY), nên phải tự dựng đủ 30 ngày liên
  // tiếp ở đây và tra revenueMap — ngày nào không bán được gì thì mặc định revenue = 0,
  // để biểu đồ trên frontend không bị "gãy khúc" ở những ngày không có đơn.
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
  if (!supplierId) return res.status(403).json({ message: 'Tài khoản chưa gắn với Nhà cung cấp đã duyệt.' });
  // Chỉ cho sửa sản phẩm CỦA CHÍNH NCC này.
  const [owned] = await query('SELECT id FROM products WHERE id = ? AND supplier_id = ?', [req.params.id, supplierId]);
  if (!owned) return res.status(403).json({ message: 'Bạn chỉ có thể sửa sản phẩm của mình.' });
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

// Chỉ liệt kê NCC đã duyệt (APPROVED) cho storefront. Frontend đọc { data: [...] }.
export const index = asyncHandler(async (req, res) => {
  const rows = await query(
    "SELECT * FROM suppliers WHERE is_active = 1 AND is_deleted = 0 AND status = 'APPROVED' ORDER BY name"
  );
  res.json({ data: rows });
});

export const show = asyncHandler(async (req, res) => {
  const [supplier] = await query('SELECT * FROM suppliers WHERE id = ? AND is_deleted = 0', [req.params.supplier]);
  if (!supplier) return res.status(404).json({ message: 'Không tìm thấy nhà cung cấp.' });
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
  if (!name) return res.status(422).json({ message: 'Tên nhà cung cấp là bắt buộc.' });
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

// ---------------- UC 2.2.12a: Đăng ký Nhà cung cấp (public, self-service) ----------------
// POST /api/suppliers/apply (multipart/form-data, field file: license_file)
// Tạo CÙNG LÚC 2 bản ghi: users (role SUPPLIER, is_active=0 -> chưa đăng nhập được) và
// suppliers (status='PENDING') liên kết qua user_id, rồi báo cho mọi Admin để xét duyệt
// (approve()/reject() bên dưới). File giấy phép đã được middleware upload.js xử lý trước
// khi vào tới đây — req.file.filename là tên file đã lưu trên đĩa.
export const apply = asyncHandler(async (req, res) => {
  const {
    name, contact_name, phone, email, address, region_id, category_id, note,
    password, password_confirmation,
  } = req.body;

  if (!name || !contact_name || !phone || !email || !address || !password) {
    return res.status(422).json({ message: 'Vui lòng nhập đầy đủ thông tin bắt buộc.' });
  }
  if (password !== password_confirmation) {
    return res.status(422).json({ message: 'Mật khẩu xác nhận chưa khớp.' });
  }

  const [existingSupplier] = await query(
    "SELECT id FROM suppliers WHERE email = ? AND status IN ('PENDING','APPROVED') LIMIT 1",
    [email]
  );
  const [existingUser] = await query('SELECT id FROM users WHERE email = ? OR phone = ? LIMIT 1', [email, phone]);
  if (existingSupplier || existingUser) {
    return res.status(422).json({ message: 'Nhà cung cấp đã tồn tại trong hệ thống hoặc đang chờ duyệt.' });
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
       VALUES (?, 'SUPPLIER_APPLICATION', 'Yêu cầu đăng ký Nhà cung cấp mới', ?, '/admin/suppliers?tab=pending')`,
      [admin.id, `${name} vừa gửi yêu cầu đăng ký làm Nhà cung cấp.`]
    );
  }

  res.status(201).json({
    id: supplierResult.insertId,
    message: 'Đăng ký thành công, vui lòng chờ Admin xét duyệt.',
  });
});

// ---------------- UC 2.2.12b: Duyệt đăng ký Nhà cung cấp (Admin) ----------------
export const pending = asyncHandler(async (req, res) => {
  const rows = await query("SELECT * FROM suppliers WHERE status = 'PENDING' ORDER BY id DESC");
  res.json({ suppliers: rows });
});

export const approve = asyncHandler(async (req, res) => {
  const [supplier] = await query('SELECT * FROM suppliers WHERE id = ?', [req.params.supplier]);
  if (!supplier) return res.status(404).json({ message: 'Không tìm thấy yêu cầu đăng ký.' });
  // Chặn duyệt/từ chối 2 lần (vd 2 admin cùng bấm gần như đồng thời) — chỉ xử lý được khi
  // status vẫn đang PENDING.
  if (supplier.status !== 'PENDING') {
    return res.status(422).json({ message: 'Yêu cầu này đã được xử lý trước đó.' });
  }

  await query(
    `UPDATE suppliers SET status = 'APPROVED', is_active = 1,
       approved_by_user_id = ?, approved_at = NOW() WHERE id = ?`,
    [req.user.id, supplier.id]
  );
  if (supplier.user_id) {
    // Kích hoạt luôn tài khoản user liên kết (is_active=0 lúc apply() -> 1) để NCC đăng nhập được.
    await query('UPDATE users SET is_active = 1 WHERE id = ?', [supplier.user_id]);
    await query(
      `INSERT INTO notifications (user_id, type, title, message)
       VALUES (?, 'SUPPLIER_APPROVED', 'Yêu cầu đăng ký NCC đã được duyệt', 'Bạn có thể đăng nhập và quản lý sản phẩm ngay bây giờ.')`,
      [supplier.user_id]
    );
  }
  res.json({ message: 'Đã duyệt yêu cầu đăng ký Nhà cung cấp.' });
});

export const reject = asyncHandler(async (req, res) => {
  const { reason } = req.body;
  const [supplier] = await query('SELECT * FROM suppliers WHERE id = ?', [req.params.supplier]);
  if (!supplier) return res.status(404).json({ message: 'Không tìm thấy yêu cầu đăng ký.' });
  if (supplier.status !== 'PENDING') {
    return res.status(422).json({ message: 'Yêu cầu này đã được xử lý trước đó.' });
  }

  await query(
    `UPDATE suppliers SET status = 'REJECTED', rejected_reason = ?,
       approved_by_user_id = ?, approved_at = NOW() WHERE id = ?`,
    [reason || null, req.user.id, supplier.id]
  );
  if (supplier.user_id) {
    await query(
      `INSERT INTO notifications (user_id, type, title, message)
       VALUES (?, 'SUPPLIER_REJECTED', 'Yêu cầu đăng ký NCC bị từ chối', ?)`,
      [supplier.user_id, reason || 'Yêu cầu đăng ký của bạn không được chấp thuận.']
    );
  }
  res.json({ message: 'Đã từ chối yêu cầu đăng ký Nhà cung cấp.' });
});
