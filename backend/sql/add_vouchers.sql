-- Migration bo sung: he thong Voucher/Ma giam gia.
-- Ly do can file nay: de cuong yeu cau tinh nang "Voucher/ma giam gia khi checkout"
-- va "Admin quan ly voucher/khuyen mai", nhung schema goc lay tu Laravel
-- (database/ecommerce_schema_mysql.sql) KHONG co bang vouchers/order_vouchers.
--
-- Chay file nay SAU KHI da import ecommerce_schema_mysql.sql + ecommerce_seed_data.sql:
--   mysql -u root -p ecommerce_db < sql/add_vouchers.sql

USE `ecommerce_db`;

CREATE TABLE IF NOT EXISTS `vouchers` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `code` VARCHAR(50) NOT NULL,
  `description` VARCHAR(255) NULL,
  `discount_type` ENUM('PERCENT','FIXED') NOT NULL DEFAULT 'PERCENT',
  `discount_value` DECIMAL(15,2) NOT NULL,
  `min_order_amount` DECIMAL(15,2) NOT NULL DEFAULT 0,
  `max_discount_amount` DECIMAL(15,2) NULL,
  `usage_limit` INT UNSIGNED NULL,
  `used_count` INT UNSIGNED NOT NULL DEFAULT 0,
  `starts_at` DATETIME NULL,
  `expires_at` DATETIME NULL,
  `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
  `created_by_admin_id` BIGINT UNSIGNED NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_vouchers_code` (`code`),
  CONSTRAINT `fk_vouchers_created_by_admin`
    FOREIGN KEY (`created_by_admin_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `order_vouchers` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `order_id` BIGINT UNSIGNED NOT NULL,
  `voucher_id` BIGINT UNSIGNED NOT NULL,
  `discount_amount` DECIMAL(15,2) NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_order_vouchers_order_id` (`order_id`),
  CONSTRAINT `fk_order_vouchers_order`
    FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_order_vouchers_voucher`
    FOREIGN KEY (`voucher_id`) REFERENCES `vouchers` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
