-- =====================================================================
-- Du lieu mau de kiem thu Tuan 1 (auth, phan quyen, dang ky/duyet NCC).
-- Chay SAU sql/schema.sql:
--   mysql -u root -p ecommerce_db < sql/seed.sql
--
-- Mat khau seed (da bcrypt-hash san, xem ghi chu tung dong):
--   admin@example.com     / Admin@123
--   customer@example.com  / Customer@123
--   supplier@example.com  / Supplier@123 (da APPROVED, dang nhap duoc ngay)
--
-- Tu phan "DU LIEU MAU PHONG PHU" ben duoi con them (dung cho demo/bao cao,
-- xem chi tiet o dau phan do): warehouse@example.com / Warehouse@123,
-- lan.nguyen@example.com + minh.tran@example.com / Customer@123,
-- supplier2@example.com + supplier3@example.com / Supplier@123.
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

-- =====================================================================
-- DU LIEU MAU PHONG PHU (bo sung sau seed goc) - de demo/bao cao co du
-- lieu that: nhieu san pham/danh muc/NCC, don hang trai dai 30 ngay gan
-- nhat (bieu do doanh thu khong trong), voucher, don vi van chuyen, danh
-- gia, khieu nai, ticket ho tro, thong bao...
--
-- Tai khoan moi them (mat khau demo, da bcrypt-hash san):
--   warehouse@example.com / Warehouse@123  (Nhan vien kho)
--   lan.nguyen@example.com / Customer@123  (Khach hang)
--   minh.tran@example.com / Customer@123   (Khach hang)
--   supplier2@example.com / Supplier@123   (NCC Tay Nguyen)
--   supplier3@example.com / Supplier@123   (NCC Mien Trung)
--
-- Dung DATE_SUB(NOW(), INTERVAL n DAY) cho don hang/lich su de bieu do
-- doanh thu 30 ngay gan nhat luon co du lieu bat ke chay seed luc nao.
-- =====================================================================

INSERT INTO `categories` (`id`, `name`, `description`, `is_active`) VALUES
  (4, 'Trà & Cà phê', 'Trà, cà phê đặc sản vùng miền', 1),
  (5, 'Bánh kẹo đặc sản', 'Bánh, kẹo, mứt đặc sản vùng miền', 1),
  (6, 'Hạt & Đậu khô', 'Các loại hạt, đậu rang/sấy khô', 1)
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

INSERT INTO `users`
  (`id`, `full_name`, `email`, `phone`, `password_hash`, `role`, `is_active`)
VALUES
  (4, 'Nhan vien kho mau', 'warehouse@example.com', '0900000004', '$2a$10$l3HAvHzT6j/qY5jYJ9AxFuVLyjwVtS6odd/wLPXdUp3TlLSVOE3Qy', 'WAREHOUSE_STAFF', 1),
  (5, 'Nguyen Thi Lan', 'lan.nguyen@example.com', '0911111111', '$2a$10$NOuTwd.J9XVW/sDb67rPBeXDksqdpSNfW2I9Tu3LAhNbqplPRTCHu', 'CUSTOMER', 1),
  (6, 'Tran Van Minh', 'minh.tran@example.com', '0922222222', '$2a$10$NOuTwd.J9XVW/sDb67rPBeXDksqdpSNfW2I9Tu3LAhNbqplPRTCHu', 'CUSTOMER', 1),
  (7, 'Dai dien NCC Tay Nguyen', 'supplier2@example.com', '0933333333', '$2a$10$wl.5DnUjfH/7B/kpxPKZ.OgyIYBAFk0wmVBmCGj/16mjm3OYIGB3K', 'SUPPLIER', 1),
  (8, 'Dai dien NCC Mien Trung', 'supplier3@example.com', '0944444444', '$2a$10$wl.5DnUjfH/7B/kpxPKZ.OgyIYBAFk0wmVBmCGj/16mjm3OYIGB3K', 'SUPPLIER', 1)
ON DUPLICATE KEY UPDATE `full_name` = VALUES(`full_name`),
  `password_hash` = VALUES(`password_hash`), `role` = VALUES(`role`), `is_active` = VALUES(`is_active`);

INSERT INTO `suppliers`
  (`id`, `supplier_code`, `name`, `contact_name`, `phone`, `email`, `address`,
   `region_id`, `category_id`, `user_id`, `status`, `approved_by_user_id`, `approved_at`, `is_active`)
VALUES
  (2, 'NCC002', 'HTX Trà & Cà phê Tây Nguyên', 'Dai dien NCC Tay Nguyen', '0933333333', 'supplier2@example.com', 'Buôn Ma Thuột, Đắk Lắk', 5, 4, 7, 'APPROVED', 1, NOW(), 1),
  (3, 'NCC003', 'Cơ sở Bánh kẹo Miền Trung', 'Dai dien NCC Mien Trung', '0944444444', 'supplier3@example.com', 'Thanh Hóa', 3, 5, 8, 'APPROVED', 1, NOW(), 1)
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

INSERT INTO `products`
  (`id`, `category_id`, `supplier_id`, `region_id`, `sku`, `slug`, `name`, `description`,
   `origin`, `short_description`, `sale_price`, `purchase_price`, `stock_quantity`, `reorder_level`, `is_active`)
VALUES
  (3, 1, 1, 1, 'SP003', 'moc-nhi-tay-bac', 'Mộc nhĩ Tây Bắc', 'Mộc nhĩ rừng phơi khô tự nhiên, dày cánh, giòn khi ngâm nở.', 'Sơn La', 'Mộc nhĩ rừng sấy khô nguyên cánh.', 85000, 55000, 60, 10, 1),
  (4, 2, 1, 1, 'SP004', 'thit-trau-gac-bep-son-la', 'Thịt trâu gác bếp Sơn La', 'Thịt trâu tẩm ướp mắc khén, gác bếp theo cách người Thái đen.', 'Sơn La', 'Thịt trâu khô hun khói, cay nhẹ mắc khén.', 350000, 240000, 25, 8, 1),
  (5, 4, 2, 2, 'SP005', 'che-thai-nguyen-dac-biet', 'Chè Thái Nguyên đặc biệt', 'Chè móc câu Tân Cương, sao thủ công, nước xanh vàng, vị chát dịu hậu ngọt.', 'Thái Nguyên', 'Chè móc câu Tân Cương sao thủ công.', 180000, 120000, 40, 10, 1),
  (6, 4, 2, 5, 'SP006', 'ca-phe-buon-ma-thuot', 'Cà phê Buôn Ma Thuột', 'Cà phê Robusta rang mộc nguyên chất, hương thơm đậm đà đặc trưng Tây Nguyên.', 'Đắk Lắk', 'Cà phê Robusta rang mộc nguyên chất.', 150000, 95000, 45, 10, 1),
  (7, 5, 1, 2, 'SP007', 'banh-dau-xanh-hai-duong', 'Bánh đậu xanh Hải Dương', 'Bánh đậu xanh truyền thống, tan nhẹ trong miệng, đóng hộp giấy cổ điển.', 'Hải Dương', 'Bánh đậu xanh truyền thống đóng hộp.', 60000, 38000, 8, 10, 1),
  (8, 5, 3, 6, 'SP008', 'keo-dua-ben-tre', 'Kẹo dừa Bến Tre', 'Kẹo dừa nguyên chất từ nước cốt dừa Bến Tre, dẻo thơm béo ngậy.', 'Bến Tre', 'Kẹo dừa nguyên chất, dẻo thơm béo ngậy.', 45000, 28000, 100, 15, 1),
  (9, 6, 2, 4, 'SP009', 'hat-dieu-rang-muoi-binh-phuoc', 'Hạt điều rang muối Bình Phước', 'Hạt điều loại 1 rang muối vừa ăn, béo bùi, không hóa chất bảo quản.', 'Bình Phước', 'Hạt điều loại 1 rang muối, béo bùi.', 130000, 88000, 70, 15, 1),
  (10, 6, 2, 4, 'SP010', 'dau-phong-da-ca-tay-ninh', 'Đậu phộng da cá Tây Ninh', 'Đậu phộng bọc lớp bột giòn rụm vị mặn ngọt, món ăn vặt quen thuộc.', 'Tây Ninh', 'Đậu phộng bọc bột giòn rụm mặn ngọt.', 55000, 34000, 90, 15, 1),
  (11, 3, 1, 1, 'SP011', 'tuong-ot-muong-khuong', 'Tương ớt Mường Khương', 'Tương ớt lên men tự nhiên từ ớt Mường Khương, cay nồng đặc trưng vùng cao.', 'Lào Cai', 'Tương ớt lên men tự nhiên, cay nồng.', 40000, 24000, 55, 10, 1),
  (12, 3, 3, 3, 'SP012', 'mam-tom-thanh-hoa', 'Mắm tôm Thanh Hóa', 'Mắm tôm nguyên chất ủ chượp truyền thống, dùng chấm hoặc nêm món ăn.', 'Thanh Hóa', 'Mắm tôm nguyên chất ủ chượp truyền thống.', 50000, 32000, 30, 10, 1),
  (13, 2, 3, 4, 'SP013', 'banh-trang-phoi-suong-trang-bang', 'Bánh tráng phơi sương Trảng Bàng', 'Bánh tráng dẻo phơi sương đặc sản Tây Ninh, cuốn cùng rau sống và thịt luộc.', 'Tây Ninh', 'Bánh tráng dẻo phơi sương đặc sản.', 35000, 20000, 5, 10, 1),
  (14, 2, 3, 3, 'SP014', 'nem-chua-thanh-hoa', 'Nem chua Thanh Hóa', 'Nem chua lên men tự nhiên, vị chua thanh, ăn kèm tương ớt và lá đinh lăng.', 'Thanh Hóa', 'Nem chua lên men tự nhiên, vị chua thanh.', 70000, 45000, 40, 10, 1),
  (15, 2, 2, 5, 'SP015', 'ruou-can-tay-nguyen', 'Rượu cần Tây Nguyên', 'Rượu cần ủ men lá rừng theo cách người Ê Đê, uống bằng cần trúc truyền thống.', 'Đắk Lắk', 'Rượu cần ủ men lá rừng truyền thống.', 220000, 150000, 20, 5, 1),
  (16, 4, 2, 5, 'SP016', 'tra-o-long-bao-loc', 'Trà Ô Long Bảo Lộc', 'Trà Ô Long lên men bán phần, hương thơm dịu, hậu vị ngọt kéo dài.', 'Lâm Đồng', 'Trà Ô Long lên men bán phần, hương dịu.', 195000, 130000, 35, 10, 1)
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

