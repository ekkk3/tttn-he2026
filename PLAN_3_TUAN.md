# Kế hoạch triển khai 100% hệ thống trong 3 tuần

Tài liệu tham chiếu bắt buộc:
- `NHÓM 2_TTTN.docx` — đặc tả kỹ thuật (Actor, Usecase, Sequence Diagram, Class Diagram/CSDL, Wireframe, Công nghệ)
- `Đề cương ...docx` — timeline gốc + timeline cập nhật (đã đối chiếu, gộp phạm vi ở dưới)

Quy ước git:
- `main`: ổn định, chỉ merge khi được duyệt thủ công.
- `dev`: nhánh tích hợp chính, tạo từ `main` nếu chưa có.
- Mỗi tuần thực thi = 1 nhánh riêng từ `dev`, merge lại `dev` sau khi tự test xong, rồi mới tạo nhánh tuần kế tiếp.

---

## Tuần thực 1 — nhánh `week1-nen-tang-nguoi-dung` (= Tuần học thuật 1+2)

**Backend**
- Audit code hiện có (đã có sẵn nhiều controller từ trước — chỉ bổ sung/sửa phần thiếu/sai).
- Thiết kế & migrate CSDL MySQL đầy đủ theo Chương 4 (Users, Roles, Suppliers...).
- Auth: đăng ký/đăng nhập email+password, JWT; Google/Facebook OAuth login; quên mật khẩu (reset qua email).
- Middleware phân quyền 4 vai trò (Khách hàng, Admin, Nhà cung cấp, Nhân viên kho).
- API đăng ký Nhà cung cấp + luồng Admin duyệt; API quản lý người dùng (Admin CRUD).

**Frontend**
- Khởi tạo/chuẩn hoá React (Vite) + Tailwind theo Chương 5 wireframe.
- Trang: Trang chủ, Đăng nhập, Đăng ký (khách hàng + form NCC), Quên mật khẩu, Profile, trang Admin quản lý người dùng.

**Đối chiếu tài liệu:** UC 2.2.1, 2.2.2, 2.2.3, 2.2.12, 2.2.12a, 2.2.12b, 2.2.14.

---

## Tuần thực 2 — nhánh `week2-san-pham-mua-hang` (= Tuần học thuật 3+4)

**Backend**
- CRUD Danh mục/Sản phẩm (Admin + NCC chỉ sửa sản phẩm của mình); field nguồn gốc/vùng miền + QR code truy xuất nguồn gốc.
- Elasticsearch fuzzy search cho sản phẩm.
- Wishlist API; Đánh giá sản phẩm API (kèm cờ chờ kiểm duyệt).
- Giỏ hàng bằng Redis; API Đặt hàng; Voucher (Admin tạo, áp dụng lúc checkout); Flash Sale (khung giờ giảm giá).
- Thanh toán VNPay/MoMo; Notification (email/push) khi đơn hàng đổi trạng thái; API theo dõi trạng thái đơn.

**Frontend**
- Danh mục, Chi tiết sản phẩm (mục "Nguồn gốc sản phẩm" + QR), trang quản lý sản phẩm cho NCC.
- Wishlist, Đánh giá sản phẩm.
- Giỏ hàng, Checkout (nhập mã giảm giá, banner Flash Sale), xử lý redirect VNPay/MoMo, trang theo dõi đơn hàng, chuông thông báo.

**Đối chiếu tài liệu:** UC 2.2.6, 2.2.7, 2.2.7a, 2.2.8, 2.2.9, 2.2.9a, 2.2.10, 2.2.5, 2.2.5a, 2.2.13, 2.2.15, 2.2.16.

---

## Tuần thực 3 — nhánh `week3-quan-tri-kiemthu` (= Tuần học thuật 5+6)

**Backend**
- Quản lý kho, phiếu nhập + NCC xác nhận phiếu nhập, quản lý giá nhập, tồn kho.
- Admin Dashboard: báo cáo thống kê doanh thu (Admin + riêng NCC).
- CMS (banner/trang tĩnh); Refund/Return; Khiếu nại + Admin xử lý khiếu nại; kiểm duyệt đánh giá (chống spam).
- AI Chatbot (`/api/chat`, OpenAI/Gemini).
- Tích hợp vận chuyển (GHTK) nếu còn trong phạm vi — nếu sandbox GHTK không khả dụng, dùng abstraction thay thế và ghi rõ.

**Frontend**
- Admin Dashboard (biểu đồ), Dashboard NCC, giao diện Kho/Phiếu nhập, CMS admin.
- Giao diện Refund/Return, Gửi khiếu nại + trang Admin kiểm duyệt, widget AI Chatbot.

**Kiểm thử & hoàn thiện**
- Test end-to-end từng module (không chỉ viết code — chạy thử thật, gọi API thật).
- Fix bug, chuẩn hoá README/hướng dẫn deploy.

**Đối chiếu tài liệu:** UC 2.2.11, 2.2.17–2.2.25, 2.2.6a, 2.2.10a, Chương 6.3 kiến trúc hệ thống.

---

## Định nghĩa "Hoàn thành" (Definition of Done) mỗi tuần
- Code chạy được thật, không có phần giả/half-done.
- Đã tự kiểm thử (chạy be/fe, gọi thử API) trước khi merge vào `dev`.
- Đối chiếu đúng UC/sequence diagram/CSDL trong tài liệu, ghi chú phần nào là bổ sung ngoài tài liệu gốc (Google/FB login, quên mật khẩu, QR code, Flash Sale, CMS, Refund/Return).
- Có tóm tắt ngắn gọn: đã làm gì, khớp mục nào trong tài liệu, cách đã kiểm thử.
