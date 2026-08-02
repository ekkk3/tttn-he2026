// Gắn ở cuối app.js, sau mọi route: nếu request lọt tới đây nghĩa là không route nào
// khớp method+path -> trả 404 kèm chính method/url đó để dễ debug (vd gọi nhầm GET thay vì POST).
export function notFound(req, res) {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
}

// ---------------------------------------------------------------------------
// Dịch lỗi ràng buộc của MySQL/MariaDB sang thông báo nghiệp vụ tiếng Việt.
//
// Vì sao cần: các lỗi này KHÔNG phải "hệ thống hỏng" mà là "dữ liệu người dùng gửi lên sai"
// (chọn danh mục không tồn tại, nhập email đã có người dùng...). Trước đây chúng rơi vào
// nhánh 500 và client chỉ nhận được "Đã có lỗi xảy ra, vui lòng thử lại sau." — người dùng
// không biết mình sai ở đâu, còn lập trình viên phải mở log server mới đoán ra.
// Đặt ở đây thay vì đi sửa từng controller: có ~40 endpoint ghi dữ liệu, chặn tập trung 1 chỗ
// thì endpoint mới viết sau này cũng tự động được hưởng, không ai quên.
//
// Lưu ý: mọi thông báo trả về đều là chuỗi TỰ VIẾT, không bao giờ ghép `sqlMessage` gốc vào
// response — sqlMessage chứa tên bảng/cột/câu SQL, là thông tin nội bộ không nên lộ ra ngoài.
// ---------------------------------------------------------------------------

// Bảng khóa ngoại trỏ tới -> tên nghiệp vụ hiển thị cho người dùng.
const REFERENCED_TABLE_LABEL = {
  categories: 'Danh mục',
  suppliers: 'Nhà cung cấp',
  products: 'Sản phẩm',
  users: 'Người dùng',
  orders: 'Đơn hàng',
  order_items: 'Dòng hàng trong đơn',
  regions: 'Vùng miền',
  vouchers: 'Mã giảm giá',
  shipping_carriers: 'Đơn vị vận chuyển',
  delivery_requests: 'Phiếu yêu cầu nhập hàng',
  carts: 'Giỏ hàng',
  posts: 'Bài viết',
  inventories: 'Kho',
  admin_roles: 'Nhóm quyền quản trị',
};

// Tên UNIQUE KEY trong schema.sql -> tên trường hiển thị cho người dùng.
const UNIQUE_KEY_LABEL = {
  uk_users_email: 'Email',
  uk_suppliers_email: 'Email nhà cung cấp',
  uk_newsletter_email: 'Email',
  uk_users_google_id: 'Tài khoản Google',
  uk_users_facebook_id: 'Tài khoản Facebook',
  uk_vouchers_code: 'Mã giảm giá',
  uk_suppliers_code: 'Mã nhà cung cấp',
  uk_shipping_carriers_code: 'Mã đơn vị vận chuyển',
  uk_orders_order_no: 'Mã đơn hàng',
  uk_products_slug: 'Đường dẫn (slug) sản phẩm',
  uk_regions_slug: 'Đường dẫn (slug) vùng miền',
  uk_admin_roles_name: 'Tên nhóm quyền',
};

// Trả về { status, message } nếu `err` là lỗi ràng buộc đã biết, ngược lại null.
function translateDatabaseError(err) {
  switch (err?.code) {
    // Chèn/sửa một dòng trỏ tới bản ghi cha KHÔNG tồn tại (vd category_id = 99999).
    // sqlMessage của MySQL có kèm "REFERENCES `<bảng cha>`" — dựa vào đó để gọi đúng tên
    // nghiệp vụ, chính xác hơn là đoán từ tên constraint (fk_products_category chứa cả 2 bảng).
    case 'ER_NO_REFERENCED_ROW':
    case 'ER_NO_REFERENCED_ROW_2': {
      const table = /REFERENCES `([a-z_]+)`/i.exec(err.sqlMessage || '')?.[1];
      const label = REFERENCED_TABLE_LABEL[table];
      return {
        status: 422,
        message: label ? `${label} không tồn tại trong hệ thống.` : 'Dữ liệu liên kết không tồn tại trong hệ thống.',
      };
    }
    // Xóa bản ghi cha trong khi vẫn còn bản ghi con trỏ tới nó.
    case 'ER_ROW_IS_REFERENCED':
    case 'ER_ROW_IS_REFERENCED_2':
      return { status: 409, message: 'Không thể xóa vì dữ liệu này đang được sử dụng ở nơi khác.' };
    // Trùng giá trị ở cột/UNIQUE KEY. sqlMessage dạng: Duplicate entry 'x' for key 'uk_users_email'
    case 'ER_DUP_ENTRY': {
      const key = /for key '(?:[^'.]*\.)?([a-z_0-9]+)'/i.exec(err.sqlMessage || '')?.[1];
      const label = UNIQUE_KEY_LABEL[key];
      return {
        status: 422,
        message: label ? `${label} đã tồn tại trong hệ thống.` : 'Dữ liệu này đã tồn tại trong hệ thống.',
      };
    }
    case 'ER_BAD_NULL_ERROR':
      return { status: 422, message: 'Thiếu thông tin bắt buộc, vui lòng kiểm tra lại các trường đã nhập.' };
    case 'ER_DATA_TOO_LONG':
      return { status: 422, message: 'Nội dung nhập vào quá dài, vui lòng rút ngắn lại.' };
    // Các mã dưới đây chỉ xuất hiện SAU KHI bật STRICT_TRANS_TABLES (xem config/db.js): ở chế
    // độ lỏng chúng chỉ là cảnh báo và dữ liệu bị ép âm thầm. Gom chung 1 thông báo vì với
    // người dùng cuối thì bản chất giống nhau: giá trị vừa nhập không hợp lệ cho trường đó.
    case 'ER_TRUNCATED_WRONG_VALUE':
    case 'ER_TRUNCATED_WRONG_VALUE_FOR_FIELD':
    case 'WARN_DATA_TRUNCATED':
    case 'ER_WARN_DATA_OUT_OF_RANGE':
      return { status: 422, message: 'Giá trị nhập vào không đúng định dạng cho trường này, vui lòng kiểm tra lại.' };
    default:
      return null;
  }
}

// Có đủ 4 tham số (err, req, res, next) nên Express xếp đây là error-handling middleware:
// bất cứ chỗ nào trong app gọi next(err) hoặc throw trong 1 route async (asyncHandler bắt
// và forward), request sẽ nhảy thẳng tới đây thay vì chạy tiếp middleware bình thường.
export function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  console.error(err);

  // Lỗi ràng buộc CSDL: đổi thành lỗi nghiệp vụ 4xx có thông báo rõ ràng.
  // Chỉ áp dụng khi controller CHƯA tự gán status — nếu controller đã chủ động ném lỗi kèm
  // status thì tôn trọng quyết định đó.
  if (!err?.status) {
    const translated = translateDatabaseError(err);
    if (translated) return res.status(translated.status).json({ message: translated.message });
  }

  const status = err.status || 500;
  // Lỗi có status riêng (422/404/403...) là lỗi nghiệp vụ, message an toàn để hiển thị.
  // Lỗi 500 (không lường trước) có thể chứa chi tiết nội bộ (SQL, stack, đường dẫn)
  // nên chỉ trả thông báo chung cho client, tránh lộ thông tin hệ thống.
  const message = status === 500 ? 'Đã có lỗi xảy ra, vui lòng thử lại sau.' : (err.message || 'Lỗi không xác định.');
  res.status(status).json({ message });
}
