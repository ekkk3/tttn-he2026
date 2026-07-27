import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import 'dotenv/config';
import apiRoutes from './routes/api.routes.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';
import { bootstrapProductIndex } from './utils/productIndex.js';

const app = express();

// Tạo/đồng bộ index Elasticsearch lúc khởi động (best-effort, không chặn server).
// Không có await ở đây: hàm chạy nền, nếu lỗi (ES chưa cài) server vẫn khởi động bình thường.
bootstrapProductIndex();

// credentials:true không thể đi chung với origin '*' (browser sẽ chặn) — cho phép cả
// localhost và 127.0.0.1 vì Vite dev server có thể được mở bằng cả hai dạng.
const corsAllowlist = [process.env.CORS_ORIGIN, 'http://localhost:5173', 'http://127.0.0.1:5173'].filter(Boolean);
app.use(cors({
  origin: (origin, callback) => callback(null, !origin || corsAllowlist.includes(origin)),
  credentials: true,
}));
// express.json(): parse body JSON của request vào req.body (không có dòng này thì
// req.body sẽ undefined với mọi request POST/PUT/PATCH gửi Content-Type: application/json).
app.use(express.json());
// morgan('dev'): tự log ra console mỗi request (method, path, status, thời gian) để debug.
app.use(morgan('dev'));
// File đính kèm "Đăng ký Nhà cung cấp" (giấy phép kinh doanh / ATTP) — xem middleware/upload.js.
// Serve tĩnh thư mục uploads/ ra ngoài dưới path /uploads để frontend hiển thị được ảnh/PDF đã nộp.
app.use('/uploads', express.static('uploads'));

// Tương đương endpoint /backend-status của bản Laravel.
app.get('/backend-status', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

app.use('/api', apiRoutes);

// Thứ tự 2 dòng dưới đây bắt buộc phải đứng SAU CÙNG (sau mọi route):
// - notFound: chạy khi request không khớp route nào ở trên -> trả 404.
// - errorHandler: middleware 4-tham-số, Express tự nhận diện đây là "error handler" và
//   chỉ gọi nó khi có lỗi (throw hoặc next(err)) từ route/middleware phía trước.
app.use(notFound);
app.use(errorHandler);

export default app;
