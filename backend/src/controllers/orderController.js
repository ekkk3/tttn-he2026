import { randomBytes } from 'crypto';
import { query, pool } from '../config/db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { buildVnpayUrl } from '../utils/vnpay.js';
import { createMomoPayment } from '../utils/momo.js';
import { serializeOrderDetail, serializeOrderSummary, paginated, parsePagination } from '../utils/serializers.js';
import { computeVoucherDiscount, releaseOrderVoucher } from './voucherController.js';
import { invalidateCartCache } from './cartController.js';
import { notifyUser } from '../services/notificationService.js';
import { markCodOrderPaidIfDelivered } from '../services/paymentService.js';
import { ORDER_TRANSITIONS } from '../services/orderTransitions.js';
import { validatePhone } from '../utils/validators.js';

// Mã đơn hiển thị cho khách. Phần ngẫu nhiên 6 chữ số hex là BẮT BUỘC, không phải trang trí:
// cột orders.order_no có UNIQUE KEY, mà Date.now() chỉ có độ phân giải mili-giây — 2 khách
// bấm "Đặt hàng" trong cùng 1 mili-giây sẽ sinh ra 2 mã giống hệt nhau, câu INSERT thứ hai
// vi phạm uk_orders_order_no và cả đơn hàng đó BỊ HỦY (khách nhận thông báo khó hiểu
// "Mã đơn hàng đã tồn tại trong hệ thống"). Đã tái hiện được khi 5 khách đặt hàng đồng thời.
function generateOrderNo() {
  return `DH${Date.now()}${randomBytes(3).toString('hex').toUpperCase()}`;
}