INSERT INTO `purchase_prices` (`id`, `product_id`, `supplier_id`, `price`, `effective_date`, `note`, `created_by_user_id`) VALUES
  (1, 3, 1, 55000, DATE_SUB(CURDATE(), INTERVAL 30 DAY), 'Giá nhập ban đầu', 1),
  (2, 4, 1, 240000, DATE_SUB(CURDATE(), INTERVAL 30 DAY), 'Giá nhập ban đầu', 1),
  (3, 5, 2, 120000, DATE_SUB(CURDATE(), INTERVAL 30 DAY), 'Giá nhập ban đầu', 1),
  (4, 6, 2, 95000, DATE_SUB(CURDATE(), INTERVAL 30 DAY), 'Giá nhập ban đầu', 1),
  (5, 7, 1, 38000, DATE_SUB(CURDATE(), INTERVAL 30 DAY), 'Giá nhập ban đầu', 1),
  (6, 8, 3, 28000, DATE_SUB(CURDATE(), INTERVAL 30 DAY), 'Giá nhập ban đầu', 1),
  (7, 9, 2, 88000, DATE_SUB(CURDATE(), INTERVAL 30 DAY), 'Giá nhập ban đầu', 1),
  (8, 10, 2, 34000, DATE_SUB(CURDATE(), INTERVAL 30 DAY), 'Giá nhập ban đầu', 1),
  (9, 11, 1, 24000, DATE_SUB(CURDATE(), INTERVAL 30 DAY), 'Giá nhập ban đầu', 1),
  (10, 12, 3, 32000, DATE_SUB(CURDATE(), INTERVAL 30 DAY), 'Giá nhập ban đầu', 1),
  (11, 13, 3, 20000, DATE_SUB(CURDATE(), INTERVAL 30 DAY), 'Giá nhập ban đầu', 1),
  (12, 14, 3, 45000, DATE_SUB(CURDATE(), INTERVAL 30 DAY), 'Giá nhập ban đầu', 1),
  (13, 15, 2, 150000, DATE_SUB(CURDATE(), INTERVAL 30 DAY), 'Giá nhập ban đầu', 1),
  (14, 16, 2, 130000, DATE_SUB(CURDATE(), INTERVAL 30 DAY), 'Giá nhập ban đầu', 1),
  (15, 1, 1, 80000, DATE_SUB(CURDATE(), INTERVAL 30 DAY), 'Giá nhập ban đầu', 1),
  (16, 2, 1, 65000, DATE_SUB(CURDATE(), INTERVAL 30 DAY), 'Giá nhập ban đầu', 1)
ON DUPLICATE KEY UPDATE `price` = VALUES(`price`);

UPDATE `products` SET `purchase_price` = 80000 WHERE `id` = 1 AND `purchase_price` IS NULL;
UPDATE `products` SET `purchase_price` = 65000 WHERE `id` = 2 AND `purchase_price` IS NULL;

INSERT INTO `shipping_carriers` (`id`, `code`, `name`, `provider`, `is_active`) VALUES
  (1, 'GHN', 'Giao Hàng Nhanh', 'GHN', 1),
  (2, 'NOISTORE', 'Giao hàng nội thành (tự vận chuyển)', 'MANUAL', 1)
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

INSERT INTO `vouchers`
  (`id`, `code`, `description`, `discount_type`, `discount_value`, `min_order_amount`,
   `max_discount_amount`, `usage_limit`, `used_count`, `starts_at`, `expires_at`, `is_active`, `created_by_admin_id`) VALUES
  (1, 'WELCOME10', 'Giảm 10% cho đơn hàng đầu tiên', 'PERCENT', 10, 100000, 50000, 100, 2, DATE_SUB(NOW(), INTERVAL 20 DAY), DATE_ADD(NOW(), INTERVAL 40 DAY), 1, 1),
  (2, 'FREESHIP30', 'Giảm 30.000đ phí vận chuyển', 'FIXED', 30000, 200000, NULL, 200, 1, DATE_SUB(NOW(), INTERVAL 15 DAY), DATE_ADD(NOW(), INTERVAL 30 DAY), 1, 1),
  (3, 'SUMMER50K', 'Giảm 50.000đ cho đơn từ 300.000đ', 'FIXED', 50000, 300000, NULL, 50, 1, DATE_SUB(NOW(), INTERVAL 5 DAY), DATE_ADD(NOW(), INTERVAL 10 DAY), 1, 1),
  (4, 'HETHAN2026', 'Khuyến mãi tháng trước (đã hết hạn)', 'PERCENT', 20, 150000, 80000, 50, 0, DATE_SUB(NOW(), INTERVAL 45 DAY), DATE_SUB(NOW(), INTERVAL 10 DAY), 1, 1)
ON DUPLICATE KEY UPDATE `description` = VALUES(`description`);

