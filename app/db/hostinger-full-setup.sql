-- PHOJAA95 full schema for empty Hostinger MySQL database
-- Run in phpMyAdmin on database u880151399_PhojaaSystem



-- === migrations/0000_minor_blockbuster.sql ===

CREATE TABLE `activity_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` bigint unsigned,
	`user_name` varchar(255),
	`action` varchar(100) NOT NULL,
	`entity_type` varchar(50),
	`entity_id` bigint unsigned,
	`metadata` json,
	`ip_address` varchar(45),
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `activity_logs_id` PRIMARY KEY(`id`)
);
CREATE TABLE `approval_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`property_id` bigint unsigned NOT NULL,
	`step` int NOT NULL,
	`action` enum('submitted','approved','rejected','resubmitted','completed') NOT NULL,
	`admin_id` bigint unsigned NOT NULL,
	`comments` text,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `approval_history_id` PRIMARY KEY(`id`)
);
CREATE TABLE `attendance` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` bigint unsigned NOT NULL,
	`date` date NOT NULL,
	`check_in` timestamp,
	`check_out` timestamp,
	`status` enum('present','absent','late','half_day') NOT NULL DEFAULT 'absent',
	`notes` text,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `attendance_id` PRIMARY KEY(`id`)
);
CREATE TABLE `final_lagthrams` (
	`id` int AUTO_INCREMENT NOT NULL,
	`property_id` bigint unsigned NOT NULL,
	`final_document` text,
	`completion_certificate` text,
	`approval_status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`approved_by` bigint unsigned,
	`approved_at` timestamp,
	`comments` text,
	`submitted_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `final_lagthrams_id` PRIMARY KEY(`id`)
);
CREATE TABLE `local_users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`full_name` varchar(255) NOT NULL,
	`email` varchar(320) NOT NULL,
	`password` varchar(255) NOT NULL,
	`role` enum('staff','admin') NOT NULL DEFAULT 'staff',
	`phone` varchar(20),
	`address` text,
	`profile_image` text,
	`status` enum('active','inactive','locked') NOT NULL DEFAULT 'active',
	`pf_number` varchar(50),
	`pf_percentage` decimal(5,2) NOT NULL DEFAULT 0,
	`employee_id` varchar(50),
	`last_login_at` timestamp,
	`login_attempts` int DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `local_users_id` PRIMARY KEY(`id`),
	CONSTRAINT `local_users_email_unique` UNIQUE(`email`)
);
CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` bigint unsigned NOT NULL,
	`title` varchar(255) NOT NULL,
	`message` text NOT NULL,
	`type` enum('info','success','warning','error','approval') NOT NULL DEFAULT 'info',
	`entity_type` varchar(50),
	`entity_id` bigint unsigned,
	`is_read` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
