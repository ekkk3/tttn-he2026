// Tiện ích nhỏ dùng chung khi dựng câu SQL.

// Vô hiệu hóa các KÝ TỰ ĐẠI DIỆN của LIKE trong chuỗi do người dùng nhập.
//
// Trong mệnh đề LIKE, '%' khớp với mọi chuỗi (kể cả rỗng) và '_' khớp với đúng một ký tự bất
// kỳ. Dùng tham số hóa (dấu ?) chống được SQL injection nhưng KHÔNG làm mất ý nghĩa đặc biệt
// của 2 ký tự này — chúng nằm trong chính GIÁ TRỊ được truyền vào. Hệ quả: khách gõ "_" vào
// ô tìm kiếm sẽ nhận về toàn bộ sản phẩm thay vì "không tìm thấy sản phẩm phù hợp".
//
// Dấu gạch chéo ngược phải escape TRƯỚC, nếu không thì các dấu \ vừa thêm vào ở 2 bước sau
// lại bị chính bước này nhân đôi.
// MySQL/MariaDB mặc định dùng '\' làm ký tự escape trong LIKE nên không cần thêm ESCAPE.
export function escapeLike(value) {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_');
}
