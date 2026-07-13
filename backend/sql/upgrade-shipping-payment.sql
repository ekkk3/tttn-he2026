-- ====================================================================
-- MIGRATION: bo sung cot cho tich hop GHN (van don + phi) & thanh toan online.
-- CHI CHAY FILE NAY NEU BAN DA CO DATABASE CU (tao truoc ban cap nhat nay).
-- Cai moi tu sql/schema.sql thi KHONG can chay (schema.sql da co san cac cot).
--
--   mysql -u root -p --default-character-set=utf8mb4 ecommerce_db < sql/upgrade-shipping-payment.sql
-- ====================================================================

-- orders: luu dia chi GHN de tao van don & tinh phi (UC 2.2.17/2.2.22).
ALTER TABLE `orders`
  ADD COLUMN `shipping_province_id` INT NULL AFTER `shipping_address`,
  ADD COLUMN `shipping_province_name` VARCHAR(120) NULL AFTER `shipping_province_id`,
  ADD COLUMN `shipping_district_id` INT NULL AFTER `shipping_province_name`,
  ADD COLUMN `shipping_district_name` VARCHAR(120) NULL AFTER `shipping_district_id`,
  ADD COLUMN `shipping_ward_code` VARCHAR(20) NULL AFTER `shipping_district_name`,
  ADD COLUMN `shipping_ward_name` VARCHAR(120) NULL AFTER `shipping_ward_code`;

-- order_shipments: phi van chuyen, COD, thoi diem dong bo/huy van don.
ALTER TABLE `order_shipments`
  ADD COLUMN `shipping_fee` DECIMAL(15,2) NULL AFTER `height`,
  ADD COLUMN `cod_amount` DECIMAL(15,2) NULL AFTER `shipping_fee`,
  ADD COLUMN `expected_delivery_time` DATETIME NULL AFTER `cod_amount`,
  ADD COLUMN `synced_at` DATETIME NULL AFTER `expected_delivery_time`,
  ADD COLUMN `cancelled_at` DATETIME NULL AFTER `synced_at`;

-- payment_status_history: lich su trang thai thanh toan (admin + callback cong thanh toan).
CREATE TABLE IF NOT EXISTS `payment_status_history` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `order_id` BIGINT UNSIGNED NOT NULL,
  `from_status` VARCHAR(40) NULL,
  `to_status` VARCHAR(40) NOT NULL,
  `note` VARCHAR(255) NULL,
  `changed_by_user_id` BIGINT UNSIGNED NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_payment_status_history_order` (`order_id`),
  CONSTRAINT `fk_payment_status_history_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_payment_status_history_user` FOREIGN KEY (`changed_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
