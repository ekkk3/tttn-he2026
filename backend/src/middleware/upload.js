import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Middleware multer để nhận file giấy phép kinh doanh/ATTP khi Nhà cung cấp đăng ký
// (route POST /api/suppliers/apply — xem api.routes.js + supplierController.apply).

// Thư mục lưu file vật lý trên đĩa; recursive:true để không lỗi nếu thư mục cha chưa có.
const uploadDir = path.resolve('uploads/supplier-licenses');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  // Đặt tên file mới = timestamp + số ngẫu nhiên + giữ nguyên đuôi file gốc, để tránh
  // 2 người dùng upload trùng tên file thì ghi đè lẫn nhau.
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});

// .single('license_file') = chỉ nhận 1 file, field name trong multipart/form-data phải
// đặt đúng tên "license_file" (khớp với FormData phía frontend supplier-register-page.jsx).
export const uploadSupplierLicense = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // Giới hạn 5MB/file.
  // Chặn từ chối SỚM (trước khi ghi file vào đĩa) nếu đuôi file không nằm trong danh sách
  // cho phép — tránh nhận nhầm file thực thi hoặc định dạng không mong muốn.
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.jpg', '.jpeg', '.png'];
    if (!allowed.includes(path.extname(file.originalname).toLowerCase())) {
      return cb(Object.assign(new Error('Chỉ chấp nhận file PDF/JPG/PNG.'), { status: 422 }));
    }
    cb(null, true);
  },
}).single('license_file');
