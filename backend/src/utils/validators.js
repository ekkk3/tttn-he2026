// Các hàm kiểm tra dữ liệu dùng chung cho nhiều controller.
// Quy ước chung: trả về CHUỖI thông báo lỗi (tiếng Việt, hiển thị thẳng cho người dùng) nếu
// dữ liệu sai, hoặc `null` nếu hợp lệ — controller chỉ việc `if (msg) return res.status(422)...`.
// Đặt ở utils/ thay vì trong 1 controller cụ thể vì cùng một quy tắc nghiệp vụ được áp ở
// nhiều đường vào khác nhau (vd sản phẩm tạo được từ cả Admin lẫn Nhà cung cấp).

// UC 2.2.16 bước 6: "Giá bán phải lớn hơn 0".
// Giá bán ÂM biến sản phẩm thành phiếu giảm giá — thêm vào giỏ sẽ làm GIẢM tổng tiền đơn
// (subtotal cộng dồn line_total âm), giá 0 thì bán mà không thu tiền.
// Tồn kho ÂM khiến khách nhận thông báo vô nghĩa kiểu "Chỉ còn -99 sản phẩm trong kho".
// Mặc định chỉ kiểm tra field CÓ MẶT trong `body` để dùng được cho cập nhật MỘT PHẦN
// (client chỉ gửi vài field, các field không gửi giữ nguyên giá trị cũ trong DB).
// Khi TẠO MỚI thì truyền `{ requireSalePrice: true }`: lúc đó thiếu giá bán cũng là lỗi,
// vì không có giá trị cũ nào để giữ lại — bỏ qua sẽ ghi NULL xuống cột NOT NULL.
export function validateProductPricing(body, { requireSalePrice = false } = {}) {
  if (requireSalePrice && (body.sale_price === undefined || body.sale_price === null || body.sale_price === '')) {
    return 'Giá bán phải lớn hơn 0.';
  }
  if (body.sale_price !== undefined) {
    const price = Number(body.sale_price);
    if (!Number.isFinite(price) || price <= 0) return 'Giá bán phải lớn hơn 0.';
  }
  if (body.stock_quantity !== undefined && body.stock_quantity !== null && body.stock_quantity !== '') {
    const stock = Number(body.stock_quantity);
    if (!Number.isInteger(stock) || stock < 0) return 'Số lượng tồn kho phải là số nguyên không âm.';
  }
  return null;
}

// Định dạng email dùng chung. Cùng biểu thức với authController để 1 email hợp lệ ở màn
// đăng ký thì cũng hợp lệ ở mọi form khác, không có chỗ chặt chỗ lỏng.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(value, label = 'Email') {
  if (!value || !EMAIL_REGEX.test(String(value).trim())) return `${label} không hợp lệ.`;
  return null;
}

// Số điện thoại Việt Nam. Chấp nhận cách viết quen thuộc của người dùng — có khoảng trắng,
// dấu chấm, gạch ngang hay ngoặc đơn ("093 123 4567", "(024) 3825 1234") — nên bỏ hết ký tự
// phân cách trước khi so khớp, thay vì bắt người dùng gõ liền một mạch.
// Dạng hợp lệ sau khi bỏ phân cách: bắt đầu bằng 0 hoặc +84/84, tổng 10-11 chữ số
// (10 số cho di động và phần lớn số cố định, 11 số cho một vài đầu số cố định cũ).
const PHONE_SEPARATORS = /[\s.\-()]/g;
const PHONE_REGEX = /^(0\d{9,10}|(\+?84)\d{9,10})$/;

export function validatePhone(value, label = 'Số điện thoại') {
  if (value === undefined || value === null || String(value).trim() === '') {
    return `${label} là bắt buộc.`;
  }
  const digits = String(value).replace(PHONE_SEPARATORS, '');
  if (!PHONE_REGEX.test(digits)) return `${label} không hợp lệ (ví dụ: 0912345678).`;
  return null;
}

// Dùng cho các form mà số điện thoại là TÙY CHỌN: bỏ trống thì bỏ qua, đã nhập thì phải đúng.
export function validateOptionalPhone(value, label = 'Số điện thoại') {
  if (value === undefined || value === null || String(value).trim() === '') return null;
  return validatePhone(value, label);
}

// UC "Yêu cầu nhập hàng" bước 7: "Số lượng nhập phải lớn hơn 0".
// Số lượng ÂM khiến phiếu NHẬP hàng lại TRỪ tồn kho khi được đánh dấu đã nhận
// (operationController#updateRequisitionStatus cộng thẳng approved_qty vào stock_quantity).
// `label` để thông báo lỗi nói đúng tên trường mà người dùng vừa nhập.
export function validatePositiveQuantity(value, label = 'Số lượng') {
  const qty = Number(value);
  if (!Number.isInteger(qty) || qty <= 0) return `${label} phải là số nguyên lớn hơn 0.`;
  return null;
}