CREATE TABLE `payroll` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` bigint unsigned NOT NULL,
	`month` varchar(7) NOT NULL,
	`base_salary` decimal(12,2) NOT NULL,
	`bonus` decimal(12,2) NOT NULL DEFAULT '0',
	`deduction` decimal(12,2) NOT NULL DEFAULT '0',
	`net_salary` decimal(12,2) NOT NULL,
	`payment_status` enum('pending','paid') NOT NULL DEFAULT 'pending',
	`paid_at` timestamp,
	`paid_by` bigint unsigned,
	`notes` text,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `payroll_id` PRIMARY KEY(`id`)
);
CREATE TABLE `properties` (
	`id` int AUTO_INCREMENT NOT NULL,
	`property_name` varchar(255) NOT NULL,
	`property_type_id` bigint unsigned NOT NULL,
	`address` text NOT NULL,
	`latitude` decimal(10,8),
	`longitude` decimal(11,8),
	`owner_name` varchar(255) NOT NULL,
	`owner_cid` varchar(11) NOT NULL,
	`owner_phone` varchar(20) NOT NULL,
	`owner_address` text NOT NULL,
	`selling_price` decimal(15,2) NOT NULL,
	`real_estate_fee` decimal(15,2) NOT NULL,
	`current_step` int NOT NULL DEFAULT 1,
	`approval_status` enum('draft','submitted','pending_review','approved','rejected','completed','cancelled') NOT NULL DEFAULT 'draft',
	`workflow_status` enum('pending','processing','approved','rejected','completed','cancelled') NOT NULL DEFAULT 'pending',
	`listed_by_id` bigint unsigned NOT NULL,
	`admin_notes` text,
	`rejection_comments` text,
	`completed_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `properties_id` PRIMARY KEY(`id`)
);
CREATE TABLE `property_agreements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`property_id` bigint unsigned NOT NULL,
	`agreement_file` text,
	`payment_screenshot` text,
	`commission_amount` decimal(15,2),
	`payment_amount` decimal(15,2),
	`approval_status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`approved_by` bigint unsigned,
	`approved_at` timestamp,
	`comments` text,
	`submitted_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `property_agreements_id` PRIMARY KEY(`id`)
);
CREATE TABLE `property_documents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`property_id` bigint unsigned NOT NULL,
	`gewog_certification` text,
	`endorses_document` text,
	`internal_agreement` text,
	`occupancy_certificate` text,
	`plr_verification` text,
	`remaining_payment_screenshot` text,
	`uploaded_by` bigint unsigned NOT NULL,
	`approval_status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`approved_by` bigint unsigned,
	`approved_at` timestamp,
	`comments` text,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `property_documents_id` PRIMARY KEY(`id`)
);
CREATE TABLE `property_types` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`description` text,
	`requires_building_docs` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `property_types_id` PRIMARY KEY(`id`),
	CONSTRAINT `property_types_name_unique` UNIQUE(`name`)
);
CREATE TABLE `system_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`key` varchar(100) NOT NULL,
	`value` text,
	`description` text,
	`updated_by` bigint unsigned,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `system_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `system_settings_key_unique` UNIQUE(`key`)
);
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`unionId` varchar(255) NOT NULL,
	`name` varchar(255),
	`email` varchar(320),
	`avatar` text,
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`lastSignInAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_unionId_unique` UNIQUE(`unionId`)
);
CREATE TABLE `verification_processes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`property_id` bigint unsigned NOT NULL,
	`lagthram_status` enum('pending','processing','completed') NOT NULL DEFAULT 'pending',
	`loan_status` enum('pending','processing','completed') NOT NULL DEFAULT 'pending',
	`lagthram_completed_at` timestamp,
	`loan_completed_at` timestamp,
	`approved_by` bigint unsigned,
	`approved_at` timestamp,
	`comments` text,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `verification_processes_id` PRIMARY KEY(`id`)
);
CREATE INDEX `idx_activity_user` ON `activity_logs` (`user_id`);;
CREATE INDEX `idx_activity_created` ON `activity_logs` (`created_at`);;
CREATE INDEX `idx_activity_entity` ON `activity_logs` (`entity_type`,`entity_id`);;
CREATE INDEX `idx_approval_history_property` ON `approval_history` (`property_id`);;
CREATE INDEX `idx_approval_history_admin` ON `approval_history` (`admin_id`);;
CREATE INDEX `idx_approval_history_created` ON `approval_history` (`created_at`);;
CREATE INDEX `idx_attendance_user` ON `attendance` (`user_id`);;
CREATE INDEX `idx_attendance_date` ON `attendance` (`date`);;
CREATE INDEX `idx_final_lagthram_property` ON `final_lagthrams` (`property_id`);;
CREATE INDEX `idx_local_users_email` ON `local_users` (`email`);;
CREATE INDEX `idx_local_users_role` ON `local_users` (`role`);;
CREATE INDEX `idx_local_users_status` ON `local_users` (`status`);;
CREATE INDEX `idx_notifications_user` ON `notifications` (`user_id`);;
CREATE INDEX `idx_notifications_read` ON `notifications` (`is_read`);;
CREATE INDEX `idx_payroll_user` ON `payroll` (`user_id`);;
CREATE INDEX `idx_payroll_month` ON `payroll` (`month`);;
CREATE INDEX `idx_properties_status` ON `properties` (`approval_status`);;
CREATE INDEX `idx_properties_workflow` ON `properties` (`workflow_status`);;
CREATE INDEX `idx_properties_listed_by` ON `properties` (`listed_by_id`);;
CREATE INDEX `idx_properties_owner_cid` ON `properties` (`owner_cid`);;
CREATE INDEX `idx_properties_step` ON `properties` (`current_step`);;
CREATE INDEX `idx_agreements_property` ON `property_agreements` (`property_id`);;
CREATE INDEX `idx_docs_property` ON `property_documents` (`property_id`);;
CREATE INDEX `idx_verification_property` ON `verification_processes` (`property_id`);