INSERT INTO `orders`
  (`id`, `user_id`, `order_no`, `recipient_name`, `recipient_phone`, `shipping_address`,
   `shipping_province_id`, `shipping_province_name`, `shipping_district_id`, `shipping_district_name`,
   `shipping_ward_code`, `shipping_ward_name`,
   `payment_method`, `status`, `subtotal`, `shipping_fee`, `discount_amount`, `total_amount`, `note`,
   `cancelled_at`, `delivered_at`, `shipped_at`, `created_at`, `updated_at`) VALUES
  (1, 2, 'DH1780000000137', 'Khach hang mau', '0900000002', '123 Phố Huế, P. Ngô Thì Nhậm, Q. Hai Bà Trưng', NULL, 'Hà Nội', NULL, NULL, NULL, NULL, 'COD', 'DELIVERED', 335000, 20000, 0, 355000, NULL, NULL, DATE_SUB(NOW(), INTERVAL 528 HOUR), DATE_SUB(NOW(), INTERVAL 600 HOUR), DATE_SUB(NOW(), INTERVAL 672 HOUR), DATE_SUB(NOW(), INTERVAL 528 HOUR)),
  (2, 5, 'DH1780000000274', 'Nguyen Thi Lan', '0911111111', '45 Nguyễn Trãi, P. Bến Thành, Q.1', NULL, 'Hồ Chí Minh', NULL, NULL, NULL, NULL, 'VNPAY', 'DELIVERED', 330000, 20000, 0, 350000, NULL, NULL, DATE_SUB(NOW(), INTERVAL 480 HOUR), DATE_SUB(NOW(), INTERVAL 552 HOUR), DATE_SUB(NOW(), INTERVAL 600 HOUR), DATE_SUB(NOW(), INTERVAL 480 HOUR)),
  (3, 2, 'DH1780000000411', 'Khach hang mau', '0900000002', '123 Phố Huế, P. Ngô Thì Nhậm, Q. Hai Bà Trưng', NULL, 'Hà Nội', NULL, NULL, NULL, NULL, 'COD', 'DELIVERED', 350000, 20000, 35000, 335000, NULL, NULL, DATE_SUB(NOW(), INTERVAL 432 HOUR), DATE_SUB(NOW(), INTERVAL 480 HOUR), DATE_SUB(NOW(), INTERVAL 552 HOUR), DATE_SUB(NOW(), INTERVAL 432 HOUR)),
  (4, 6, 'DH1780000000548', 'Tran Van Minh', '0922222222', '78 Trần Phú, P. Hải Châu 1, Q. Hải Châu', NULL, 'Đà Nẵng', NULL, NULL, NULL, NULL, 'MOMO', 'DELIVERED', 315000, 20000, 0, 335000, NULL, NULL, DATE_SUB(NOW(), INTERVAL 360 HOUR), DATE_SUB(NOW(), INTERVAL 408 HOUR), DATE_SUB(NOW(), INTERVAL 480 HOUR), DATE_SUB(NOW(), INTERVAL 360 HOUR)),
  (5, 2, 'DH1780000000685', 'Khach hang mau', '0900000002', '123 Phố Huế, P. Ngô Thì Nhậm, Q. Hai Bà Trưng', NULL, 'Hà Nội', NULL, NULL, NULL, NULL, 'COD', 'DELIVERED', 285000, 20000, 0, 305000, NULL, NULL, DATE_SUB(NOW(), INTERVAL 312 HOUR), DATE_SUB(NOW(), INTERVAL 360 HOUR), DATE_SUB(NOW(), INTERVAL 432 HOUR), DATE_SUB(NOW(), INTERVAL 312 HOUR)),
  (6, 5, 'DH1780000000822', 'Nguyen Thi Lan', '0911111111', '45 Nguyễn Trãi, P. Bến Thành, Q.1', NULL, 'Hồ Chí Minh', NULL, NULL, NULL, NULL, 'VNPAY', 'DELIVERED', 220000, 20000, 0, 240000, NULL, NULL, DATE_SUB(NOW(), INTERVAL 264 HOUR), DATE_SUB(NOW(), INTERVAL 312 HOUR), DATE_SUB(NOW(), INTERVAL 384 HOUR), DATE_SUB(NOW(), INTERVAL 264 HOUR)),
  (7, 6, 'DH1780000000959', 'Tran Van Minh', '0922222222', '78 Trần Phú, P. Hải Châu 1, Q. Hải Châu', NULL, 'Đà Nẵng', NULL, NULL, NULL, NULL, 'BANK_TRANSFER', 'DELIVERED', 205000, 20000, 30000, 195000, NULL, NULL, DATE_SUB(NOW(), INTERVAL 216 HOUR), DATE_SUB(NOW(), INTERVAL 264 HOUR), DATE_SUB(NOW(), INTERVAL 336 HOUR), DATE_SUB(NOW(), INTERVAL 216 HOUR)),
  (8, 2, 'DH1780000001096', 'Khach hang mau', '0900000002', '123 Phố Huế, P. Ngô Thì Nhậm, Q. Hai Bà Trưng', NULL, 'Hà Nội', NULL, NULL, NULL, NULL, 'COD', 'DELIVERED', 160000, 20000, 0, 180000, NULL, NULL, DATE_SUB(NOW(), INTERVAL 168 HOUR), DATE_SUB(NOW(), INTERVAL 216 HOUR), DATE_SUB(NOW(), INTERVAL 288 HOUR), DATE_SUB(NOW(), INTERVAL 168 HOUR)),
  (9, 5, 'DH1780000001233', 'Nguyen Thi Lan', '0911111111', '45 Nguyễn Trãi, P. Bến Thành, Q.1', NULL, 'Hồ Chí Minh', NULL, NULL, NULL, NULL, 'MOMO', 'DELIVERED', 195000, 20000, 19500, 195500, NULL, NULL, DATE_SUB(NOW(), INTERVAL 120 HOUR), DATE_SUB(NOW(), INTERVAL 168 HOUR), DATE_SUB(NOW(), INTERVAL 240 HOUR), DATE_SUB(NOW(), INTERVAL 120 HOUR)),
  (10, 6, 'DH1780000001370', 'Tran Van Minh', '0922222222', '78 Trần Phú, P. Hải Châu 1, Q. Hải Châu', NULL, 'Đà Nẵng', NULL, NULL, NULL, NULL, 'COD', 'DELIVERED', 150000, 20000, 0, 170000, NULL, NULL, DATE_SUB(NOW(), INTERVAL 48 HOUR), DATE_SUB(NOW(), INTERVAL 96 HOUR), DATE_SUB(NOW(), INTERVAL 168 HOUR), DATE_SUB(NOW(), INTERVAL 48 HOUR)),
  (11, 2, 'DH1780000001507', 'Khach hang mau', '0900000002', '123 Phố Huế, P. Ngô Thì Nhậm, Q. Hai Bà Trưng', NULL, 'Hà Nội', NULL, NULL, NULL, NULL, 'VNPAY', 'DELIVERED', 300000, 20000, 0, 320000, NULL, NULL, DATE_SUB(NOW(), INTERVAL 24 HOUR), DATE_SUB(NOW(), INTERVAL 72 HOUR), DATE_SUB(NOW(), INTERVAL 120 HOUR), DATE_SUB(NOW(), INTERVAL 24 HOUR)),
  (12, 5, 'DH1780000001644', 'Nguyen Thi Lan', '0911111111', '45 Nguyễn Trãi, P. Bến Thành, Q.1', NULL, 'Hồ Chí Minh', NULL, NULL, NULL, NULL, 'COD', 'DELIVERED', 445000, 20000, 0, 465000, NULL, NULL, DATE_SUB(NOW(), INTERVAL 24 HOUR), DATE_SUB(NOW(), INTERVAL 48 HOUR), DATE_SUB(NOW(), INTERVAL 96 HOUR), DATE_SUB(NOW(), INTERVAL 24 HOUR)),
  (13, 6, 'DH1780000001781', 'Tran Van Minh', '0922222222', '78 Trần Phú, P. Hải Châu 1, Q. Hải Châu', NULL, 'Đà Nẵng', NULL, NULL, NULL, NULL, 'COD', 'SHIPPED', 215000, 20000, 0, 235000, NULL, NULL, NULL, DATE_SUB(NOW(), INTERVAL 6 HOUR), DATE_SUB(NOW(), INTERVAL 48 HOUR), DATE_SUB(NOW(), INTERVAL 6 HOUR)),
  (14, 2, 'DH1780000001918', 'Khach hang mau', '0900000002', '123 Phố Huế, P. Ngô Thì Nhậm, Q. Hai Bà Trưng', NULL, 'Hà Nội', NULL, NULL, NULL, NULL, 'VNPAY', 'SHIPPED', 130000, 20000, 50000, 100000, NULL, NULL, NULL, DATE_SUB(NOW(), INTERVAL 3 HOUR), DATE_SUB(NOW(), INTERVAL 48 HOUR), DATE_SUB(NOW(), INTERVAL 3 HOUR)),
  (15, 5, 'DH1780000002055', 'Nguyen Thi Lan', '0911111111', '45 Nguyễn Trãi, P. Bến Thành, Q.1', NULL, 'Hồ Chí Minh', NULL, NULL, NULL, NULL, 'COD', 'PACKED', 170000, 20000, 0, 190000, NULL, NULL, NULL, NULL, DATE_SUB(NOW(), INTERVAL 24 HOUR), DATE_SUB(NOW(), INTERVAL 8 HOUR)),
  (16, 6, 'DH1780000002192', 'Tran Van Minh', '0922222222', '78 Trần Phú, P. Hải Châu 1, Q. Hải Châu', NULL, 'Đà Nẵng', NULL, NULL, NULL, NULL, 'MOMO', 'PACKED', 165000, 20000, 0, 185000, NULL, NULL, NULL, NULL, DATE_SUB(NOW(), INTERVAL 24 HOUR), DATE_SUB(NOW(), INTERVAL 6 HOUR)),
  (17, 2, 'DH1780000002329', 'Khach hang mau', '0900000002', '123 Phố Huế, P. Ngô Thì Nhậm, Q. Hai Bà Trưng', NULL, 'Hà Nội', NULL, NULL, NULL, NULL, 'COD', 'CONFIRMED', 270000, 20000, 0, 290000, NULL, NULL, NULL, NULL, DATE_SUB(NOW(), INTERVAL 14 HOUR), DATE_SUB(NOW(), INTERVAL 4 HOUR)),
  (18, 5, 'DH1780000002466', 'Nguyen Thi Lan', '0911111111', '45 Nguyễn Trãi, P. Bến Thành, Q.1', NULL, 'Hồ Chí Minh', NULL, NULL, NULL, NULL, 'COD', 'PENDING', 45000, 20000, 0, 65000, NULL, NULL, NULL, NULL, DATE_SUB(NOW(), INTERVAL 3 HOUR), DATE_SUB(NOW(), INTERVAL 3 HOUR)),
  (19, 6, 'DH1780000002603', 'Tran Van Minh', '0922222222', '78 Trần Phú, P. Hải Châu 1, Q. Hải Châu', NULL, 'Đà Nẵng', NULL, NULL, NULL, NULL, 'VNPAY', 'PENDING', 190000, 20000, 0, 210000, NULL, NULL, NULL, NULL, DATE_SUB(NOW(), INTERVAL 1 HOUR), DATE_SUB(NOW(), INTERVAL 1 HOUR)),
  (20, 2, 'DH1780000002740', 'Khach hang mau', '0900000002', '123 Phố Huế, P. Ngô Thì Nhậm, Q. Hai Bà Trưng', NULL, 'Hà Nội', NULL, NULL, NULL, NULL, 'BANK_TRANSFER', 'AWAITING_PAYMENT_CONFIRMATION', 220000, 20000, 0, 240000, NULL, NULL, NULL, NULL, DATE_SUB(NOW(), INTERVAL 5 HOUR), DATE_SUB(NOW(), INTERVAL 2 HOUR)),
  (21, 5, 'DH1780000002877', 'Nguyen Thi Lan', '0911111111', '45 Nguyễn Trãi, P. Bến Thành, Q.1', NULL, 'Hồ Chí Minh', NULL, NULL, NULL, NULL, 'COD', 'CANCELLED', 350000, 20000, 0, 370000, NULL, DATE_SUB(NOW(), INTERVAL 190 HOUR), NULL, NULL, DATE_SUB(NOW(), INTERVAL 192 HOUR), DATE_SUB(NOW(), INTERVAL 190 HOUR)),
  (22, 6, 'DH1780000003014', 'Tran Van Minh', '0922222222', '78 Trần Phú, P. Hải Châu 1, Q. Hải Châu', NULL, 'Đà Nẵng', NULL, NULL, NULL, NULL, 'VNPAY', 'CANCELLED', 185000, 20000, 0, 205000, NULL, DATE_SUB(NOW(), INTERVAL 356 HOUR), NULL, NULL, DATE_SUB(NOW(), INTERVAL 360 HOUR), DATE_SUB(NOW(), INTERVAL 356 HOUR))
