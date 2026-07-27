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

// Phí vận chuyển tính phía server, giữ đồng logic với checkout-page.jsx để tổng tiền
// hiển thị trên UI khớp với đơn hàng thực tế lưu trong DB.
// Bỏ dấu tiếng Việt (vd "Hà Nội" -> "ha noi") để so khớp CHUỖI ĐỊA CHỈ KHÁCH TỰ NHẬP với
// danh sách tên tỉnh/thành không dấu bên dưới — khách có thể gõ thiếu dấu, sai dấu, viết
// hoa/thường lẫn lộn, nên so khớp "không dấu" bao dung hơn nhiều so với so khớp chính xác.
function normalizeVietnamese(value) {
  return String(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/đ/g, 'd')
    .replace(/[̀-ͯ]/g, '');
}
// Bảng phí nội bộ theo thứ tự ưu tiên: đơn đủ lớn thì freeship, không thì tính theo địa
// bàn (Hà Nội rẻ nhất vì gần kho, các tỉnh miền Bắc khác giá trung bình, còn lại đồng giá).
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

// Đọc order + items + status_history + payment rồi serialize theo định dạng frontend.
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
  // Vận đơn + đơn vị vận chuyển thật (UC "Theo dõi trạng thái đơn"): trước đây không JOIN
  // nên shipping_carrier/shipping_code luôn null phía khách hàng dù admin đã tạo vận đơn GHN
  // thật cho đơn này. Cùng logic với admin/orders.controller.js#loadAdminOrderDetail.
  const [shipment] = await query(
    `SELECT s.* , c.name AS carrier_name FROM order_shipments s
     LEFT JOIN shipping_carriers c ON c.id = s.shipping_carrier_id
     WHERE s.order_id = ? ORDER BY s.id DESC LIMIT 1`,
    [order.id]
  );
  const base = serializeOrderDetail(order, { items, statusHistory, payment: payment || null });
  return {
    ...base,
    shipping_carrier: shipment?.carrier_name ?? null,
    shipping_code: shipment?.tracking_code ?? null,
    shipment: shipment ? {
      status: shipment.status,
      tracking_code: shipment.tracking_code,
      tracking_url: shipment.tracking_url,
      expected_delivery_time: shipment.expected_delivery_time,
      synced_at: shipment.synced_at,
    } : null,
  };
}

