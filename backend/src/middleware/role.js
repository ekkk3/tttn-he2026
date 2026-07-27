// Tương đương middleware phân quyền 4 vai trò (CUSTOMER, ADMIN, WAREHOUSE_STAFF, SUPPLIER)
// đã mô tả trong đề cương (Tuần 2: "middleware phân quyền 4 vai trò").
// Hàm bậc cao (higher-order function): gọi requireRole('ADMIN') hay requireRole('ADMIN','SUPPLIER')
// sẽ trả về MỘT middleware function khác nhau tùy danh sách role — nhờ vậy 1 file dùng được
// cho mọi route mà không cần viết middleware riêng cho từng role.
export function requireRole(...roles) {
  return (req, res, next) => {
    // req.user chỉ tồn tại nếu route đã chạy qua middleware auth() trước đó (xem api.routes.js).
    // Chưa đăng nhập, hoặc role hiện tại không nằm trong danh sách cho phép -> chặn 403.
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Forbidden: insufficient role.' });
    }
    next();
  };
}