ON DUPLICATE KEY UPDATE `status` = VALUES(`status`);

INSERT INTO `order_items` (`id`, `order_id`, `product_id`, `product_name_snapshot`, `quantity`, `unit_price`, `line_total`) VALUES
  (1, 1, 1, 'Măng khô Tây Bắc', 2, 120000, 240000),
  (2, 1, 2, 'Nước mắm Phú Quốc', 1, 95000, 95000),
  (3, 2, 5, 'Chè Thái Nguyên đặc biệt', 1, 180000, 180000),
  (4, 2, 6, 'Cà phê Buôn Ma Thuột', 1, 150000, 150000),
  (5, 3, 4, 'Thịt trâu gác bếp Sơn La', 1, 350000, 350000),
  (6, 4, 9, 'Hạt điều rang muối Bình Phước', 2, 130000, 260000),
  (7, 4, 10, 'Đậu phộng da cá Tây Ninh', 1, 55000, 55000),
  (8, 5, 2, 'Nước mắm Phú Quốc', 3, 95000, 285000),
  (9, 6, 15, 'Rượu cần Tây Nguyên', 1, 220000, 220000),
  (10, 7, 1, 'Măng khô Tây Bắc', 1, 120000, 120000),
  (11, 7, 3, 'Mộc nhĩ Tây Bắc', 1, 85000, 85000),
  (12, 8, 8, 'Kẹo dừa Bến Tre', 2, 45000, 90000),
  (13, 8, 14, 'Nem chua Thanh Hóa', 1, 70000, 70000),
  (14, 9, 16, 'Trà Ô Long Bảo Lộc', 1, 195000, 195000),
  (15, 10, 7, 'Bánh đậu xanh Hải Dương', 1, 60000, 60000),
  (16, 10, 11, 'Tương ớt Mường Khương', 1, 40000, 40000),
  (17, 10, 12, 'Mắm tôm Thanh Hóa', 1, 50000, 50000),
  (18, 11, 6, 'Cà phê Buôn Ma Thuột', 2, 150000, 300000),
  (19, 12, 4, 'Thịt trâu gác bếp Sơn La', 1, 350000, 350000),
  (20, 12, 2, 'Nước mắm Phú Quốc', 1, 95000, 95000),
  (21, 13, 13, 'Bánh tráng phơi sương Trảng Bàng', 1, 35000, 35000),
  (22, 13, 5, 'Chè Thái Nguyên đặc biệt', 1, 180000, 180000),
  (23, 14, 9, 'Hạt điều rang muối Bình Phước', 1, 130000, 130000),
  (24, 15, 3, 'Mộc nhĩ Tây Bắc', 2, 85000, 170000),
  (25, 16, 10, 'Đậu phộng da cá Tây Ninh', 3, 55000, 165000),
  (26, 17, 1, 'Măng khô Tây Bắc', 1, 120000, 120000),
  (27, 17, 6, 'Cà phê Buôn Ma Thuột', 1, 150000, 150000),
  (28, 18, 8, 'Kẹo dừa Bến Tre', 1, 45000, 45000),
  (29, 19, 2, 'Nước mắm Phú Quốc', 2, 95000, 190000),
  (30, 20, 15, 'Rượu cần Tây Nguyên', 1, 220000, 220000),
  (31, 21, 4, 'Thịt trâu gác bếp Sơn La', 1, 350000, 350000),
  (32, 22, 9, 'Hạt điều rang muối Bình Phước', 1, 130000, 130000),
  (33, 22, 10, 'Đậu phộng da cá Tây Ninh', 1, 55000, 55000)
ON DUPLICATE KEY UPDATE `quantity` = VALUES(`quantity`);

