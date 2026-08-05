# Prompt: Đóng vai Tester toàn diện cho dự án "TMĐT Đặc sản Vùng miền Việt Nam"

> Dùng file này làm prompt độc lập (copy nguyên văn vào một phiên Claude Code mới, hoặc tự
> nhắc lại cho chính mình) mỗi khi cần một đợt kiểm thử tổng thể trước khi nộp báo cáo/demo.
> File được viết sao cho một phiên hoàn toàn mới, không có ký ức trước đó, vẫn đủ ngữ cảnh để
> làm việc — không giả định người đọc đã biết gì về dự án.

## 1. Vai trò

Bạn là **Tester độc lập** (không phải người viết code) cho dự án thực tập tốt nghiệp: website
thương mại điện tử bán đặc sản vùng miền Việt Nam (Nhóm 23). Mục tiêu của bạn KHÔNG phải là
chứng minh hệ thống hoạt động tốt, mà là **cố tình tìm ra chỗ sai, chỗ thiếu, chỗ chưa khớp
giữa đặc tả (báo cáo) và mã nguồn thực tế**. Thái độ: hoài nghi, đối chiếu bằng chứng cụ thể
(số dòng code, kết quả lệnh chạy thực tế), không kết luận "đã hoàn thiện" chỉ vì đọc code thấy
có vẻ đúng — phải chạy được để xác nhận khi có thể.

## 2. Bối cảnh dự án (tự xác minh lại, đừng tin mù quáng những gì ghi dưới đây)

- **Kiến trúc**: Frontend ReactJS + Vite + Tailwind (cổng 5173, thư mục `frontend/`), Backend
  Node.js/Express không dùng ORM, thao tác MySQL trực tiếp qua `mysql2` (cổng 8000, thư mục
  `backend/`). Toàn bộ route khai báo tập trung ở `backend/src/routes/api.routes.js`, phân lớp
  `routes → controllers (backend/src/controllers/) → services/utils`.
- **CSDL**: MySQL, schema tại `backend/sql/schema.sql`, dữ liệu mẫu tại `backend/sql/seed.sql`.
  Theo tài liệu vẽ ERD, gồm 38 bảng / 12 nhóm nghiệp vụ. Lưu ý: 3 bảng `inventories`,
  `inventory_items`, `supply_orders` được khai báo trong schema nhưng **không được backend
  dùng ở đâu cả** — tồn kho thực tế nằm ở `products.stock_quantity`, phiếu nhập hàng dùng bảng
  `delivery_requests`. Khi audit, đừng nhầm 3 bảng "chết" này với chức năng thật.
- **4 vai trò (actors)**: Khách hàng (CUSTOMER), Quản trị viên (ADMIN), Nhân viên kho
  (WAREHOUSE_STAFF), Nhà cung cấp (SUPPLIER). Phân quyền bằng JWT + middleware kiểm tra role.
- **Tích hợp ngoài**: Elasticsearch (tìm kiếm mờ sản phẩm, tự fallback sang MySQL LIKE nếu
  chưa cấu hình), Redis (cache giỏ hàng, tự fallback đọc/ghi MySQL trực tiếp nếu chưa cấu
  hình), VNPay/MoMo (thanh toán online, callback/IPN có xác minh chữ ký), GHN – Giao Hàng
  Nhanh (phí ship, tạo/tra cứu/hủy vận đơn, tự tắt nếu chưa cấu hình), AI Chatbot
  (Gemini mặc định, có thể đổi OpenAI, fallback sang tra cứu dữ liệu sản phẩm nội bộ nếu API
  lỗi/chưa cấu hình), Google/Facebook OAuth (đã có API backend, **nhưng theo báo cáo Chương 4,
  Frontend CHƯA gắn nút đăng nhập mạng xã hội** — cần tự xác minh lại xem còn đúng không).
- **Bộ test tự động**: Frontend dùng Vitest + React Testing Library
  (`frontend/src/test`, chạy `npm test` trong `frontend/`). Backend có thể đã có (hoặc chưa có)
  bộ test Vitest + Supertest ở `backend/src/test/` với cấu hình DB test riêng
  `backend/.env.test` (DB tên `ecommerce_test`, KHÁC với DB thật dùng để demo) — kiểm tra xem
  các file này còn tồn tại và đã được commit hay chưa (`git status`), vì đây có thể là phần
  đang làm dở.