-- === migrations/0001_misty_iron_lad.sql ===

CREATE TABLE `chat_conversations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` bigint unsigned NOT NULL,
	`title` varchar(255) NOT NULL DEFAULT 'New Conversation',
	`model` varchar(100) NOT NULL DEFAULT 'openai/gpt-4o',
	`system_prompt` text,
	`is_archived` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `chat_conversations_id` PRIMARY KEY(`id`)
);
CREATE TABLE `chat_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`conversation_id` bigint unsigned NOT NULL,
	`role` enum('user','assistant','system','tool') NOT NULL,
	`content` text NOT NULL,
	`tool_calls` json,
	`tool_call_id` varchar(255),
	`tool_name` varchar(100),
	`metadata` json,
	`tokens_used` int,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `chat_messages_id` PRIMARY KEY(`id`)
);
CREATE TABLE `password_reset_tokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` bigint unsigned NOT NULL,
	`token` varchar(255) NOT NULL,
	`expires_at` timestamp NOT NULL,
	`used` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `password_reset_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `password_reset_tokens_token_unique` UNIQUE(`token`)
);
CREATE TABLE `property_images` (
	`id` int AUTO_INCREMENT NOT NULL,
	`property_id` bigint unsigned NOT NULL,
	`url` text NOT NULL,
	`public_id` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `property_images_id` PRIMARY KEY(`id`)
);
ALTER TABLE `payroll` ADD `pf_deduction` decimal(12,2) DEFAULT '0' NOT NULL;;
ALTER TABLE `payroll` ADD `pf_percentage` decimal(5,2) DEFAULT '0' NOT NULL;;
ALTER TABLE `properties` ADD `buyer_name` varchar(255);;
ALTER TABLE `properties` ADD `buyer_cid` varchar(11);;
ALTER TABLE `properties` ADD `buyer_phone` varchar(20);;
ALTER TABLE `properties` ADD `buyer_address` text;;
ALTER TABLE `properties` ADD `is_sold` boolean DEFAULT false NOT NULL;;
CREATE INDEX `idx_chat_conv_user` ON `chat_conversations` (`user_id`);;
CREATE INDEX `idx_chat_conv_updated` ON `chat_conversations` (`updated_at`);;
CREATE INDEX `idx_chat_msg_conv` ON `chat_messages` (`conversation_id`);;
CREATE INDEX `idx_chat_msg_created` ON `chat_messages` (`created_at`);;
CREATE INDEX `idx_reset_tokens_token` ON `password_reset_tokens` (`token`);;
CREATE INDEX `idx_reset_tokens_user` ON `password_reset_tokens` (`user_id`);;
CREATE INDEX `idx_property_images_property` ON `property_images` (`property_id`);;
ALTER TABLE `property_documents` DROP COLUMN `endorses_document`;

-- === migrations/0002_numerous_lilandra.sql ===

ALTER TABLE `properties` ADD `no_objection_letter` text;

-- === migrations/0003_add_requires_building_docs.sql ===

ALTER TABLE `property_types` ADD `requires_building_docs` boolean DEFAULT false NOT NULL;

-- === migrations/0003_red_turbo.sql ===