INSERT INTO `order_status_history` (`id`, `order_id`, `from_status`, `to_status`, `note`, `changed_by_user_id`, `created_at`) VALUES
  (1, 1, NULL, 'PENDING', 'Khách hàng đặt hàng', 2, DATE_SUB(NOW(), INTERVAL 672 HOUR)),
  (2, 1, 'PENDING', 'CONFIRMED', 'Admin xác nhận đơn', 1, DATE_SUB(NOW(), INTERVAL 660 HOUR)),
  (3, 1, 'CONFIRMED', 'PACKED', 'Kho đóng gói xong', 4, DATE_SUB(NOW(), INTERVAL 648 HOUR)),
  (4, 1, 'PACKED', 'SHIPPED', 'Đã bàn giao vận chuyển', 4, DATE_SUB(NOW(), INTERVAL 600 HOUR)),
  (5, 1, 'SHIPPED', 'DELIVERED', 'Khách xác nhận đã nhận hàng', 2, DATE_SUB(NOW(), INTERVAL 528 HOUR)),
  (6, 2, NULL, 'PENDING', 'Khách hàng đặt hàng', 5, DATE_SUB(NOW(), INTERVAL 600 HOUR)),
  (7, 2, 'PENDING', 'CONFIRMED', 'Admin xác nhận đơn', 1, DATE_SUB(NOW(), INTERVAL 588 HOUR)),
  (8, 2, 'CONFIRMED', 'PACKED', 'Kho đóng gói xong', 4, DATE_SUB(NOW(), INTERVAL 576 HOUR)),
  (9, 2, 'PACKED', 'SHIPPED', 'Đã bàn giao vận chuyển', 4, DATE_SUB(NOW(), INTERVAL 552 HOUR)),
  (10, 2, 'SHIPPED', 'DELIVERED', 'Khách xác nhận đã nhận hàng', 2, DATE_SUB(NOW(), INTERVAL 480 HOUR)),
  (11, 3, NULL, 'PENDING', 'Khách hàng đặt hàng', 2, DATE_SUB(NOW(), INTERVAL 552 HOUR)),
  (12, 3, 'PENDING', 'CONFIRMED', 'Admin xác nhận đơn', 1, DATE_SUB(NOW(), INTERVAL 540 HOUR)),
  (13, 3, 'CONFIRMED', 'PACKED', 'Kho đóng gói xong', 4, DATE_SUB(NOW(), INTERVAL 528 HOUR)),
  (14, 3, 'PACKED', 'SHIPPED', 'Đã bàn giao vận chuyển', 4, DATE_SUB(NOW(), INTERVAL 480 HOUR)),
  (15, 3, 'SHIPPED', 'DELIVERED', 'Khách xác nhận đã nhận hàng', 2, DATE_SUB(NOW(), INTERVAL 432 HOUR)),
  (16, 4, NULL, 'PENDING', 'Khách hàng đặt hàng', 6, DATE_SUB(NOW(), INTERVAL 480 HOUR)),
  (17, 4, 'PENDING', 'CONFIRMED', 'Admin xác nhận đơn', 1, DATE_SUB(NOW(), INTERVAL 468 HOUR)),
  (18, 4, 'CONFIRMED', 'PACKED', 'Kho đóng gói xong', 4, DATE_SUB(NOW(), INTERVAL 456 HOUR)),
  (19, 4, 'PACKED', 'SHIPPED', 'Đã bàn giao vận chuyển', 4, DATE_SUB(NOW(), INTERVAL 408 HOUR)),
  (20, 4, 'SHIPPED', 'DELIVERED', 'Khách xác nhận đã nhận hàng', 2, DATE_SUB(NOW(), INTERVAL 360 HOUR)),
  (21, 5, NULL, 'PENDING', 'Khách hàng đặt hàng', 2, DATE_SUB(NOW(), INTERVAL 432 HOUR)),
  (22, 5, 'PENDING', 'CONFIRMED', 'Admin xác nhận đơn', 1, DATE_SUB(NOW(), INTERVAL 420 HOUR)),
  (23, 5, 'CONFIRMED', 'PACKED', 'Kho đóng gói xong', 4, DATE_SUB(NOW(), INTERVAL 408 HOUR)),
  (24, 5, 'PACKED', 'SHIPPED', 'Đã bàn giao vận chuyển', 4, DATE_SUB(NOW(), INTERVAL 360 HOUR)),
  (25, 5, 'SHIPPED', 'DELIVERED', 'Khách xác nhận đã nhận hàng', 2, DATE_SUB(NOW(), INTERVAL 312 HOUR)),
  (26, 6, NULL, 'PENDING', 'Khách hàng đặt hàng', 5, DATE_SUB(NOW(), INTERVAL 384 HOUR)),
  (27, 6, 'PENDING', 'CONFIRMED', 'Admin xác nhận đơn', 1, DATE_SUB(NOW(), INTERVAL 372 HOUR)),
  (28, 6, 'CONFIRMED', 'PACKED', 'Kho đóng gói xong', 4, DATE_SUB(NOW(), INTERVAL 360 HOUR)),
  (29, 6, 'PACKED', 'SHIPPED', 'Đã bàn giao vận chuyển', 4, DATE_SUB(NOW(), INTERVAL 312 HOUR)),
  (30, 6, 'SHIPPED', 'DELIVERED', 'Khách xác nhận đã nhận hàng', 2, DATE_SUB(NOW(), INTERVAL 264 HOUR)),
  (31, 7, NULL, 'PENDING', 'Khách hàng đặt hàng', 6, DATE_SUB(NOW(), INTERVAL 336 HOUR)),
  (32, 7, 'PENDING', 'CONFIRMED', 'Admin xác nhận đơn', 1, DATE_SUB(NOW(), INTERVAL 324 HOUR)),
  (33, 7, 'CONFIRMED', 'PACKED', 'Kho đóng gói xong', 4, DATE_SUB(NOW(), INTERVAL 312 HOUR)),
  (34, 7, 'PACKED', 'SHIPPED', 'Đã bàn giao vận chuyển', 4, DATE_SUB(NOW(), INTERVAL 264 HOUR)),
  (35, 7, 'SHIPPED', 'DELIVERED', 'Khách xác nhận đã nhận hàng', 2, DATE_SUB(NOW(), INTERVAL 216 HOUR)),
  (36, 8, NULL, 'PENDING', 'Khách hàng đặt hàng', 2, DATE_SUB(NOW(), INTERVAL 288 HOUR)),
  (37, 8, 'PENDING', 'CONFIRMED', 'Admin xác nhận đơn', 1, DATE_SUB(NOW(), INTERVAL 276 HOUR)),
  (38, 8, 'CONFIRMED', 'PACKED', 'Kho đóng gói xong', 4, DATE_SUB(NOW(), INTERVAL 264 HOUR)),
  (39, 8, 'PACKED', 'SHIPPED', 'Đã bàn giao vận chuyển', 4, DATE_SUB(NOW(), INTERVAL 216 HOUR)),
  (40, 8, 'SHIPPED', 'DELIVERED', 'Khách xác nhận đã nhận hàng', 2, DATE_SUB(NOW(), INTERVAL 168 HOUR)),
  (41, 9, NULL, 'PENDING', 'Khách hàng đặt hàng', 5, DATE_SUB(NOW(), INTERVAL 240 HOUR)),
  (42, 9, 'PENDING', 'CONFIRMED', 'Admin xác nhận đơn', 1, DATE_SUB(NOW(), INTERVAL 228 HOUR)),
  (43, 9, 'CONFIRMED', 'PACKED', 'Kho đóng gói xong', 4, DATE_SUB(NOW(), INTERVAL 216 HOUR)),
  (44, 9, 'PACKED', 'SHIPPED', 'Đã bàn giao vận chuyển', 4, DATE_SUB(NOW(), INTERVAL 168 HOUR)),
  (45, 9, 'SHIPPED', 'DELIVERED', 'Khách xác nhận đã nhận hàng', 2, DATE_SUB(NOW(), INTERVAL 120 HOUR)),
  (46, 10, NULL, 'PENDING', 'Khách hàng đặt hàng', 6, DATE_SUB(NOW(), INTERVAL 168 HOUR)),
  (47, 10, 'PENDING', 'CONFIRMED', 'Admin xác nhận đơn', 1, DATE_SUB(NOW(), INTERVAL 156 HOUR)),
  (48, 10, 'CONFIRMED', 'PACKED', 'Kho đóng gói xong', 4, DATE_SUB(NOW(), INTERVAL 144 HOUR)),
  (49, 10, 'PACKED', 'SHIPPED', 'Đã bàn giao vận chuyển', 4, DATE_SUB(NOW(), INTERVAL 96 HOUR)),
  (50, 10, 'SHIPPED', 'DELIVERED', 'Khách xác nhận đã nhận hàng', 2, DATE_SUB(NOW(), INTERVAL 48 HOUR)),
  (51, 11, NULL, 'PENDING', 'Khách hàng đặt hàng', 2, DATE_SUB(NOW(), INTERVAL 120 HOUR)),
  (52, 11, 'PENDING', 'CONFIRMED', 'Admin xác nhận đơn', 1, DATE_SUB(NOW(), INTERVAL 108 HOUR)),
  (53, 11, 'CONFIRMED', 'PACKED', 'Kho đóng gói xong', 4, DATE_SUB(NOW(), INTERVAL 96 HOUR)),
  (54, 11, 'PACKED', 'SHIPPED', 'Đã bàn giao vận chuyển', 4, DATE_SUB(NOW(), INTERVAL 72 HOUR)),
  (55, 11, 'SHIPPED', 'DELIVERED', 'Khách xác nhận đã nhận hàng', 2, DATE_SUB(NOW(), INTERVAL 24 HOUR)),
  (56, 12, NULL, 'PENDING', 'Khách hàng đặt hàng', 5, DATE_SUB(NOW(), INTERVAL 96 HOUR)),
  (57, 12, 'PENDING', 'CONFIRMED', 'Admin xác nhận đơn', 1, DATE_SUB(NOW(), INTERVAL 84 HOUR)),
  (58, 12, 'CONFIRMED', 'PACKED', 'Kho đóng gói xong', 4, DATE_SUB(NOW(), INTERVAL 72 HOUR)),
  (59, 12, 'PACKED', 'SHIPPED', 'Đã bàn giao vận chuyển', 4, DATE_SUB(NOW(), INTERVAL 48 HOUR)),
  (60, 12, 'SHIPPED', 'DELIVERED', 'Khách xác nhận đã nhận hàng', 2, DATE_SUB(NOW(), INTERVAL 24 HOUR)),
  (61, 13, NULL, 'PENDING', 'Khách hàng đặt hàng', 6, DATE_SUB(NOW(), INTERVAL 48 HOUR)),
  (62, 13, 'PENDING', 'CONFIRMED', 'Admin xác nhận đơn', 1, DATE_SUB(NOW(), INTERVAL 36 HOUR)),
  (63, 13, 'CONFIRMED', 'PACKED', 'Kho đóng gói xong', 4, DATE_SUB(NOW(), INTERVAL 30 HOUR)),
  (64, 13, 'PACKED', 'SHIPPED', 'Đã bàn giao vận chuyển', 4, DATE_SUB(NOW(), INTERVAL 6 HOUR)),
  (65, 14, NULL, 'PENDING', 'Khách hàng đặt hàng', 2, DATE_SUB(NOW(), INTERVAL 48 HOUR)),
  (66, 14, 'PENDING', 'CONFIRMED', 'Admin xác nhận đơn', 1, DATE_SUB(NOW(), INTERVAL 36 HOUR)),
  (67, 14, 'CONFIRMED', 'PACKED', 'Kho đóng gói xong', 4, DATE_SUB(NOW(), INTERVAL 28 HOUR)),
  (68, 14, 'PACKED', 'SHIPPED', 'Đã bàn giao vận chuyển', 4, DATE_SUB(NOW(), INTERVAL 3 HOUR)),
  (69, 15, NULL, 'PENDING', 'Khách hàng đặt hàng', 5, DATE_SUB(NOW(), INTERVAL 24 HOUR)),
  (70, 15, 'PENDING', 'CONFIRMED', 'Admin xác nhận đơn', 1, DATE_SUB(NOW(), INTERVAL 20 HOUR)),
  (71, 15, 'CONFIRMED', 'PACKED', 'Kho đóng gói xong', 4, DATE_SUB(NOW(), INTERVAL 8 HOUR)),
  (72, 16, NULL, 'PENDING', 'Khách hàng đặt hàng', 6, DATE_SUB(NOW(), INTERVAL 24 HOUR)),
  (73, 16, 'PENDING', 'CONFIRMED', 'Admin xác nhận đơn', 1, DATE_SUB(NOW(), INTERVAL 18 HOUR)),
  (74, 16, 'CONFIRMED', 'PACKED', 'Kho đóng gói xong', 4, DATE_SUB(NOW(), INTERVAL 6 HOUR)),
  (75, 17, NULL, 'PENDING', 'Khách hàng đặt hàng', 2, DATE_SUB(NOW(), INTERVAL 14 HOUR)),
  (76, 17, 'PENDING', 'CONFIRMED', 'Admin xác nhận đơn', 1, DATE_SUB(NOW(), INTERVAL 4 HOUR)),
  (77, 18, NULL, 'PENDING', 'Khách hàng đặt hàng', 5, DATE_SUB(NOW(), INTERVAL 3 HOUR)),
  (78, 19, NULL, 'PENDING', 'Khách hàng đặt hàng', 6, DATE_SUB(NOW(), INTERVAL 1 HOUR)),
  (79, 20, NULL, 'PENDING', 'Khách hàng đặt hàng', 2, DATE_SUB(NOW(), INTERVAL 5 HOUR)),
  (80, 20, 'PENDING', 'AWAITING_PAYMENT_CONFIRMATION', 'Khách báo đã chuyển khoản', 2, DATE_SUB(NOW(), INTERVAL 2 HOUR)),
  (81, 21, NULL, 'PENDING', 'Khách hàng đặt hàng', 5, DATE_SUB(NOW(), INTERVAL 192 HOUR)),
  (82, 21, 'PENDING', 'CANCELLED', 'Khách hàng hủy đơn', 5, DATE_SUB(NOW(), INTERVAL 190 HOUR)),
  (83, 22, NULL, 'PENDING', 'Khách hàng đặt hàng', 6, DATE_SUB(NOW(), INTERVAL 360 HOUR)),
  (84, 22, 'PENDING', 'CONFIRMED', 'Admin xác nhận đơn', 1, DATE_SUB(NOW(), INTERVAL 358 HOUR)),
  (85, 22, 'CONFIRMED', 'CANCELLED', 'Khách hàng hủy đơn', 6, DATE_SUB(NOW(), INTERVAL 356 HOUR))
