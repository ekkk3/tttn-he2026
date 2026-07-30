-- ====================================================================
-- MIGRATION: bo sung bang purchase_prices (UC 2.2.24 Quan ly gia nhap san
-- pham - nhieu dong theo NCC/ngay ap dung) va chatbot_messages (UC 2.2.6a
-- Tu van AI Chatbot - luu lai hoi thoai cua nguoi dung da dang nhap).
-- CHI CHAY FILE NAY NEU BAN DA CO DATABASE CU (tao truoc ban cap nhat nay).
-- Cai moi tu sql/schema.sql thi KHONG can chay (schema.sql da co san 2 bang nay).
--
--   mysql -u root -p --default-character-set=utf8mb4 ecommerce_db < sql/upgrade-purchase-prices-chatbot.sql
-- ====================================================================

CREATE TABLE IF NOT EXISTS `purchase_prices` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `product_id` BIGINT UNSIGNED NOT NULL,
  `supplier_id` BIGINT UNSIGNED NULL,
  `price` DECIMAL(15,2) NOT NULL,
  `effective_date` DATE NOT NULL,
  `note` VARCHAR(255) NULL,
  `created_by_user_id` BIGINT UNSIGNED NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_purchase_prices_product` (`product_id`, `effective_date`),
  CONSTRAINT `fk_purchase_prices_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_purchase_prices_supplier` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_purchase_prices_creator` FOREIGN KEY (`created_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `chatbot_messages` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `role` ENUM('user','assistant') NOT NULL,
  `content` TEXT NOT NULL,
  `source` VARCHAR(20) NULL COMMENT 'gemini/openai/local - chi co o tin nhan assistant',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_chatbot_messages_user` (`user_id`, `created_at`),
  CONSTRAINT `fk_chatbot_messages_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
