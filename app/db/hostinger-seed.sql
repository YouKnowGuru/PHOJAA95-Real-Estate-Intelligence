-- PHOJAA95 seed data for Hostinger MySQL (run AFTER hostinger-install.sql)
-- Import in phpMyAdmin on database u880151399_PhojaaSystem

-- ─── Property types ───────────────────────────────────────────────
INSERT INTO `property_types` (`name`, `description`, `requires_building_docs`) VALUES
('Land', 'Agricultural and non-agricultural land plots', 0),
('Building', 'Commercial and residential buildings', 1),
('Apartment', 'Multi-unit residential apartments', 1),
('Flat', 'Single-level residential units', 1),
('Duplex', 'Two-story residential units', 1),
('Bungalow', 'Single-story detached houses', 1)
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

-- ─── Users (login credentials below) ───────────────────────────────
INSERT INTO `local_users` (`full_name`, `email`, `password`, `role`, `phone`, `address`, `status`, `login_attempts`) VALUES
('Admin User', 'admin@phojaa95.com', '$2b$12$tXDFriw7GEDQD2bz45brm.RxvhL1LmAWTr/yQwT1P0H9BcoqxqL7a', 'admin', '+975-17123456', 'Thimphu, Bhutan', 'active', 0),
('Karma Dorji', 'karma@phojaa95.com', '$2b$12$.mnOQmrTgESytIxl76a9c.BtXD3iCt7nkYV43trUMlfrfXLkjist2', 'staff', '+975-17234567', 'Thimphu, Bhutan', 'active', 0),
('Pema Wangchuk', 'pema@phojaa95.com', '$2b$12$.mnOQmrTgESytIxl76a9c.BtXD3iCt7nkYV43trUMlfrfXLkjist2', 'staff', '+975-17345678', 'Paro, Bhutan', 'active', 0),
('Sonam Choden', 'sonam@phojaa95.com', '$2b$12$.mnOQmrTgESytIxl76a9c.BtXD3iCt7nkYV43trUMlfrfXLkjist2', 'staff', '+975-17456789', 'Punakha, Bhutan', 'active', 0)
ON DUPLICATE KEY UPDATE
  `password` = VALUES(`password`),
  `status` = VALUES(`status`),
  `login_attempts` = 0;

-- ─── Branding & app settings ──────────────────────────────────────
INSERT INTO `system_settings` (`key`, `value`, `description`) VALUES
('site_name', 'PHOJAA95', 'Public site / company name'),
('site_tagline', '© 2027 PHOJAA95 Ecosystem. Powered by Advanced Real Estate Intelligence.', 'Login page footer'),
('site_logo', '', 'Site logo URL'),
('company_name', 'Phojaa95 Real Estate', 'Company name displayed in the system'),
('commission_rate', '3', 'Default commission rate percentage'),
('currency', 'BTN', 'Default currency code')
ON DUPLICATE KEY UPDATE `value` = VALUES(`value`);

-- Login: admin@phojaa95.com / Admin123
-- Staff:  karma@phojaa95.com, pema@phojaa95.com, sonam@phojaa95.com / Staff123
