import 'dotenv/config';
import app from './app.js';

// Điểm khởi chạy (entrypoint): chỉ lo việc mở cổng lắng nghe HTTP, còn cấu hình
// middleware/route thực sự nằm ở app.js (tách riêng để test có thể import app mà
// không cần thực sự mở cổng mạng).
const port = process.env.PORT || 8000;
app.listen(port, () => {
  console.log(`API server đang chạy tại http://127.0.0.1:${port}`);
  console.log(`Health check: http://127.0.0.1:${port}/backend-status`);
});