// POST /api/orders/checkout
export const checkout = asyncHandler(async (req, res) => {
  const {
    recipient_name, recipient_phone, shipping_address, payment_method = 'COD', payment_gateway, note, voucher_code,
    shipping_province_id, shipping_province_name, shipping_district_id, shipping_district_name,
    shipping_ward_code, shipping_ward_name,
  } = req.body;
  if (!recipient_name || !recipient_phone || !shipping_address) {
    return res.status(422).json({ message: 'Thiếu thông tin người nhận hoặc địa chỉ giao hàng.' });
  }

  // Toàn bộ checkout chạy trong 1 TRANSACTION: tạo đơn + trừ tồn kho + ghi payment + cập
  // nhật voucher + xóa giỏ hàng phải cùng thành công hoặc cùng thất bại — nếu 1 bước lỗi
  // giữa chừng (vd hết hàng ở bước thứ 3/5), rollback() sẽ hoàn tác MỌI thay đổi đã làm
  // trước đó trong cùng transaction, tránh để lại dữ liệu nửa vời (đơn tạo nhưng không trừ kho...).
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [[cart]] = await connection.query(
      "SELECT * FROM carts WHERE user_id = ? AND status = 'ACTIVE' LIMIT 1",
      [req.user.id]
    );
    if (!cart) throw Object.assign(new Error('Giỏ hàng đang trống.'), { status: 422 });

    const [items] = await connection.query(
      `SELECT ci.*, p.name AS product_name, p.stock_quantity
       FROM cart_items ci JOIN products p ON p.id = ci.product_id WHERE ci.cart_id = ?`,
      [cart.id]
    );
    if (!items.length) throw Object.assign(new Error('Giỏ hàng đang trống.'), { status: 422 });

    const subtotal = items.reduce((sum, i) => sum + Number(i.line_total), 0);
    const shipping_fee = calculateShippingFee(subtotal, shipping_address);

    // UC 2.2.9a: áp dụng voucher nếu khách nhập mã hợp lệ.
    let discount_amount = 0;
    let appliedVoucher = null;
    if (voucher_code) {
      const [[voucher]] = await connection.query('SELECT * FROM vouchers WHERE code = ? LIMIT 1', [voucher_code]);
      discount_amount = computeVoucherDiscount(voucher, subtotal); // ném 422 nếu không hợp lệ
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
      // Trừ tồn kho + kiểm tra đủ hàng trong CÙNG 1 câu UPDATE (điều kiện stock_quantity >= ?),
      // dựa vào row lock của InnoDB để tránh race condition: nếu chỉ SELECT rồi so sánh trước,
      // 2 request checkout đồng thời cho cùng sản phẩm có thể cùng "thấy" còn đủ hàng và cùng
      // được tạo đơn, dẫn đến bán vượt tồn kho thực tế (oversell).
      const [stockResult] = await connection.query(
        'UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ? AND stock_quantity >= ?',
        [item.quantity, item.product_id, item.quantity]
      );
      if (stockResult.affectedRows === 0) {
        throw Object.assign(
          new Error(`Sản phẩm "${item.product_name}" không đủ tồn kho (vừa hết hàng hoặc có người khác mua trước).`),
          { status: 422 }
        );
      }
    }

    // Tạo bản ghi thanh toán. BANK_TRANSFER lưu hướng dẫn chuyển khoản vào raw_payload
    // (checkout-page.jsx đọc payment.raw_payload để hiện modal QR + số tài khoản).
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

    // Ghi nhận voucher đã dùng (UC 2.2.9a) + tăng used_count.
    if (appliedVoucher && discount_amount > 0) {
      await connection.query(
        'INSERT INTO order_vouchers (order_id, voucher_id, discount_amount) VALUES (?, ?, ?)',
        [orderId, appliedVoucher.id, discount_amount]
      );
      // Tăng used_count có điều kiện lại usage_limit (giống logic trừ tồn kho ở trên):
      // computeVoucherDiscount() đã kiểm tra usage_limit từ bản ghi đọc trước đó, nếu 2 đơn
      // dùng chung 1 mã cùng lúc thì cả 2 có thể cùng "thấy" còn lượt — kiểm tra lại ngay
      // lúc UPDATE mới chặn được vượt usage_limit thực tế.
      const [voucherResult] = await connection.query(
        'UPDATE vouchers SET used_count = used_count + 1 WHERE id = ? AND (usage_limit IS NULL OR used_count < usage_limit)',
        [appliedVoucher.id]
      );
      if (voucherResult.affectedRows === 0) {
        throw Object.assign(new Error('Mã giảm giá vừa hết lượt sử dụng, vui lòng thử lại.'), { status: 422 });
      }
    }

    await connection.query('DELETE FROM cart_items WHERE cart_id = ?', [cart.id]);
    await connection.query("UPDATE carts SET status = 'CHECKED_OUT' WHERE id = ?", [cart.id]);
    await connection.query(
      "INSERT INTO order_status_history (order_id, to_status, note) VALUES (?, 'PENDING', 'Khách hàng đặt hàng')",
      [orderId]
    );

    await connection.commit();

    // Thông báo "Đã đặt hàng" (UC 2.2.5a).
    await notifyUser(
      req.user.id, 'ORDER_PLACED', 'Đặt hàng thành công',
      `Đơn hàng ${orderNo} đã được tạo và đang chờ xử lý.`, `/account/orders/${orderId}`
    );

    // Voucher VNPay/MoMo vẫn hoạt động nếu frontend gửi payment_method tương ứng (bonus,
    // frontend hiện tại chỉ dùng COD + BANK_TRANSFER).
    let paymentRedirectUrl = null;
    if (payment_method === 'VNPAY') {
      paymentRedirectUrl = buildVnpayUrl({ orderId, amount: total_amount, ipAddr: req.ip });
    } else if (payment_method === 'MOMO') {
      paymentRedirectUrl = await createMomoPayment({ orderId, amount: total_amount });
    }

    const detail = await loadOrderDetail(orderId, req.user.id);
    res.status(201).json({ data: { ...detail, payment_redirect_url: paymentRedirectUrl } });
  } catch (err) {
    // Bất kỳ lỗi nào ở trên (kể cả lỗi 422 tự ném do hết hàng/voucher) đều rollback rồi
    // ném lại lỗi gốc cho asyncHandler -> errorHandler xử lý response, KHÔNG tự trả res ở đây.
    await connection.rollback();
    throw err;
  } finally {
    // Luôn trả connection về lại pool dù thành công hay lỗi — quên dòng này sẽ làm rò rỉ
    // connection, dần dần hết connectionLimit (xem config/db.js) và app treo cứng.
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
  if (!detail) return res.status(404).json({ message: 'Không tìm thấy đơn hàng.' });
  res.json({ data: detail });
});