ON DUPLICATE KEY UPDATE `to_status` = VALUES(`to_status`);

INSERT INTO `payments` (`id`, `order_id`, `provider`, `payment_method`, `amount`, `payment_status`, `paid_at`, `created_at`) VALUES
  (1, 1, 'COD', 'COD', 355000, 'PENDING', NULL, DATE_SUB(NOW(), INTERVAL 672 HOUR)),
  (2, 2, 'VNPAY', 'VNPAY', 350000, 'SUCCESS', DATE_SUB(NOW(), INTERVAL 588 HOUR), DATE_SUB(NOW(), INTERVAL 600 HOUR)),
  (3, 3, 'COD', 'COD', 335000, 'PENDING', NULL, DATE_SUB(NOW(), INTERVAL 552 HOUR)),
  (4, 4, 'MOMO', 'MOMO', 335000, 'SUCCESS', DATE_SUB(NOW(), INTERVAL 468 HOUR), DATE_SUB(NOW(), INTERVAL 480 HOUR)),
  (5, 5, 'COD', 'COD', 305000, 'PENDING', NULL, DATE_SUB(NOW(), INTERVAL 432 HOUR)),
  (6, 6, 'VNPAY', 'VNPAY', 240000, 'SUCCESS', DATE_SUB(NOW(), INTERVAL 372 HOUR), DATE_SUB(NOW(), INTERVAL 384 HOUR)),
  (7, 7, 'BANK_TRANSFER', 'BANK_TRANSFER', 195000, 'SUCCESS', DATE_SUB(NOW(), INTERVAL 324 HOUR), DATE_SUB(NOW(), INTERVAL 336 HOUR)),
  (8, 8, 'COD', 'COD', 180000, 'PENDING', NULL, DATE_SUB(NOW(), INTERVAL 288 HOUR)),
  (9, 9, 'MOMO', 'MOMO', 195500, 'SUCCESS', DATE_SUB(NOW(), INTERVAL 228 HOUR), DATE_SUB(NOW(), INTERVAL 240 HOUR)),
  (10, 10, 'COD', 'COD', 170000, 'PENDING', NULL, DATE_SUB(NOW(), INTERVAL 168 HOUR)),
  (11, 11, 'VNPAY', 'VNPAY', 320000, 'SUCCESS', DATE_SUB(NOW(), INTERVAL 108 HOUR), DATE_SUB(NOW(), INTERVAL 120 HOUR)),
  (12, 12, 'COD', 'COD', 465000, 'PENDING', NULL, DATE_SUB(NOW(), INTERVAL 96 HOUR)),
  (13, 13, 'COD', 'COD', 235000, 'PENDING', NULL, DATE_SUB(NOW(), INTERVAL 48 HOUR)),
  (14, 14, 'VNPAY', 'VNPAY', 100000, 'SUCCESS', DATE_SUB(NOW(), INTERVAL 36 HOUR), DATE_SUB(NOW(), INTERVAL 48 HOUR)),
  (15, 15, 'COD', 'COD', 190000, 'PENDING', NULL, DATE_SUB(NOW(), INTERVAL 24 HOUR)),
  (16, 16, 'MOMO', 'MOMO', 185000, 'SUCCESS', DATE_SUB(NOW(), INTERVAL 18 HOUR), DATE_SUB(NOW(), INTERVAL 24 HOUR)),
  (17, 17, 'COD', 'COD', 290000, 'PENDING', NULL, DATE_SUB(NOW(), INTERVAL 14 HOUR)),
  (18, 18, 'COD', 'COD', 65000, 'PENDING', NULL, DATE_SUB(NOW(), INTERVAL 3 HOUR)),
  (19, 19, 'VNPAY', 'VNPAY', 210000, 'PENDING', NULL, DATE_SUB(NOW(), INTERVAL 1 HOUR)),
  (20, 20, 'BANK_TRANSFER', 'BANK_TRANSFER', 240000, 'PENDING', NULL, DATE_SUB(NOW(), INTERVAL 5 HOUR)),
  (21, 21, 'COD', 'COD', 370000, 'PENDING', NULL, DATE_SUB(NOW(), INTERVAL 192 HOUR)),
  (22, 22, 'VNPAY', 'VNPAY', 205000, 'FAILED', NULL, DATE_SUB(NOW(), INTERVAL 360 HOUR))
