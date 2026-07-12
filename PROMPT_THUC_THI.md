Bạn là AI coding agent, làm việc trong repo C:\Users\Admin\Downloads\tttn-he2026 (đề tài tốt
nghiệp "Xây dựng website thương mại điện tử bán đặc sản vùng miền Việt Nam", nhóm 23).

TÀI LIỆU NGUỒN (đọc kỹ trước khi code, bám sát tuyệt đối, không tự thêm/bớt phạm vi ngoài
những gì 3 file này quy định):
1. C:\Users\Admin\Downloads\tttn-he2026\PLAN_3_TUAN.md
   — Kế hoạch thực thi 3 tuần, gộp 6 "tuần học thuật" thành 3 nhánh git. ĐÂY LÀ NGUỒN SỰ THẬT
   DUY NHẤT về việc tuần nào làm gì, làm theo đúng thứ tự và phạm vi trong file này.
2. C:\Users\Admin\Downloads\NHÓM 2_TTTN.docx
   — Đặc tả kỹ thuật: Actor, Usecase (danh sách + đặc tả chi tiết), Sequence Diagram, Class
   Diagram, thiết kế CSDL, Wireframe/Mockup, công nghệ đã chốt (Node.js+Express, MySQL,
   Elasticsearch, Redis, ReactJS+Tailwind, VNPay/MoMo, GHTK, OpenAI/Gemini). Mọi API, luồng
   nghiệp vụ, bảng CSDL, giao diện PHẢI khớp đúng chương/mục tương ứng đã liệt kê trong
   PLAN_3_TUAN.md.
3. C:\Users\Admin\Downloads\Đề cương Xây dựng website thương mại điện tử bán đặc sản vùng
   miền Việt Nam.docx
   — Bối cảnh đề tài, mô tả tổng quan, lý do chọn đề tài, timeline gốc (chỉ dùng để tham
   khảo ngữ cảnh, KHÔNG dùng để xác định phạm vi tuần — phạm vi tuần lấy theo PLAN_3_TUAN.md).

BƯỚC 0 — AUDIT (bắt buộc làm trước khi viết bất kỳ dòng code nào của tuần đang làm):
- Đọc toàn bộ code backend/frontend hiện có trong repo.
- Đối chiếu với checklist của TUẦN ĐANG LÀM trong PLAN_3_TUAN.md và mục UC tương ứng trong
  "NHÓM 2_TTTN.docx".
- Liệt kê: phần đã có & đúng / đã có nhưng sai hoặc thiếu / chưa có.
- Chỉ code phần thiếu hoặc sai, không viết lại phần đã đúng, tránh trùng lặp code.

QUY TRÌNH GIT (bắt buộc, theo đúng PLAN_3_TUAN.md):
- Nếu chưa có nhánh `dev`, tạo từ `main`.
- Bắt đầu tuần nào thì checkout `dev`, tạo nhánh đúng tên đã quy định trong PLAN_3_TUAN.md
  (`week1-nen-tang-nguoi-dung`, `week2-san-pham-mua-hang`, `week3-quan-tri-kiemthu`).
- Commit theo từng phần việc nhỏ, message rõ ràng, ví dụ:
  `feat(week1): API dang ky/dang nhap + JWT theo UC 2.2.1, 2.2.2`
- Làm TUẦN LƯỢT TỪNG TUẦN, không nhảy cóc. Chỉ merge nhánh tuần hiện tại vào `dev` sau khi:
  - Đã tự chạy thử thật (backend chạy được, gọi thử API bằng curl/Postman hoặc test script;
    frontend chạy dev server, thao tác thử luồng chính).
  - Đã đối chiếu xong với Definition of Done trong PLAN_3_TUAN.md.
- Sau khi merge xong 1 tuần vào `dev`, mới checkout lại `dev` và tạo nhánh cho tuần kế tiếp.
- KHÔNG tự merge `dev` vào `main` — việc đó để người dùng duyệt sau.

YÊU CẦU CHẤT LƯỢNG:
- Code chạy thật, không code giả/stub/half-done. Không bỏ qua lỗi bằng cách nuốt exception
  im lặng.
- Với các tính năng KHÔNG có UC/sequence diagram chính thức trong tài liệu (Google/Facebook
  login, quên mật khẩu, QR code truy xuất nguồn gốc, Flash Sale, CMS, Refund/Return) — thiết
  kế nhất quán với pattern đã có trong codebase và trong các UC tương tự đã đặc tả, không bịa
  ra luồng nghiệp vụ mâu thuẫn với phần đã chốt.
- Nếu phát hiện mâu thuẫn giữa PLAN_3_TUAN.md, tài liệu spec, và code hiện có — DỪNG LẠI, báo
  rõ mâu thuẫn, hỏi người dùng trước khi tự quyết định.

BÁO CÁO SAU MỖI TUẦN:
- Tóm tắt ngắn gọn: đã code gì, khớp UC/mục nào trong tài liệu, đã kiểm thử bằng cách nào,
  trạng thái nhánh (đã merge vào dev hay chưa).

BẮT ĐẦU: Thực hiện audit Bước 0 cho Tuần thực 1 (`week1-nen-tang-nguoi-dung`), báo cáo kết
quả audit, rồi bắt đầu code theo đúng checklist Tuần 1 trong PLAN_3_TUAN.md.
