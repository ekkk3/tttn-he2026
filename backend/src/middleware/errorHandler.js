// Gắn ở cuối app.js, sau mọi route: nếu request lọt tới đây nghĩa là không route nào
// khớp method+path -> trả 404 kèm chính method/url đó để dễ debug (vd gọi nhầm GET thay vì POST).
export function notFound(req, res) {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
}

// Có đủ 4 tham số (err, req, res, next) nên Express xếp đây là error-handling middleware:
// bất cứ chỗ nào trong app gọi next(err) hoặc throw trong 1 route async (asyncHandler bắt
// và forward), request sẽ nhảy thẳng tới đây thay vì chạy tiếp middleware bình thường.
export function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  console.error(err);
  const status = err.status || 500;
  // Lỗi có status riêng (422/404/403...) là lỗi nghiệp vụ, message an toàn để hiển thị.
  // Lỗi 500 (không lường trước) có thể chứa chi tiết nội bộ (SQL, stack, đường dẫn)
  // nên chỉ trả thông báo chung cho client, tránh lộ thông tin hệ thống.
  const message = status === 500 ? 'Đã có lỗi xảy ra, vui lòng thử lại sau.' : (err.message || 'Lỗi không xác định.');
  res.status(status).json({ message });
}