ON DUPLICATE KEY UPDATE `payment_status` = VALUES(`payment_status`);

INSERT INTO `payment_status_history` (`id`, `order_id`, `from_status`, `to_status`, `note`, `changed_by_user_id`, `created_at`) VALUES
  (1, 2, 'PENDING', 'SUCCESS', 'Cổng thanh toán xác nhận', NULL, DATE_SUB(NOW(), INTERVAL 588 HOUR)),
  (2, 4, 'PENDING', 'SUCCESS', 'Cổng thanh toán xác nhận', NULL, DATE_SUB(NOW(), INTERVAL 468 HOUR)),
  (3, 6, 'PENDING', 'SUCCESS', 'Cổng thanh toán xác nhận', NULL, DATE_SUB(NOW(), INTERVAL 372 HOUR)),
  (4, 7, 'PENDING', 'SUCCESS', 'Admin xác nhận đã nhận chuyển khoản', NULL, DATE_SUB(NOW(), INTERVAL 324 HOUR)),
  (5, 9, 'PENDING', 'SUCCESS', 'Cổng thanh toán xác nhận', NULL, DATE_SUB(NOW(), INTERVAL 228 HOUR)),
  (6, 11, 'PENDING', 'SUCCESS', 'Cổng thanh toán xác nhận', NULL, DATE_SUB(NOW(), INTERVAL 108 HOUR)),
  (7, 14, 'PENDING', 'SUCCESS', 'Cổng thanh toán xác nhận', NULL, DATE_SUB(NOW(), INTERVAL 36 HOUR)),
  (8, 16, 'PENDING', 'SUCCESS', 'Cổng thanh toán xác nhận', NULL, DATE_SUB(NOW(), INTERVAL 18 HOUR)),
  (9, 22, 'PENDING', 'FAILED', 'Cổng thanh toán xác nhận', NULL, DATE_SUB(NOW(), INTERVAL 356 HOUR))
ON DUPLICATE KEY UPDATE `to_status` = VALUES(`to_status`);

INSERT INTO `order_shipments` (`id`, `order_id`, `shipping_carrier_id`, `provider`, `status`, `tracking_code`, `shipping_fee`, `cod_amount`, `synced_at`) VALUES
  (1, 1, 1, 'GHN', 'delivered', 'GHN1780000001', 20000, 0, DATE_SUB(NOW(), INTERVAL 600 HOUR)),
  (2, 2, 1, 'GHN', 'delivered', 'GHN1780000002', 20000, 0, DATE_SUB(NOW(), INTERVAL 552 HOUR)),
  (3, 3, 2, 'MANUAL', 'delivered', 'NOI1780000003', 20000, 0, DATE_SUB(NOW(), INTERVAL 480 HOUR)),
  (4, 4, 1, 'GHN', 'delivered', 'GHN1780000004', 20000, 0, DATE_SUB(NOW(), INTERVAL 408 HOUR)),
  (5, 5, 1, 'GHN', 'delivered', 'GHN1780000005', 20000, 0, DATE_SUB(NOW(), INTERVAL 360 HOUR)),
  (6, 6, 2, 'MANUAL', 'delivered', 'NOI1780000006', 20000, 0, DATE_SUB(NOW(), INTERVAL 312 HOUR)),
  (7, 7, 1, 'GHN', 'delivered', 'GHN1780000007', 20000, 0, DATE_SUB(NOW(), INTERVAL 264 HOUR)),
  (8, 8, 1, 'GHN', 'delivered', 'GHN1780000008', 20000, 0, DATE_SUB(NOW(), INTERVAL 216 HOUR)),
  (9, 9, 2, 'MANUAL', 'delivered', 'NOI1780000009', 20000, 0, DATE_SUB(NOW(), INTERVAL 168 HOUR)),
  (10, 10, 1, 'GHN', 'delivered', 'GHN1780000010', 20000, 0, DATE_SUB(NOW(), INTERVAL 96 HOUR)),
  (11, 11, 1, 'GHN', 'delivered', 'GHN1780000011', 20000, 0, DATE_SUB(NOW(), INTERVAL 72 HOUR)),
  (12, 12, 2, 'MANUAL', 'delivered', 'NOI1780000012', 20000, 0, DATE_SUB(NOW(), INTERVAL 48 HOUR)),
  (13, 13, 1, 'GHN', 'delivering', 'GHN1780000013', 20000, 0, DATE_SUB(NOW(), INTERVAL 6 HOUR)),
  (14, 14, 1, 'GHN', 'delivering', 'GHN1780000014', 20000, 0, DATE_SUB(NOW(), INTERVAL 3 HOUR))
ON DUPLICATE KEY UPDATE `status` = VALUES(`status`);

INSERT INTO `order_vouchers` (`id`, `order_id`, `voucher_id`, `discount_amount`) VALUES
  (1, 3, 1, 35000),
  (2, 7, 2, 30000),
  (3, 9, 1, 19500),
  (4, 14, 3, 50000)
ON DUPLICATE KEY UPDATE `discount_amount` = VALUES(`discount_amount`);

INSERT INTO `product_reviews` (`id`, `product_id`, `user_id`, `order_id`, `rating`, `comment`, `status`) VALUES
  (1, 1, 2, 1, 5, 'Măng khô rất ngon, đúng vị núi rừng, sẽ ủng hộ tiếp.', 'VISIBLE'),
  (2, 2, 2, 1, 4, 'Nước mắm đậm đà, đóng gói cẩn thận, giao nhanh.', 'VISIBLE'),
  (3, 5, 5, 2, 5, 'Chè Thái Nguyên chuẩn vị, nước xanh vàng đẹp mắt.', 'VISIBLE'),
  (4, 4, 2, 3, 5, 'Thịt trâu gác bếp thơm ngon, cay vừa phải, đúng vị Tây Bắc.', 'VISIBLE'),
  (5, 9, 6, 4, 4, 'Hạt điều giòn, rang vừa muối, không bị dầu.', 'VISIBLE'),
  (6, 15, 5, 6, 3, 'Rượu cần ổn nhưng giao hơi lâu so với dự kiến.', 'HIDDEN'),
  (7, 14, 2, 8, 5, 'Nem chua ngon, đóng gói kỹ, không bị vỡ khi vận chuyển.', 'VISIBLE'),
  (8, 7, 6, 10, 4, 'Bánh đậu xanh ngọt vừa, hộp đẹp, hợp làm quà biếu.', 'VISIBLE'),
  (9, 6, 2, 11, 5, 'Cà phê thơm đậm, đúng gu Robusta, sẽ mua lại.', 'VISIBLE'),
  (10, 2, 5, 12, 4, 'Nước mắm ngon nhưng giá hơi cao so với mặt bằng chung.', 'VISIBLE')
ON DUPLICATE KEY UPDATE `rating` = VALUES(`rating`);