// Đúng 4 phương thức mà hệ thống thực sự xử lý được (UC 2.2.9 + checkout-page.jsx):
// COD và BANK_TRANSFER xử lý nội bộ, VNPAY/MOMO chuyển hướng sang cổng thanh toán.
// Cột orders.payment_method là VARCHAR(30) nên không có ràng buộc nào ở tầng CSDL: thiếu
// danh sách này thì client gửi "BITCOIN" hay cả thẻ <script> cũng lưu được, và đơn đó không
// luồng nào xử lý nổi (admin/orders.controller.js còn tính tiền thu hộ COD theo đúng chuỗi
// 'COD' nên các đơn "lạ" bị bỏ sót khi đối soát).
const PAYMENT_METHODS = ['COD', 'BANK_TRANSFER', 'VNPAY', 'MOMO'];

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
  // UC 2.2.8 luồng phụ A1: "nhập thiếu hoặc SAI thông tin giao hàng -> yêu cầu nhập lại".
  // Số điện thoại sai định dạng chỉ lộ ra khi đơn vị vận chuyển gọi giao không được, nên
  // phải chặn ngay lúc đặt hàng.
  const invalidPhone = validatePhone(recipient_phone, 'Số điện thoại người nhận');
  if (invalidPhone) return res.status(422).json({ message: invalidPhone });
  if (!PAYMENT_METHODS.includes(payment_method)) {
    return res.status(422).json({ message: `Phương thức thanh toán không hợp lệ (chỉ nhận: ${PAYMENT_METHODS.join(', ')}).` });
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
      `SELECT ci.*, p.name AS product_name, p.stock_quantity, p.is_active, p.is_deleted
       FROM cart_items ci JOIN products p ON p.id = ci.product_id WHERE ci.cart_id = ?`,
      [cart.id]
    );
    if (!items.length) throw Object.assign(new Error('Giỏ hàng đang trống.'), { status: 422 });

    // UC 2.2.8 luồng phụ A2: "sản phẩm trong giỏ đã ngừng bán hoặc không tồn tại -> thông báo
    // sản phẩm không khả dụng và yêu cầu loại bỏ khỏi giỏ".
    // cartController#storeItem có lọc is_active/is_deleted lúc THÊM vào giỏ, nhưng sản phẩm
    // vẫn nằm lại trong giỏ nếu Admin bấm "Ngừng bán" SAU đó — trước đây câu SELECT trên
    // không lọc gì nên đơn vẫn được tạo và tồn kho vẫn bị trừ cho mặt hàng đã gỡ khỏi kinh
    // doanh (có thể do hết hạn, bị thu hồi, vi phạm ATTP).
    const unavailable = items.filter((i) => !i.is_active || i.is_deleted);
    if (unavailable.length) {
      throw Object.assign(
        new Error(`Sản phẩm ${unavailable.map((i) => `"${i.product_name}"`).join(', ')} đã ngừng bán, vui lòng xóa khỏi giỏ hàng trước khi đặt.`),
        { status: 422 }
      );
    }

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

    // Thứ tự 2 vòng lặp dưới đây là CÓ CHỦ ĐÍCH, không gộp chung được — xem giải thích:
    //
    // (1) TRỪ TỒN KHO TRƯỚC, ghi order_items sau.
    //     order_items.product_id có khóa ngoại trỏ tới products, nên mỗi câu INSERT order_items
    //     khiến InnoDB đặt khóa CHIA SẺ (S) lên dòng products tương ứng để kiểm tra FK. Nếu
    //     INSERT chạy trước như trước đây thì kịch bản 2 khách mua cùng 1 sản phẩm là:
    //         T1 giữ S(sp) --(xin X)--> chờ T2 nhả S
    //         T2 giữ S(sp) --(xin X)--> chờ T1 nhả S     => DEADLOCK
    //     Đã tái hiện: 8 khách đặt cùng lúc thì 6 đơn chết với lỗi 1213 và trả HTTP 500.
    //     Lấy khóa ĐỘC QUYỀN (X) trước bằng UPDATE thì khóa S mà FK cần sau đó đã nằm gọn
    //     trong khóa X transaction này đang giữ, không còn cảnh nâng cấp khóa chéo nhau nữa.
    //
    // (2) Sắp xếp theo product_id để MỌI transaction khóa các dòng products theo CÙNG một thứ
    //     tự — 2 đơn cùng chứa sản phẩm A và B mà khóa ngược chiều nhau cũng gây deadlock.
    const orderedItems = [...items].sort((a, b) => Number(a.product_id) - Number(b.product_id));

    for (const item of orderedItems) {
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

    for (const item of orderedItems) {
      await connection.query(
        `INSERT INTO order_items (order_id, product_id, product_name_snapshot, quantity, unit_price, line_total)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [orderId, item.product_id, item.product_name, item.quantity, item.unit_price, item.line_total]
      );
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

    // Giỏ hàng vừa bị xóa sạch/chuyển CHECKED_OUT ở trên (trong transaction) — Redis không
    // nằm trong transaction đó nên phải tự xóa cache riêng, ngoài transaction, chỉ SAU KHI
    // commit thành công (invalidate trước rồi lỡ rollback thì cache lại sai theo hướng khác).
    await invalidateCartCache(req.user.id);

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

// Các endpoint dưới đây để KHÁCH HÀNG tự đổi trạng thái đơn của mình. Trước đây chúng ghi
// thẳng trạng thái mới mà không xét trạng thái hiện tại, nên khách có thể làm những việc
// mà chính Admin bị state machine chặn (vd đơn đã hủy vẫn bấm "đã nhận hàng" thành DELIVERED,
// hay bấm hủy nhiều lần sinh trùng lịch sử + trùng thông báo). Nay cả 2 phía dùng CHUNG
// bảng ORDER_TRANSITIONS trong services/orderTransitions.js.
function assertTransition(order, next) {
  const allowed = ORDER_TRANSITIONS[order.status] || [];
  if (!allowed.includes(next)) {
    throw Object.assign(
      new Error(`Không thể chuyển đơn từ trạng thái ${order.status} sang ${next}.`),
      { status: 422 }
    );
  }
}

export const cancel = asyncHandler(async (req, res) => {
  const [order] = await query('SELECT * FROM orders WHERE id = ? AND user_id = ?', [req.params.order, req.user.id]);
  if (!order) return res.status(404).json({ message: 'Không tìm thấy đơn hàng.' });
  assertTransition(order, 'CANCELLED');

  // Hủy đơn phải HOÀN LẠI tồn kho đã bị trừ lúc checkout (UC 2.2.22 bước 9: hệ thống tự động
  // cập nhật tồn kho khi hoàn trả hàng hóa). Thiếu bước này thì mỗi lần khách hủy đơn, số
  // hàng trong đơn biến mất khỏi kho vĩnh viễn.
  // Bọc transaction để đổi trạng thái + cộng kho luôn đi cùng nhau; đồng thời UPDATE có kèm
  // điều kiện `status = ?` (trạng thái vừa đọc được) nên 2 request hủy đồng thời chỉ 1 cái
  // đi tiếp — cái còn lại thấy affectedRows = 0 và bị từ chối, tránh cộng kho 2 lần.
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [result] = await connection.query(
      "UPDATE orders SET status = 'CANCELLED', cancelled_at = NOW() WHERE id = ? AND status = ?",
      [order.id, order.status]
    );
    if (result.affectedRows === 0) {
      throw Object.assign(new Error('Đơn hàng vừa được cập nhật bởi thao tác khác, vui lòng tải lại.'), { status: 409 });
    }
    const [items] = await connection.query('SELECT product_id, quantity FROM order_items WHERE order_id = ?', [order.id]);
    for (const item of items) {
      if (!item.product_id) continue; // Sản phẩm đã bị xóa hẳn -> không còn dòng kho để cộng lại.
      await connection.query('UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?', [item.quantity, item.product_id]);
    }
    // Trả lại lượt dùng voucher (nếu đơn có áp mã) — nằm CÙNG transaction với hoàn kho vì
    // cả hai đều là việc "hoàn tác những gì checkout đã tiêu tốn".
    // connection.query trả về [rows, fields] còn helper mong đợi trực tiếp rows, nên bọc lại.
    await releaseOrderVoucher(order.id, async (sql, params) => {
      const [rows] = await connection.query(sql, params);
      return rows;
    });
    await connection.query(
      "INSERT INTO order_status_history (order_id, from_status, to_status, note, changed_by_user_id) VALUES (?, ?, 'CANCELLED', ?, ?)",
      [order.id, order.status, req.body.reason || 'Khách hàng hủy đơn', req.user.id]
    );
    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }

  await notifyUser(req.user.id, 'ORDER_CANCELLED', 'Đã hủy đơn hàng', `Đơn hàng ${order.order_no} đã được hủy.`, `/account/orders/${order.id}`);
  const detail = await loadOrderDetail(order.id, req.user.id);
  res.json({ data: detail });
});

export const confirmBankTransferSubmitted = asyncHandler(async (req, res) => {
  const [order] = await query('SELECT * FROM orders WHERE id = ? AND user_id = ?', [req.params.order, req.user.id]);
  if (!order) return res.status(404).json({ message: 'Không tìm thấy đơn hàng.' });
  // Không dùng ORDER_TRANSITIONS ở đây: AWAITING_PAYMENT_CONFIRMATION là bước riêng của luồng
  // chuyển khoản (khách tự báo "đã chuyển tiền"), không phải một bước trong luồng xử lý đơn
  // mà Admin/Kho điều khiển. Chỉ cho báo đúng 1 lần, khi đơn còn đang chờ và đúng là đơn
  // chuyển khoản — tránh khách bấm nhầm ở đơn COD hoặc bấm lại khi đơn đã được xác nhận.
  if (order.payment_method !== 'BANK_TRANSFER') {
    return res.status(422).json({ message: 'Đơn hàng này không thanh toán bằng chuyển khoản.' });
  }
  if (order.status !== 'PENDING') {
    return res.status(422).json({ message: 'Đơn hàng không còn ở trạng thái chờ chuyển khoản.' });
  }
  await query("UPDATE orders SET status = 'AWAITING_PAYMENT_CONFIRMATION' WHERE id = ? AND status = 'PENDING'", [order.id]);
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
  // Chỉ đơn ĐANG GIAO (SHIPPED) mới xác nhận đã nhận được — theo đúng ORDER_TRANSITIONS.
  // Trước đây thiếu kiểm tra này nên khách bấm được trên cả đơn vừa đặt lẫn đơn đã hủy,
  // khiến đơn chưa từng giao vẫn được tính vào doanh thu trên Dashboard.
  assertTransition(order, 'DELIVERED');
  await query("UPDATE orders SET status = 'DELIVERED', delivered_at = NOW() WHERE id = ? AND status = ?", [order.id, order.status]);
  await query(
    "INSERT INTO order_status_history (order_id, from_status, to_status, note, changed_by_user_id) VALUES (?, ?, 'DELIVERED', 'Khách xác nhận đã nhận hàng', ?)",
    [order.id, order.status, req.user.id]
  );
  await markCodOrderPaidIfDelivered(order.id);
  const detail = await loadOrderDetail(order.id, req.user.id);
  res.json({ data: detail });
});