export const cancel = asyncHandler(async (req, res) => {
  const [order] = await query('SELECT * FROM orders WHERE id = ? AND user_id = ?', [req.params.order, req.user.id]);
  if (!order) return res.status(404).json({ message: 'Không tìm thấy đơn hàng.' });
  await query("UPDATE orders SET status = 'CANCELLED', cancelled_at = NOW() WHERE id = ?", [order.id]);
  await query(
    "INSERT INTO order_status_history (order_id, from_status, to_status, note, changed_by_user_id) VALUES (?, ?, 'CANCELLED', ?, ?)",
    [order.id, order.status, req.body.reason || 'Khách hàng hủy đơn', req.user.id]
  );
  await notifyUser(req.user.id, 'ORDER_CANCELLED', 'Đã hủy đơn hàng', `Đơn hàng ${order.order_no} đã được hủy.`, `/account/orders/${order.id}`);
  const detail = await loadOrderDetail(order.id, req.user.id);
  res.json({ data: detail });
});

export const confirmBankTransferSubmitted = asyncHandler(async (req, res) => {
  const [order] = await query('SELECT * FROM orders WHERE id = ? AND user_id = ?', [req.params.order, req.user.id]);
  if (!order) return res.status(404).json({ message: 'Không tìm thấy đơn hàng.' });
  await query("UPDATE orders SET status = 'AWAITING_PAYMENT_CONFIRMATION' WHERE id = ?", [order.id]);
  await query(
    "INSERT INTO order_status_history (order_id, from_status, to_status, note, changed_by_user_id) VALUES (?, ?, 'AWAITING_PAYMENT_CONFIRMATION', 'Khách báo đã chuyển khoản', ?)",
    [order.id, order.status, req.user.id]
  );
  const detail = await loadOrderDetail(order.id, req.user.id);
  res.json({ data: detail });
});

export const confirmDelivery = asyncHandler(async (req, res) => {
  const [order] = await query('SELECT * FROM orders WHERE id = ? AND user_id = ?', [req.params.order, req.user.id]);
  if (!order) return res.status(404).json({ message: 'Không tìm thấy đơn hàng.' });
  await query("UPDATE orders SET status = 'DELIVERED', delivered_at = NOW() WHERE id = ?", [order.id]);
  await query(
    "INSERT INTO order_status_history (order_id, from_status, to_status, note, changed_by_user_id) VALUES (?, ?, 'DELIVERED', 'Khách xác nhận đã nhận hàng', ?)",
    [order.id, order.status, req.user.id]
  );
  const detail = await loadOrderDetail(order.id, req.user.id);
  res.json({ data: detail });
});
