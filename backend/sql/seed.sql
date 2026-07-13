-- =====================================================================
-- Du lieu mau de kiem thu Tuan 1 (auth, phan quyen, dang ky/duyet NCC).
-- Chay SAU sql/schema.sql:
--   mysql -u root -p ecommerce_db < sql/seed.sql
--
-- Mat khau seed (da bcrypt-hash san, xem ghi chu tung dong):
--   admin@example.com     / Admin@123
--   customer@example.com  / Customer@123
--   supplier@example.com  / Supplier@123 (da APPROVED, dang nhap duoc ngay)
-- =====================================================================

SET NAMES utf8mb4;

INSERT INTO `admin_roles` (`id`, `name`) VALUES
  (1, 'Super Admin')
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

INSERT INTO `regions` (`id`, `name`, `slug`, `is_active`) VALUES
  (1, 'Tây Bắc', 'tay-bac', 1),
  (2, 'Đồng bằng sông Hồng', 'dong-bang-song-hong', 1),
  (3, 'Bắc Trung Bộ', 'bac-trung-bo', 1),
  (4, 'Nam Trung Bộ', 'nam-trung-bo', 1),
  (5, 'Tây Nguyên', 'tay-nguyen', 1),
  (6, 'Đồng bằng sông Cửu Long', 'dong-bang-song-cuu-long', 1)
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

INSERT INTO `categories` (`id`, `name`, `description`, `is_active`) VALUES
  (1, 'Nông sản khô', 'Đặc sản nông sản sấy khô, đóng gói', 1),
  (2, 'Thực phẩm chế biến', 'Đặc sản chế biến sẵn, đóng hộp', 1),
  (3, 'Gia vị & Nước chấm', 'Gia vị, nước mắm, tương ớt vùng miền', 1)
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

-- password_hash = bcrypt('Admin@123', 10)
INSERT INTO `users`
  (`id`, `full_name`, `email`, `phone`, `password_hash`, `role`, `admin_role_id`, `is_active`)
VALUES
  (1, 'Quan tri vien', 'admin@example.com', '0900000001',
   '$2a$10$1bjNnkixhHjiBxAzje1MTujrUkRwPKs7zpL0q/F9u5sopjcB1S/72', 'ADMIN', 1, 1)
ON DUPLICATE KEY UPDATE `full_name` = VALUES(`full_name`),
  `password_hash` = VALUES(`password_hash`), `role` = VALUES(`role`), `is_active` = VALUES(`is_active`);

-- password_hash = bcrypt('Customer@123', 10)
INSERT INTO `users`
  (`id`, `full_name`, `email`, `phone`, `password_hash`, `role`, `is_active`)
VALUES
  (2, 'Khach hang mau', 'customer@example.com', '0900000002',
   '$2a$10$NOuTwd.J9XVW/sDb67rPBeXDksqdpSNfW2I9Tu3LAhNbqplPRTCHu', 'CUSTOMER', 1)
ON DUPLICATE KEY UPDATE `full_name` = VALUES(`full_name`),
  `password_hash` = VALUES(`password_hash`), `role` = VALUES(`role`), `is_active` = VALUES(`is_active`);

-- password_hash = bcrypt('Supplier@123', 10) — NCC mau da duoc duyet san
INSERT INTO `users`
  (`id`, `full_name`, `email`, `phone`, `password_hash`, `role`, `is_active`)
VALUES
  (3, 'Nha cung cap mau', 'supplier@example.com', '0900000003',
   '$2a$10$wl.5DnUjfH/7B/kpxPKZ.OgyIYBAFk0wmVBmCGj/16mjm3OYIGB3K', 'SUPPLIER', 1)
ON DUPLICATE KEY UPDATE `full_name` = VALUES(`full_name`),
  `password_hash` = VALUES(`password_hash`), `role` = VALUES(`role`), `is_active` = VALUES(`is_active`);

INSERT INTO `suppliers`
  (`id`, `supplier_code`, `name`, `contact_name`, `phone`, `email`, `address`,
   `region_id`, `category_id`, `user_id`, `status`, `approved_by_user_id`, `approved_at`, `is_active`)
VALUES
  (1, 'NCC001', 'HTX Đặc sản Tây Bắc', 'Nha cung cap mau', '0900000003',
   'supplier@example.com', 'Sơn La', 1, 1, 3, 'APPROVED', 1, NOW(), 1)
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

INSERT INTO `products`
  (`id`, `category_id`, `supplier_id`, `region_id`, `sku`, `slug`, `name`, `description`,
   `image_url`, `sale_price`, `stock_quantity`, `is_active`)
VALUES
  (1, 1, 1, 1, 'SP001', 'mang-kho-tay-bac', 'Măng khô Tây Bắc', 'Măng khô hái tự nhiên, sấy thủ công.',
   NULL, 120000, 50, 1),
  (2, 3, 1, 6, 'SP002', 'nuoc-mam-phu-quoc', 'Nước mắm Phú Quốc', 'Nước mắm truyền thống 40 độ đạm.',
   NULL, 95000, 80, 1)
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

-- Bài viết cộng đồng (để trang Bài viết / Cộng đồng không trống).
INSERT INTO `posts` (`id`, `created_by_user_id`, `title`, `excerpt`, `body`, `status`, `published_at`) VALUES
 (1, 1, 'Măng khô Tây Bắc — tinh túy núi rừng', 'Câu chuyện về nghề hái và sấy măng thủ công của bà con Tây Bắc.',
  'Măng khô Tây Bắc được hái từ những búp măng non trên rừng, luộc kỹ rồi phơi sấy thủ công nhiều ngày, giữ trọn hương vị núi rừng.', 'PUBLISHED', NOW()),
 (2, 1, 'Nước mắm Phú Quốc — di sản trăm năm', 'Hành trình từ con cá cơm tươi đến giọt nước mắm nhĩ vàng óng.',
  'Nước mắm Phú Quốc được ủ chượp trong thùng gỗ suốt 12 tháng, cho độ đạm cao và hương thơm đặc trưng.', 'PUBLISHED', NOW())
ON DUPLICATE KEY UPDATE `title` = VALUES(`title`), `status` = 'PUBLISHED', `published_at` = NOW();

INSERT INTO `post_comments` (`post_id`, `user_id`, `content`, `status`) VALUES
 (1, 2, 'Bài viết rất hay, mình đã đặt măng khô về ăn thử!', 'VISIBLE'),
 (2, 2, 'Nước mắm Phú Quốc đúng là số một, ủng hộ shop.', 'VISIBLE');

INSERT INTO `supplier_invitations` (`supplier_name`, `contact_name`, `email`, `note`, `created_by_user_id`) VALUES
 ('HTX Trà Thái Nguyên', 'Nguyễn Văn Trà', 'tra-thainguyen@example.com', 'Mời hợp tác cung cấp trà đặc sản', 1);
