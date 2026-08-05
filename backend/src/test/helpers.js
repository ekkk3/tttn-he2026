// Tien ich dung chung cho cac file test tich hop: dung INSERT thang vao DB test roi ky
// JWT tuong ung (nhanh hon goi that /api/register + /api/login o moi test), vi middleware
// auth() doc lai role/is_active tu DB nen ban ghi user PHAI ton tai that (xem auth.js).
import bcrypt from 'bcryptjs';
import { query } from '../config/db.js';
import { signToken } from '../utils/jwt.js';

let counter = 0;
// ID ngan gon, DUY NHAT trong pham vi 1 lan chay test (khong dung Date.now() de tranh
// trung khi nhieu dong goi cung mot lenh tao du lieu trong cung 1 tick).
export function uniqueSuffix() {
  counter += 1;
  return `${Date.now()}${counter}`;
}

// Rieng cho so dien thoai (cot VARCHAR(20), regex chi nhan 10-11 chu so): KHONG duoc cat
// chuoi uniqueSuffix() bang slice(0, N) vi phan DAU cua Date.now() gan nhu khong doi giua
// cac lan goi trong cung 1 lan chay test - phai giu phan CUOI (counter) moi thuc su khac
// nhau. Modulo + zero-pad de luon ra dung 8 chu so, ghep sau "09" thanh SDT hop le 10 so.
export function uniquePhone() {
  counter += 1;
  const eightDigits = String((Date.now() + counter) % 100_000_000).padStart(8, '0');
  return `09${eightDigits}`;
}

const PASSWORD_HASH_CACHE = new Map();
// Bam bcrypt ton vai tram ms/lan - cache lai theo mat khau de cac test dung chung 1 mat
// khau mac dinh khong phai bam lai moi lan tao user.
export async function hashPassword(password) {
  if (!PASSWORD_HASH_CACHE.has(password)) {
    PASSWORD_HASH_CACHE.set(password, await bcrypt.hash(password, 4)); // cost thap cho test nhanh
  }
  return PASSWORD_HASH_CACHE.get(password);
}

export async function createUser({
  role = 'CUSTOMER',
  fullName = `Test User ${uniqueSuffix()}`,
  email = `user${uniqueSuffix()}@example.test`,
  phone = uniquePhone(),
  password = 'Test@1234',
  isActive = 1,
  adminRoleId = null,
} = {}) {
  const passwordHash = await hashPassword(password);
  const result = await query(
    `INSERT INTO users (full_name, email, phone, password_hash, role, admin_role_id, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [fullName, email, phone, passwordHash, role, adminRoleId, isActive]
  );
  const id = result.insertId;
  const token = signToken({ sub: id, role });
  return { id, email, phone, password, role, token };
}

export const createAdmin = (overrides = {}) => createUser({ role: 'ADMIN', ...overrides });
export const createCustomer = (overrides = {}) => createUser({ role: 'CUSTOMER', ...overrides });
export const createWarehouseStaff = (overrides = {}) => createUser({ role: 'WAREHOUSE_STAFF', ...overrides });

export async function createRegion(overrides = {}) {
  const suffix = uniqueSuffix();
  const name = overrides.name ?? `Vùng test ${suffix}`;
  const result = await query('INSERT INTO regions (name, slug, is_active) VALUES (?, ?, 1)', [
    name,
    overrides.slug ?? `vung-test-${suffix}`,
  ]);
  return { id: result.insertId, name };
}

export async function createCategory(overrides = {}) {
  const suffix = uniqueSuffix();
  const name = overrides.name ?? `Danh mục test ${suffix}`;
  const result = await query('INSERT INTO categories (name, is_active) VALUES (?, 1)', [name]);
  return { id: result.insertId, name };
}

export async function createSupplier(overrides = {}) {
  const suffix = uniqueSuffix();
  const result = await query(
    `INSERT INTO suppliers (supplier_code, name, email, status, is_active)
     VALUES (?, ?, ?, 'APPROVED', 1)`,
    [
      overrides.supplierCode ?? `NCC-TEST-${suffix}`,
      overrides.name ?? `NCC test ${suffix}`,
      overrides.email ?? `ncc${suffix}@example.test`,
    ]
  );
  return { id: result.insertId };
}

export async function createProduct(overrides = {}) {
  const suffix = uniqueSuffix();
  const category = overrides.categoryId ? { id: overrides.categoryId } : await createCategory();
  const result = await query(
    `INSERT INTO products
       (category_id, supplier_id, region_id, sku, slug, name, sale_price, stock_quantity, reorder_level, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    [
      category.id,
      overrides.supplierId ?? null,
      overrides.regionId ?? null,
      overrides.sku ?? `SKU-${suffix}`,
      overrides.slug ?? `san-pham-test-${suffix}`,
      overrides.name ?? `Sản phẩm test ${suffix}`,
      overrides.salePrice ?? 100000,
      overrides.stockQuantity ?? 50,
      overrides.reorderLevel ?? 10,
    ]
  );
  return { id: result.insertId, name: overrides.name ?? `Sản phẩm test ${suffix}`, salePrice: overrides.salePrice ?? 100000 };
}

// Tao truc tiep 1 don + 1 payment gan voi don do (khong di qua /orders/checkout that vi phai
// co san pham/gio hang/dia chi day du) - du cho cac test chi can 1 don o san trang thai/
// payment_method/payment_status cho truoc de goi thang cac endpoint doi trang thai.
export async function createOrder({
  userId,
  status = 'PENDING',
  paymentMethod = 'COD',
  paymentStatus = 'PENDING',
  totalAmount = 100000,
} = {}) {
  const suffix = uniqueSuffix();
  const orderResult = await query(
    `INSERT INTO orders
       (user_id, order_no, recipient_name, recipient_phone, shipping_address, payment_method, status, subtotal, total_amount)
     VALUES (?, ?, 'Test Recipient', '0900000000', 'Dia chi test', ?, ?, ?, ?)`,
    [userId, `DH-TEST-${suffix}`, paymentMethod, status, totalAmount, totalAmount]
  );
  const orderId = orderResult.insertId;
  const paymentResult = await query(
    `INSERT INTO payments (order_id, provider, payment_method, amount, payment_status)
     VALUES (?, ?, ?, ?, ?)`,
    [orderId, paymentMethod, paymentMethod, totalAmount, paymentStatus]
  );
  return { id: orderId, paymentId: paymentResult.insertId };
}

export function authHeader(token) {
  return { Authorization: `Bearer ${token}` };
}