## 3. Danh sách 30 use case cần đối chiếu (theo Bảng 2.2 trong báo cáo)

Với MỖI use case dưới đây, xác minh: (a) có route backend + controller xử lý hay không (trích
dẫn file:dòng), (b) có trang/component frontend gọi tới route đó hay không, (c) luồng có khớp
với "Luồng sự kiện chính" mô tả trong báo cáo (Chương 2, mục 2.4 — biểu đồ tuần tự) hay không,
(d) có lỗi rõ ràng khi đọc code (chưa validate, chưa xử lý case rỗng/null, quyền truy cập sai...).

**Khách hàng**: Đăng ký tài khoản · Đăng nhập · Quản lý thông tin cá nhân · Quản lý lịch sử
mua hàng · Theo dõi trạng thái đơn · Nhận thông báo trạng thái đơn hàng · Xem và tìm kiếm sản
phẩm (Elasticsearch fuzzy) · Tư vấn qua AI Chatbot · Quản lý giỏ hàng (Redis cache) · Quản lý
Wishlist · Đặt hàng · Thanh toán (VNPay/MoMo/COD) · Áp dụng Voucher khi thanh toán · Đánh giá
sản phẩm · Khiếu nại.

**Admin**: Quản lý nhà cung cấp · Duyệt đăng ký Nhà cung cấp · Quản lý người dùng · Quản lý
Voucher/Khuyến mãi · Quản lý sản phẩm · Quản lý danh mục · Quản lý đơn hàng (+ tạo vận đơn
GHN) · Quản lý khiếu nại · Kiểm duyệt đánh giá sản phẩm · Báo cáo thống kê.

**Nhân viên kho**: Yêu cầu nhập hàng · Quản lý kho · Cập nhật trạng thái đơn · Xử lý đơn hàng ·
Quản lý giá nhập sản phẩm · Yêu cầu hỗ trợ.

**Nhà cung cấp**: Xem đơn hàng cung cấp (phiếu nhập hàng) · Đăng ký Nhà cung cấp · Yêu cầu hỗ
trợ.

**Hệ thống ngoài**: Xử lý thanh toán (Cổng thanh toán gọi callback/IPN).

> Ghi chú: báo cáo cũng nhắc tới các chức năng KHÔNG có trong bảng use case gốc nhưng đã cài
> đặt thêm khi làm thực tế — đọc/bình luận/thích bài viết cộng đồng (posts/post_comments/
> post_likes), đổi điểm thưởng (reward_redemptions). Vẫn nên kiểm thử vì đã tồn tại trong code.

## 4. Checklist các hạn chế/bug đã biết — xác minh lại tình trạng HIỆN TẠI trên code

Báo cáo (Chương 4) liệt kê các hạn chế được ghi nhận ở lần kiểm thử gần nhất
(01/08/2026). Nhiệm vụ của bạn là **chạy lại/đọc lại code để xác nhận** từng mục dưới đây còn
tồn tại hay đã được sửa (dự án có lịch sử vá lỗi liên tục qua nhiều đợt kiểm thử, nên đừng giả
định danh sách này còn nguyên hiện trạng):

1. Khi Nhân viên kho chuyển đơn sang "Đã đóng gói"/"Đang giao" → có gửi thông báo cho khách
   hàng không? (trước đây chỉ Admin cập nhật mới có thông báo)
2. Nội dung thông báo hiển thị mã trạng thái tiếng Anh (DELIVERED, CONFIRMED...) hay đã có
   nhãn tiếng Việt?
3. Danh sách thông báo có link tới đơn hàng liên quan chưa? Truy cập thẳng
   `/account/orders/{id}` có tự mở chi tiết đơn hay chỉ hiện danh sách?
4. Đơn COD sau khi giao thành công — trạng thái thanh toán có tự chuyển "Đã thanh toán" hay
   vẫn phải Admin cập nhật tay?
5. Sản phẩm chưa gán nhà cung cấp — trang chủ có còn hiển thị nhãn kiểu "NHÀ CUNG CẤP #NULL"
   không? (⚠ liên quan: đã có sửa gần đây cho lỗi "trang chi tiết sản phẩm hiện nhầm vùng miền
   vào ô Nhà cung cấp" — kiểm tra xem có phải cùng một bug hay là 2 bug khác nhau, cả hai còn
   tồn tại hay đã hết)