UPDATE `product_reviews` SET `moderated_by_user_id` = 1, `moderated_at` = DATE_SUB(NOW(), INTERVAL 2 DAY) WHERE `id` = 6;

INSERT INTO `complaints` (`id`, `order_id`, `user_id`, `product_id`, `reason`, `content`, `status`, `resolution_note`, `resolved_by_user_id`, `resolved_at`, `created_at`) VALUES
  (1, 3, 2, 4, 'Sản phẩm bị móp hộp khi nhận', 'Hộp thịt trâu gác bếp bị móp một góc khi giao tới, tuy sản phẩm bên trong vẫn dùng được nhưng không đẹp để biếu tặng.', 'REFUNDED', 'Đã hoàn tiền cho khách theo chính sách đổi trả bao bì hư hỏng.', 1, DATE_SUB(NOW(), INTERVAL 16 DAY), DATE_SUB(NOW(), INTERVAL 17 DAY)),
  (2, 8, 2, 14, 'Giao thiếu sản phẩm', 'Đơn hàng có đặt 1 gói nem chua nhưng khi nhận chỉ thấy 2 gói kẹo dừa, thiếu mất phần nem chua.', 'OPEN', NULL, NULL, NULL, DATE_SUB(NOW(), INTERVAL 6 DAY))
ON DUPLICATE KEY UPDATE `status` = VALUES(`status`);

INSERT INTO `support_tickets` (`id`, `user_id`, `subject`, `message`, `channel`, `status`, `resolved_by_user_id`, `resolved_at`, `created_at`) VALUES
  (1, 4, 'Thiếu nhân sự đóng gói dịp cao điểm', 'Tuần này lượng đơn PACKED tồn nhiều, đề xuất bổ sung thêm 1 nhân viên đóng gói ca chiều.', 'warehouse', 'RESOLVED', 1, DATE_SUB(NOW(), INTERVAL 3 DAY), DATE_SUB(NOW(), INTERVAL 5 DAY)),
  (2, 7, 'Chưa nhận được thanh toán đơn hàng tháng trước', 'Nhờ Admin kiểm tra lại đối soát doanh thu tháng trước, chưa thấy đối chiếu thanh toán cho HTX.', 'supplier', 'OPEN', NULL, NULL, DATE_SUB(NOW(), INTERVAL 1 DAY))
ON DUPLICATE KEY UPDATE `status` = VALUES(`status`);

INSERT INTO `notifications` (`id`, `user_id`, `type`, `title`, `message`, `link_url`, `read_at`, `created_at`) VALUES
  (1, 2, 'ORDER_CONFIRMED', 'Đơn hàng đã được xác nhận', 'Đơn DH... đã được xác nhận và đang được đóng gói.', '/account/orders/17', DATE_SUB(NOW(), INTERVAL 13 HOUR), DATE_SUB(NOW(), INTERVAL 14 HOUR)),
  (2, 2, 'ORDER_SHIPPED', 'Đơn hàng đang được giao', 'Đơn hàng của bạn đã được bàn giao cho đơn vị vận chuyển.', '/account/orders/11', DATE_SUB(NOW(), INTERVAL 60 HOUR), DATE_SUB(NOW(), INTERVAL 72 HOUR)),
  (3, 2, 'ORDER_DELIVERED', 'Đơn hàng đã được giao thành công', 'Cảm ơn bạn đã mua sắm! Đừng quên đánh giá sản phẩm nhé.', '/account/orders/11', NULL, DATE_SUB(NOW(), INTERVAL 24 HOUR)),
  (4, 2, 'COMPLAINT_RESOLVED', 'Khiếu nại đã được xử lý', 'Khiếu nại của bạn về đơn DH... đã được hoàn tiền.', '/account/disputes', NULL, DATE_SUB(NOW(), INTERVAL 16 DAY)),
  (5, 1, 'SUPPLIER_APPLICATION', 'Có ticket hỗ trợ mới từ Nhà cung cấp', 'HTX Trà & Cà phê Tây Nguyên vừa gửi 1 yêu cầu hỗ trợ mới.', '/admin/suppliers', NULL, DATE_SUB(NOW(), INTERVAL 1 DAY))
ON DUPLICATE KEY UPDATE `title` = VALUES(`title`);

INSERT INTO `newsletter_subscriptions` (`id`, `email`, `source`) VALUES
  (1, 'yeu.dacsan@example.com', 'footer'),
  (2, 'quan.tam@example.com', 'footer'),
  (3, 'khach.moi@example.com', 'checkout')
ON DUPLICATE KEY UPDATE `source` = VALUES(`source`);

INSERT INTO `admin_settings` (`id`, `user_id`, `store_name`, `support_email`, `support_phone`, `low_stock_threshold`) VALUES
  (1, 1, 'Heritage Harvest - Đặc sản vùng miền', 'support@example.com', '19000000', 10)
ON DUPLICATE KEY UPDATE `store_name` = VALUES(`store_name`);

INSERT INTO `delivery_requests` (`id`, `requested_by_user_id`, `product_id`, `requested_qty`, `approved_qty`, `eta_days`, `reason`, `status`, `approved_by_user_id`, `created_at`) VALUES
  (1, 4, 7, 50, 50, 3, 'Bánh đậu xanh sắp hết hàng, cần nhập bổ sung gấp.', 'received', 1, DATE_SUB(NOW(), INTERVAL 4 DAY)),
  (2, 4, 13, 40, 40, 5, 'Bánh tráng phơi sương tồn kho thấp hơn ngưỡng cảnh báo.', 'approved', 1, DATE_SUB(NOW(), INTERVAL 1 DAY)),
  (3, 4, 4, 20, NULL, 7, 'Thịt trâu gác bếp bán chạy dịp lễ, đề xuất nhập thêm.', 'submitted', NULL, DATE_SUB(NOW(), INTERVAL 2 HOUR))
ON DUPLICATE KEY UPDATE `status` = VALUES(`status`);

INSERT INTO `wishlist_items` (`id`, `user_id`, `product_id`) VALUES
  (1, 2, 15), (2, 2, 9), (3, 5, 6)
ON DUPLICATE KEY UPDATE `user_id` = VALUES(`user_id`);

INSERT INTO `user_addresses` (`id`, `user_id`, `label`, `recipient`, `phone`, `line1`, `city`, `is_default`) VALUES
  (1, 2, 'Nhà riêng', 'Khach hang mau', '0900000002', '123 Phố Huế, P. Ngô Thì Nhậm, Q. Hai Bà Trưng', 'Hà Nội', 1),
  (2, 2, 'Văn phòng', 'Khach hang mau', '0900000002', '45 Láng Hạ, P. Láng Hạ, Q. Đống Đa', 'Hà Nội', 0),
  (3, 5, 'Nhà riêng', 'Nguyen Thi Lan', '0911111111', '45 Nguyễn Trãi, P. Bến Thành, Q.1', 'Hồ Chí Minh', 1)
ON DUPLICATE KEY UPDATE `recipient` = VALUES(`recipient`);

INSERT INTO `posts` (`id`, `created_by_user_id`, `title`, `excerpt`, `body`, `status`, `published_at`) VALUES
  (3, 1, 'Cà phê Buôn Ma Thuột — hương vị đại ngàn Tây Nguyên', 'Từ những nương rẫy đỏ bazan đến ly cà phê phin đậm đà.', 'Cà phê Buôn Ma Thuột được trồng trên đất đỏ bazan Tây Nguyên, thu hái và rang xay theo phương pháp truyền thống, giữ trọn hương thơm đặc trưng.', 'PUBLISHED', DATE_SUB(NOW(), INTERVAL 6 DAY))
ON DUPLICATE KEY UPDATE `title` = VALUES(`title`), `status` = 'PUBLISHED';

INSERT INTO `post_comments` (`post_id`, `user_id`, `content`, `status`) VALUES
  (3, 5, 'Mình vừa đặt thử, cà phê thơm đúng vị Tây Nguyên luôn!', 'VISIBLE'),
  (3, 6, 'Đóng gói đẹp, giao hàng nhanh, sẽ ủng hộ tiếp.', 'VISIBLE');

INSERT INTO `post_likes` (`post_id`, `user_id`) VALUES
  (1, 5), (1, 6), (2, 2), (2, 6), (3, 2), (3, 5)
ON DUPLICATE KEY UPDATE `post_id` = VALUES(`post_id`);
