-- Run in phpMyAdmin if login fails with "Failed query ... local_users"
-- Database: u880151399_PhojaaSystem

-- 1) Add missing columns (safe if already exist on MariaDB 10.3+)
ALTER TABLE `local_users` ADD COLUMN IF NOT EXISTS `pf_number` varchar(50);
ALTER TABLE `local_users` ADD COLUMN IF NOT EXISTS `pf_percentage` decimal(5,2) NOT NULL DEFAULT 0;
ALTER TABLE `local_users` ADD COLUMN IF NOT EXISTS `employee_id` varchar(50);

-- 2) Create admin user (password: Admin123)
INSERT INTO `local_users` (`full_name`, `email`, `password`, `role`, `phone`, `address`, `status`, `login_attempts`) VALUES
('Admin User', 'admin@phojaa95.com', '$2b$12$tXDFriw7GEDQD2bz45brm.RxvhL1LmAWTr/yQwT1P0H9BcoqxqL7a', 'admin', '+975-17123456', 'Thimphu, Bhutan', 'active', 0)
ON DUPLICATE KEY UPDATE
  `password` = VALUES(`password`),
  `status` = 'active',
  `login_attempts` = 0;

-- 3) Branding settings
INSERT INTO `system_settings` (`key`, `value`, `description`) VALUES
('site_name', 'PHOJAA95', 'Public site name'),
('site_tagline', '© 2027 PHOJAA95 Ecosystem. Powered by Advanced Real Estate Intelligence.', 'Login footer'),
('site_logo', '', 'Site logo URL')
ON DUPLICATE KEY UPDATE `value` = VALUES(`value`);
