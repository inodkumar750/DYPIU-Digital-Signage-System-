-- ==============================================================================
-- CAMPUSCAST — UNIVERSITY DIGITAL SIGNAGE MANAGEMENT SYSTEM
-- COMPLETE DATABASE SCHEMA & INITIAL SEED DATA
-- Target: MariaDB / MySQL 8.0 (XAMPP localhost)
-- ==============================================================================

CREATE DATABASE IF NOT EXISTS `campuscast_db` 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

USE `campuscast_db`;

-- 1. Users & Administrators
CREATE TABLE IF NOT EXISTS `users` (
  `id` VARCHAR(50) NOT NULL,
  `name` VARCHAR(150) NOT NULL,
  `email` VARCHAR(150) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `department` VARCHAR(150) NOT NULL,
  `role` ENUM('Super Administrator', 'IT Administrator', 'Content Manager', 'Monitoring User') NOT NULL DEFAULT 'Content Manager',
  `status` ENUM('Active', 'Invited', 'Suspended') NOT NULL DEFAULT 'Active',
  `last_login` VARCHAR(100) DEFAULT 'Pending first login',
  `avatar_url` VARCHAR(255) DEFAULT NULL,
  `allowed_menus` TEXT DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Media Assets
CREATE TABLE IF NOT EXISTS `media_assets` (
  `id` VARCHAR(50) NOT NULL,
  `file_name` VARCHAR(255) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `type` ENUM('Image', 'Video') NOT NULL,
  `category` ENUM('University Admissions', 'Events', 'Workshops', 'Placements', 'Student Activities', 'Announcements') NOT NULL,
  `upload_date` VARCHAR(20) NOT NULL,
  `duration_seconds` INT DEFAULT NULL,
  `file_size` VARCHAR(50) NOT NULL,
  `dimensions` VARCHAR(50) NOT NULL,
  `aspect_ratio` VARCHAR(10) NOT NULL DEFAULT '16:9',
  `thumbnail_url` VARCHAR(255) DEFAULT NULL,
  `file_url` VARCHAR(255) DEFAULT NULL,
  `accent_tone` ENUM('primary', 'secondary', 'accent', 'cream') DEFAULT 'primary',
  `uploaded_by` VARCHAR(150) NOT NULL,
  `description` TEXT DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Playlists Header
CREATE TABLE IF NOT EXISTS `playlists` (
  `id` VARCHAR(50) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `description` TEXT DEFAULT NULL,
  `status` ENUM('Active', 'Draft', 'Archived') NOT NULL DEFAULT 'Active',
  `default_image_duration` INT NOT NULL DEFAULT 10,
  `auto_advance_video` BOOLEAN NOT NULL DEFAULT TRUE,
  `loop_playlist` BOOLEAN NOT NULL DEFAULT TRUE,
  `last_updated` VARCHAR(50) DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Playlist Slide Items
CREATE TABLE IF NOT EXISTS `playlist_items` (
  `id` VARCHAR(50) NOT NULL,
  `playlist_id` VARCHAR(50) NOT NULL,
  `media_id` VARCHAR(50) NOT NULL,
  `order_index` INT NOT NULL,
  `display_duration_seconds` INT NOT NULL DEFAULT 10,
  `mute_audio` BOOLEAN NOT NULL DEFAULT TRUE,
  `loop_video` BOOLEAN NOT NULL DEFAULT FALSE,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_pl_items_playlist` FOREIGN KEY (`playlist_id`) REFERENCES `playlists` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_pl_items_media` FOREIGN KEY (`media_id`) REFERENCES `media_assets` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Screen Devices (Smart TVs)
CREATE TABLE IF NOT EXISTS `screens` (
  `id` VARCHAR(50) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `building` VARCHAR(100) NOT NULL,
  `floor` VARCHAR(100) NOT NULL,
  `location` VARCHAR(255) NOT NULL,
  `device_type` VARCHAR(100) NOT NULL,
  `resolution` VARCHAR(50) NOT NULL DEFAULT '3840x2160',
  `os_version` VARCHAR(50) NOT NULL DEFAULT 'Android TV 12',
  `player_app_version` VARCHAR(50) NOT NULL DEFAULT 'v1.4.2',
  `connection_status` ENUM('Online', 'Offline') NOT NULL DEFAULT 'Online',
  `last_seen` VARCHAR(100) DEFAULT 'Just now',
  `last_heartbeat` VARCHAR(100) DEFAULT NULL,
  `assigned_playlist_id` VARCHAR(50) DEFAULT NULL,
  `current_media_id` VARCHAR(50) DEFAULT NULL,
  `ip_address` VARCHAR(50) NOT NULL,
  `storage_used_pct` INT NOT NULL DEFAULT 35,
  `playback_error` TEXT DEFAULT NULL,
  `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
  `pairing_code` VARCHAR(10) DEFAULT NULL,
  `device_token` VARCHAR(255) DEFAULT NULL,
  `wake_requested` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Screen Groups
CREATE TABLE IF NOT EXISTS `screen_groups` (
  `id` VARCHAR(50) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `building` VARCHAR(100) NOT NULL,
  `floor` VARCHAR(100) NOT NULL,
  `description` TEXT DEFAULT NULL,
  `assigned_playlist_id` VARCHAR(50) DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Screen Group Junction
CREATE TABLE IF NOT EXISTS `screen_group_items` (
  `group_id` VARCHAR(50) NOT NULL,
  `screen_id` VARCHAR(50) NOT NULL,
  PRIMARY KEY (`group_id`, `screen_id`),
  CONSTRAINT `fk_group_items_group` FOREIGN KEY (`group_id`) REFERENCES `screen_groups` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_group_items_screen` FOREIGN KEY (`screen_id`) REFERENCES `screens` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Campaigns
CREATE TABLE IF NOT EXISTS `campaigns` (
  `id` VARCHAR(50) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `description` TEXT DEFAULT NULL,
  `playlist_id` VARCHAR(50) NOT NULL,
  `start_date` VARCHAR(20) NOT NULL,
  `end_date` VARCHAR(20) NOT NULL,
  `start_time` VARCHAR(20) NOT NULL,
  `end_time` VARCHAR(20) NOT NULL,
  `status` ENUM('Draft', 'Scheduled', 'Active', 'Paused', 'Completed') NOT NULL DEFAULT 'Scheduled',
  `priority` ENUM('Normal', 'High', 'Urgent') NOT NULL DEFAULT 'Normal',
  `created_by` VARCHAR(150) NOT NULL,
  `qr_url` VARCHAR(500) DEFAULT NULL,
  `qr_label` VARCHAR(120) DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_campaign_playlist` FOREIGN KEY (`playlist_id`) REFERENCES `playlists` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. Campaign Target Screens & Groups
CREATE TABLE IF NOT EXISTS `campaign_targets` (
  `id` INT AUTO_INCREMENT NOT NULL,
  `campaign_id` VARCHAR(50) NOT NULL,
  `target_type` ENUM('screen', 'group') NOT NULL,
  `target_id` VARCHAR(50) NOT NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_targets_campaign` FOREIGN KEY (`campaign_id`) REFERENCES `campaigns` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. Publish Jobs
CREATE TABLE IF NOT EXISTS `publish_jobs` (
  `id` VARCHAR(50) NOT NULL,
  `campaign_id` VARCHAR(50) NOT NULL,
  `campaign_name` VARCHAR(255) NOT NULL,
  `playlist_id` VARCHAR(50) NOT NULL,
  `playlist_name` VARCHAR(255) NOT NULL,
  `target_screen_ids` TEXT NOT NULL,
  `publication_date` VARCHAR(50) NOT NULL,
  `status` ENUM('Pending', 'Publishing', 'Published', 'Failed') NOT NULL DEFAULT 'Pending',
  `success_count` INT NOT NULL DEFAULT 0,
  `failed_count` INT NOT NULL DEFAULT 0,
  `progress_pct` INT NOT NULL DEFAULT 0,
  `initiated_by` VARCHAR(150) NOT NULL,
  `error_message` TEXT DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 11. Activity Log
CREATE TABLE IF NOT EXISTS `activity_events` (
  `id` VARCHAR(50) NOT NULL,
  `action_type` VARCHAR(30) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `detail` TEXT NOT NULL,
  `actor` VARCHAR(150) NOT NULL,
  `timestamp` VARCHAR(100) NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 12. University Signage Settings
CREATE TABLE IF NOT EXISTS `university_settings` (
  `id` INT NOT NULL DEFAULT 1,
  `settings_json` JSON NOT NULL,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================================================
-- INITIAL SEED DATA
-- ==============================================================================

-- Seed Users
INSERT INTO `users` (`id`, `name`, `email`, `password_hash`, `department`, `role`, `status`, `last_login`, `avatar_url`) VALUES
('usr-001', 'Vinod Kumar Jain', 'vinod.jain@dypiu.ac.in', 'RESET_ON_FIRST_START', 'University IT & Infrastructure', 'Super Administrator', 'Active', 'Today, 09:14', '/src/assets/images/admin_avatar_1795455462108.jpg'),
('usr-002', 'Prof. Sunita Rao', 'sunita.rao@dypiu.ac.in', 'RESET_ON_FIRST_START', 'Media & Corporate Communications', 'Content Manager', 'Active', 'Today, 08:45', NULL),
('usr-003', 'Rajesh Sharma', 'rajesh.sharma@dypiu.ac.in', 'RESET_ON_FIRST_START', 'Network & Campus Infrastructure', 'IT Administrator', 'Active', 'Yesterday, 17:30', NULL),
('usr-004', 'Pooja Iyer', 'pooja.iyer@dypiu.ac.in', 'RESET_ON_FIRST_START', 'Student Affairs & Cultural Events', 'Content Manager', 'Active', 'Nov 20, 14:15', NULL),
('usr-005', 'Amit Verma', 'amit.verma@dypiu.ac.in', 'RESET_ON_FIRST_START', 'Campus Security Operations', 'Monitoring User', 'Active', 'Nov 19, 11:20', NULL)
ON DUPLICATE KEY UPDATE `name`=VALUES(`name`);

-- Seed Media Assets
INSERT INTO `media_assets` (`id`, `file_name`, `title`, `type`, `category`, `upload_date`, `duration_seconds`, `file_size`, `dimensions`, `thumbnail_url`, `accent_tone`, `uploaded_by`, `description`) VALUES
('med-001', 'admissions-2026-hero-banner.jpg', 'Admissions 2026 Campus Open House', 'Image', 'University Admissions', '2026-11-21', NULL, '3.4 MB', '3840 × 2160', '/src/assets/images/media_admissions_poster_1795455460163.jpg', 'primary', 'Ananya Deshmukh', 'Main campus entrance visual for B.Tech, Design, and Management 2026 intake.'),
('med-002', 'robotics-ai-workshop-promo.mp4', 'Autonomous Robotics & AI Workshop', 'Video', 'Workshops', '2026-11-20', 30, '42.8 MB', '1920 × 1080', '/src/assets/images/media_tech_symposium_1795455461771.jpg', 'secondary', 'Rohan Kulkarni', 'Hands-on robotics lab orientation reel for School of Engineering.'),
('med-003', 'global-career-summit-2026.jpg', 'Campus Placement Drive — Autumn Cohort', 'Image', 'Placements', '2026-11-19', NULL, '2.9 MB', '3840 × 2160', '/src/assets/images/media_placement_drive_1795455461472.jpg', 'accent', 'Meera Nair', 'Pre-placement talk schedule and corporate recruiter spotlight.'),
('med-004', 'aarohan-cultural-fest-teaser.jpg', 'Aarohan 2026 Annual Cultural Night', 'Image', 'Events', '2026-11-18', NULL, '4.1 MB', '3840 × 2160', '/src/assets/images/media_cultural_fest_1795455461580.jpg', 'cream', 'Kabir Sen', 'Amphitheater musical performances, drama club showcase, and guest artists.'),
('med-005', 'library-extended-hours-notice.jpg', 'Central Library 24x7 Exam Schedule', 'Image', 'Announcements', '2026-11-17', NULL, '1.8 MB', '3840 × 2160', '/src/assets/images/media_library_notice_1795455462127.jpg', 'primary', 'Dr. Shweta Joshi', 'End-semester extended reading hall hours, quiet zones, and book drop timings.')
ON DUPLICATE KEY UPDATE `title`=VALUES(`title`);

-- Seed Playlists
INSERT INTO `playlists` (`id`, `name`, `description`, `status`, `default_image_duration`, `auto_advance_video`, `loop_playlist`, `last_updated`) VALUES
('pl-001', 'Main Campus Entrance Loop', 'High-priority admissions notices and general orientation reels.', 'Active', 10, TRUE, TRUE, '2026-11-23 09:30'),
('pl-002', 'Engineering Corridors Display', 'Technical workshops, hackathons, and research symposium teasers.', 'Active', 12, TRUE, TRUE, '2026-11-22 17:10'),
('pl-003', 'Student Commons & Cafeteria', 'Cultural fest announcements, student clubs, and sports schedules.', 'Active', 8, TRUE, TRUE, '2026-11-21 14:00'),
('pl-004', 'Seminar Halls & Auditorium', 'Keynote guest introductions, schedule banners, and venue directions.', 'Active', 15, TRUE, TRUE, '2026-11-20 11:20')
ON DUPLICATE KEY UPDATE `name`=VALUES(`name`);

-- Seed Playlist Items
INSERT INTO `playlist_items` (`id`, `playlist_id`, `media_id`, `order_index`, `display_duration_seconds`, `mute_audio`, `loop_video`) VALUES
('pi-001', 'pl-001', 'med-001', 1, 10, TRUE, FALSE),
('pi-002', 'pl-001', 'med-002', 2, 30, TRUE, FALSE),
('pi-003', 'pl-001', 'med-003', 3, 10, TRUE, FALSE),
('pi-004', 'pl-002', 'med-002', 1, 30, TRUE, FALSE),
('pi-005', 'pl-002', 'med-001', 2, 12, TRUE, FALSE),
('pi-006', 'pl-003', 'med-004', 1, 8, TRUE, FALSE),
('pi-007', 'pl-003', 'med-005', 2, 8, TRUE, FALSE)
ON DUPLICATE KEY UPDATE `display_duration_seconds`=VALUES(`display_duration_seconds`);

-- Seed Screen Devices (Smart TVs across campus)
INSERT INTO `screens` (`id`, `name`, `building`, `floor`, `location`, `device_type`, `resolution`, `os_version`, `player_app_version`, `connection_status`, `last_seen`, `last_heartbeat`, `assigned_playlist_id`, `current_media_id`, `ip_address`, `storage_used_pct`, `playback_error`, `is_active`) VALUES
('DYPIU-TV-001', 'Main Entrance Lobby Screen 1', 'Building A', 'Ground Floor', 'Main Entrance Foyer', 'Samsung Commercial 65" UHD', '3840x2160', 'Android TV 12', 'v1.4.2', 'Online', 'Just now', '2026-11-24 11:30:12', 'pl-001', 'med-001', '10.40.1.11', 42, NULL, TRUE),
('DYPIU-TV-002', 'Main Entrance Lobby Screen 2', 'Building A', 'Ground Floor', 'Welcome Desk Left', 'Samsung Commercial 65" UHD', '3840x2160', 'Android TV 12', 'v1.4.2', 'Online', 'Just now', '2026-11-24 11:30:15', 'pl-001', 'med-002', '10.40.1.12', 38, NULL, TRUE),
('DYPIU-TV-003', 'Academic Dean Office Waiting Area', 'Building A', 'First Floor', 'Dean Corridor North', 'LG webOS 55" Commercial', '1920x1080', 'Android TV 11', 'v1.4.2', 'Online', '1m ago', '2026-11-24 11:29:45', 'pl-001', 'med-003', '10.40.1.13', 25, NULL, TRUE),
('DYPIU-TV-004', 'School of Engineering Central Hall', 'Building B', 'Ground Floor', 'Atrium Left Display', 'Sony Bravia Pro 75" 4K', '3840x2160', 'Android TV 12', 'v1.4.2', 'Online', 'Just now', '2026-11-24 11:30:10', 'pl-002', 'med-002', '10.40.2.14', 55, NULL, TRUE),
('DYPIU-TV-005', 'Robotics & Automation Lab Foyer', 'Building B', 'First Floor', 'Robotics Lab Corridor', 'LG webOS 55" Commercial', '1920x1080', 'Android TV 11', 'v1.4.2', 'Online', 'Just now', '2026-11-24 11:30:18', 'pl-002', 'med-002', '10.40.2.15', 47, NULL, TRUE),
('DYPIU-TV-006', 'Student Activity Center Plaza', 'Student Hub', 'Ground Floor', 'Central Food Court Entrance', 'TCL Commercial 65" 4K', '3840x2160', 'Android TV 12', 'v1.4.2', 'Online', 'Just now', '2026-11-24 11:30:20', 'pl-003', 'med-004', '10.40.3.16', 60, NULL, TRUE),
('DYPIU-TV-007', 'Central Library Reception Wall', 'Building A', 'Second Floor', 'Library Entrance Counter', 'LG webOS 55" Commercial', '1920x1080', 'Android TV 11', 'v1.4.2', 'Online', '2m ago', '2026-11-24 11:28:40', 'pl-001', 'med-005', '10.40.1.17', 30, NULL, TRUE),
('DYPIU-TV-010', 'Amphitheater Concourse', 'Student Hub', 'Ground Floor', 'Outdoor Amphitheater Kiosk', 'Sony Bravia Pro 65"', '3840x2160', 'Android TV 11', 'v1.4.1', 'Offline', '18m ago', '2026-11-24 11:12:00', 'pl-003', NULL, '10.40.3.22', 88, 'Network timeout / Wi-Fi disconnected', TRUE),
('DYPIU-TV-016', 'Seminar Hall B Corridor', 'Building B', 'Second Floor', 'Seminar Hall Outer Lobby', 'Samsung Commercial 55"', '1920x1080', 'Android TV 12', 'v1.4.2', 'Offline', '45m ago', '2026-11-24 10:45:10', 'pl-004', NULL, '10.40.2.35', 72, 'HDMI handshake negotiation failed', TRUE),
('DYPIU-TV-021', 'Hostel Block A Lobby', 'Student Hub', 'Ground Floor', 'Hostel Security Gate', 'OnePlus TV 55" 4K', '3840x2160', 'Android TV 11', 'v1.4.0', 'Offline', '2h ago', '2026-11-24 09:30:00', 'pl-003', NULL, '10.40.3.48', 95, 'Internal flash storage low (<5% available)', TRUE)
ON DUPLICATE KEY UPDATE `connection_status`=VALUES(`connection_status`);

-- Seed Screen Groups
INSERT INTO `screen_groups` (`id`, `name`, `building`, `floor`, `description`, `assigned_playlist_id`) VALUES
('grp-001', 'Main Campus Entrances', 'Building A', 'Ground Floor', 'Lobby foyer displays covering arriving students and visitors.', 'pl-001'),
('grp-002', 'Engineering Corridors', 'Building B', 'Ground Floor', 'Displays across engineering lecture halls and workshops.', 'pl-002'),
('grp-003', 'Student Hub & Cafeteria', 'Student Hub', 'Ground Floor', 'High-traffic social hubs and recreational concourses.', 'pl-003')
ON DUPLICATE KEY UPDATE `name`=VALUES(`name`);

-- Seed Screen Group Items
INSERT INTO `screen_group_items` (`group_id`, `screen_id`) VALUES
('grp-001', 'DYPIU-TV-001'),
('grp-001', 'DYPIU-TV-002'),
('grp-002', 'DYPIU-TV-004'),
('grp-002', 'DYPIU-TV-005'),
('grp-003', 'DYPIU-TV-006')
ON DUPLICATE KEY UPDATE `screen_id`=VALUES(`screen_id`);

-- Seed Campaigns
INSERT INTO `campaigns` (`id`, `name`, `description`, `playlist_id`, `start_date`, `end_date`, `start_time`, `end_time`, `status`, `priority`, `created_by`) VALUES
('cmp-001', 'Admissions 2026 Early Intake Drive', 'Primary prospective student welcome visual across entrance displays.', 'pl-001', '2026-11-20', '2026-12-15', '08:00', '20:00', 'Active', 'High', 'Vinod Kumar Jain'),
('cmp-002', 'Autonomous Robotics & AI Symposium', 'Showcase lab demonstrations and hackathon registrations.', 'pl-002', '2026-11-22', '2026-11-30', '08:30', '19:00', 'Active', 'Normal', 'Prof. Sunita Rao'),
('cmp-003', 'Aarohan 2026 Annual Cultural Night', 'Teaser loops and ticket reservation reminders on student displays.', 'pl-003', '2026-11-25', '2026-12-05', '09:00', '22:00', 'Scheduled', 'Urgent', 'Pooja Iyer')
ON DUPLICATE KEY UPDATE `name`=VALUES(`name`);

-- Seed Campaign Targets
INSERT INTO `campaign_targets` (`campaign_id`, `target_type`, `target_id`) VALUES
('cmp-001', 'screen', 'DYPIU-TV-001'),
('cmp-001', 'screen', 'DYPIU-TV-002'),
('cmp-001', 'screen', 'DYPIU-TV-003'),
('cmp-002', 'group', 'grp-002'),
('cmp-003', 'group', 'grp-003')
ON DUPLICATE KEY UPDATE `target_id`=VALUES(`target_id`);

-- Seed University Settings
INSERT INTO `university_settings` (`id`, `settings_json`) VALUES
(1, '{
  "universityName": "D.Y. Patil International University",
  "campusLocation": "Akurdi, Pune, Maharashtra 411044",
  "itDepartmentEmail": "signage-support@dypiu.ac.in",
  "supportPhone": "+91 20 2765 3055",
  "primaryColor": "#290044",
  "secondaryColor": "#500071",
  "accentColor": "#8A2A78",
  "creamColor": "#EEE3B0",
  "timezone": "Asia/Kolkata (IST +05:30)",
  "dateFormat": "YYYY-MM-DD",
  "defaultImageDurationSeconds": 10,
  "defaultTransition": "Fade",
  "maxUploadSizeMb": 100,
  "autoTranscodeVideo": true,
  "notifyOfflineMinutes": 10,
  "emailAlertsEnabled": true,
  "playbackFailureAlerts": true,
  "sessionTimeoutMinutes": 60,
  "require2FAForAdmins": false,
  "keycloakRealm": "dypiu-campus"
}')
ON DUPLICATE KEY UPDATE `settings_json`=VALUES(`settings_json`);