CREATE TABLE `library_documents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`category` varchar(100) NOT NULL DEFAULT 'General',
	`storage_key` varchar(512) NOT NULL,
	`file_url` text NOT NULL,
	`file_name` varchar(255) NOT NULL,
	`mime_type` varchar(100) NOT NULL,
	`file_size` int NOT NULL,
	`uploaded_by` bigint unsigned NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `library_documents_id` PRIMARY KEY(`id`)
);
ALTER TABLE `attendance` ADD `deduction_notes` text;;
ALTER TABLE `payroll` ADD `deduction_notes` text;;
ALTER TABLE `properties` ADD `features` json;;
ALTER TABLE `property_documents` ADD `remaining_payment_amount` decimal(15,2);;
CREATE INDEX `idx_library_docs_category` ON `library_documents` (`category`);;
CREATE INDEX `idx_library_docs_uploaded_by` ON `library_documents` (`uploaded_by`);;
CREATE INDEX `idx_library_docs_created` ON `library_documents` (`created_at`);;
ALTER TABLE `activity_logs` ADD CONSTRAINT `activity_logs_user_id_local_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `local_users`(`id`) ON DELETE set null ON UPDATE no action;;
ALTER TABLE `approval_history` ADD CONSTRAINT `approval_history_property_id_properties_id_fk` FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON DELETE cascade ON UPDATE no action;;
ALTER TABLE `approval_history` ADD CONSTRAINT `approval_history_admin_id_local_users_id_fk` FOREIGN KEY (`admin_id`) REFERENCES `local_users`(`id`) ON DELETE restrict ON UPDATE no action;;
ALTER TABLE `attendance` ADD CONSTRAINT `attendance_user_id_local_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `local_users`(`id`) ON DELETE cascade ON UPDATE no action;;
ALTER TABLE `chat_conversations` ADD CONSTRAINT `chat_conversations_user_id_local_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `local_users`(`id`) ON DELETE cascade ON UPDATE no action;;
ALTER TABLE `chat_messages` ADD CONSTRAINT `chat_messages_conversation_id_chat_conversations_id_fk` FOREIGN KEY (`conversation_id`) REFERENCES `chat_conversations`(`id`) ON DELETE cascade ON UPDATE no action;;
ALTER TABLE `final_lagthrams` ADD CONSTRAINT `final_lagthrams_property_id_properties_id_fk` FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON DELETE cascade ON UPDATE no action;;
ALTER TABLE `final_lagthrams` ADD CONSTRAINT `final_lagthrams_approved_by_local_users_id_fk` FOREIGN KEY (`approved_by`) REFERENCES `local_users`(`id`) ON DELETE set null ON UPDATE no action;;
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_user_id_local_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `local_users`(`id`) ON DELETE cascade ON UPDATE no action;;
ALTER TABLE `password_reset_tokens` ADD CONSTRAINT `password_reset_tokens_user_id_local_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `local_users`(`id`) ON DELETE cascade ON UPDATE no action;;
ALTER TABLE `payroll` ADD CONSTRAINT `payroll_user_id_local_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `local_users`(`id`) ON DELETE cascade ON UPDATE no action;;
ALTER TABLE `payroll` ADD CONSTRAINT `payroll_paid_by_local_users_id_fk` FOREIGN KEY (`paid_by`) REFERENCES `local_users`(`id`) ON DELETE set null ON UPDATE no action;;
ALTER TABLE `properties` ADD CONSTRAINT `properties_property_type_id_property_types_id_fk` FOREIGN KEY (`property_type_id`) REFERENCES `property_types`(`id`) ON DELETE restrict ON UPDATE no action;;
ALTER TABLE `properties` ADD CONSTRAINT `properties_listed_by_id_local_users_id_fk` FOREIGN KEY (`listed_by_id`) REFERENCES `local_users`(`id`) ON DELETE restrict ON UPDATE no action;;
ALTER TABLE `property_agreements` ADD CONSTRAINT `property_agreements_property_id_properties_id_fk` FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON DELETE cascade ON UPDATE no action;;
ALTER TABLE `property_agreements` ADD CONSTRAINT `property_agreements_approved_by_local_users_id_fk` FOREIGN KEY (`approved_by`) REFERENCES `local_users`(`id`) ON DELETE set null ON UPDATE no action;;
ALTER TABLE `property_documents` ADD CONSTRAINT `property_documents_property_id_properties_id_fk` FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON DELETE cascade ON UPDATE no action;;
ALTER TABLE `property_documents` ADD CONSTRAINT `property_documents_uploaded_by_local_users_id_fk` FOREIGN KEY (`uploaded_by`) REFERENCES `local_users`(`id`) ON DELETE restrict ON UPDATE no action;;
ALTER TABLE `property_documents` ADD CONSTRAINT `property_documents_approved_by_local_users_id_fk` FOREIGN KEY (`approved_by`) REFERENCES `local_users`(`id`) ON DELETE set null ON UPDATE no action;;
ALTER TABLE `property_images` ADD CONSTRAINT `property_images_property_id_properties_id_fk` FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON DELETE cascade ON UPDATE no action;;
ALTER TABLE `system_settings` ADD CONSTRAINT `system_settings_updated_by_local_users_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `local_users`(`id`) ON DELETE set null ON UPDATE no action;;
ALTER TABLE `verification_processes` ADD CONSTRAINT `verification_processes_property_id_properties_id_fk` FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON DELETE cascade ON UPDATE no action;;
ALTER TABLE `verification_processes` ADD CONSTRAINT `verification_processes_approved_by_local_users_id_fk` FOREIGN KEY (`approved_by`) REFERENCES `local_users`(`id`) ON DELETE set null ON UPDATE no action;



-- PHOJAA95 seed data for Hostinger MySQL (run AFTER hostinger-install.sql)
-- Import in phpMyAdmin on database u880151399_PhojaaSystem

-- â”€â”€â”€ Property types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
INSERT INTO `property_types` (`name`, `description`, `requires_building_docs`) VALUES
('Land', 'Agricultural and non-agricultural land plots', 0),
('Building', 'Commercial and residential buildings', 1),
('Apartment', 'Multi-unit residential apartments', 1),
('Flat', 'Single-level residential units', 1),
('Duplex', 'Two-story residential units', 1),
('Bungalow', 'Single-story detached houses', 1)
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

-- â”€â”€â”€ Users (login credentials below) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
INSERT INTO `local_users` (`full_name`, `email`, `password`, `role`, `phone`, `address`, `status`, `login_attempts`) VALUES
('Admin User', 'admin@phojaa95.com', '$2b$12$tXDFriw7GEDQD2bz45brm.RxvhL1LmAWTr/yQwT1P0H9BcoqxqL7a', 'admin', '+975-17123456', 'Thimphu, Bhutan', 'active', 0),
('Karma Dorji', 'karma@phojaa95.com', '$2b$12$.mnOQmrTgESytIxl76a9c.BtXD3iCt7nkYV43trUMlfrfXLkjist2', 'staff', '+975-17234567', 'Thimphu, Bhutan', 'active', 0),
('Pema Wangchuk', 'pema@phojaa95.com', '$2b$12$.mnOQmrTgESytIxl76a9c.BtXD3iCt7nkYV43trUMlfrfXLkjist2', 'staff', '+975-17345678', 'Paro, Bhutan', 'active', 0),
('Sonam Choden', 'sonam@phojaa95.com', '$2b$12$.mnOQmrTgESytIxl76a9c.BtXD3iCt7nkYV43trUMlfrfXLkjist2', 'staff', '+975-17456789', 'Punakha, Bhutan', 'active', 0)
ON DUPLICATE KEY UPDATE
  `password` = VALUES(`password`),
  `status` = VALUES(`status`),
  `login_attempts` = 0;

-- â”€â”€â”€ Branding & app settings â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
INSERT INTO `system_settings` (`key`, `value`, `description`) VALUES
('site_name', 'PHOJAA95', 'Public site / company name'),
('site_tagline', 'Â© 2027 PHOJAA95 Ecosystem. Powered by Advanced Real Estate Intelligence.', 'Login page footer'),
('site_logo', '', 'Site logo URL'),
('company_name', 'Phojaa95 Real Estate', 'Company name displayed in the system'),
('commission_rate', '3', 'Default commission rate percentage'),
('currency', 'BTN', 'Default currency code')
ON DUPLICATE KEY UPDATE `value` = VALUES(`value`);

-- Login: admin@phojaa95.com / Admin123
-- Staff:  karma@phojaa95.com, pema@phojaa95.com, sonam@phojaa95.com / Staff123