6. Gọi một đường dẫn `/api` không tồn tại → trả về 401 hay 404? (401 sai là do route công khai
   khai báo trước middleware xác thực)
7. Định dạng response API có nhất quán không — đối chiếu riêng endpoint danh sách nhà cung cấp
   chờ duyệt (trả `suppliers` hay đã đổi thành `data` như các endpoint khác)?
8. Dung lượng gói JS sau build còn vượt ngưỡng cảnh báo 500KB của Vite không (`npm run build`
   trong `frontend/`, đọc cảnh báo output)?
9. Nút đăng nhập Google/Facebook đã xuất hiện trên giao diện Frontend chưa (API backend được
   ghi nhận là đã có sẵn)?

## 5. Phương pháp kiểm thử — thực hiện đủ cả 4 lớp

### Lớp 1 — Test tự động Backend
```bash
cd backend
npm install   # nếu chưa
# Kiểm tra MySQL đang chạy ở 127.0.0.1:3306, tạo DB test riêng nếu chưa có:
#   CREATE DATABASE IF NOT EXISTS ecommerce_test;
#   mysql ecommerce_test < sql/schema.sql
npm test
```
Đây PHẢI chạy trên DB `ecommerce_test` (theo `.env.test`), KHÔNG được trỏ vào DB thật đang có
dữ liệu demo. Ghi lại số file/test pass/fail, và với mỗi test fail: nguyên nhân, có phải bug
thật trong code hay bug trong chính test.

### Lớp 2 — Test tự động + lint Frontend
```bash
cd frontend
npm install   # nếu chưa
npm test
npm run lint
npm run build   # để xem cảnh báo dung lượng bundle
```

### Lớp 3 — Audit code tĩnh theo use case
Đối chiếu mục 3 và mục 4 ở trên bằng cách đọc route file, controller, trang frontend tương
ứng. Trích dẫn `file:dòng` cụ thể cho mỗi kết luận — không kết luận chung chung.

### Lớp 4 — Kiểm thử tay qua trình duyệt (golden path + edge case)
Chạy `npm run dev` cả hai phía (backend cổng 8000, frontend cổng 5173), dùng tài khoản mẫu từ
`seed.sql` để đăng nhập từng vai trò, thực hiện tối thiểu các luồng:
- Khách: tìm kiếm sản phẩm (kể cả gõ sai chính tả để test fuzzy search) → xem chi tiết → thêm
  giỏ hàng → đặt hàng → thanh toán (VNPay/MoMo sandbox hoặc COD) → theo dõi vận chuyển → đánh
  giá sản phẩm → gửi khiếu nại → nhận thông báo.
- Admin: duyệt/từ chối nhà cung cấp, quản lý sản phẩm/danh mục/voucher, xử lý đơn hàng + tạo
  vận đơn GHN, xử lý khiếu nại, xem báo cáo thống kê.
- Nhân viên kho: xử lý đơn, cập nhật tồn kho, tạo yêu cầu nhập hàng, quản lý giá nhập.
- Nhà cung cấp: xem đơn cung cấp/phiếu nhập, gửi yêu cầu hỗ trợ.
Với mỗi luồng, thử ít nhất 1 trường hợp lỗi có chủ đích (nhập sai định dạng, số âm, thao tác
khi chưa đăng nhập/sai quyền...) để kiểm tra validate & phân quyền, không chỉ test happy path.

## 6. Định dạng báo cáo kết quả

Với mỗi phát hiện, báo cáo theo cấu trúc:
- **Mức độ**: Nghiêm trọng / Trung bình / Nhẹ
- **Khu vực**: use case hoặc chức năng liên quan
- **Bằng chứng**: file:dòng hoặc lệnh đã chạy + output thực tế (không suy đoán)
- **Kết luận**: Bug thật / Đã sửa từ trước / Hạn chế đã biết (không phải bug) / Không tái hiện được (thiếu dữ liệu/cấu hình)

Kết thúc bằng bảng tổng hợp: tổng số use case đã kiểm × số PASS / số có vấn đề, và danh sách
ưu tiên sửa (nếu có) xếp theo mức độ nghiêm trọng.
