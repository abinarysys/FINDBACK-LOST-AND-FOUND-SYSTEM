-- Run ONCE in your findback_db database (MySQL Workbench / phpMyAdmin / CLI).
-- It only ADDS a table. It does not change or delete any existing data.

CREATE TABLE IF NOT EXISTS `admin_activity_logs` (
  `log_id`      int          NOT NULL AUTO_INCREMENT,
  `admin_id`    int          NOT NULL,
  `action`      varchar(50)  NOT NULL,
  `target_type` varchar(30)  DEFAULT NULL,
  `target_id`   int          DEFAULT NULL,
  `details`     varchar(255) DEFAULT NULL,
  `ip_address`  varchar(45)  DEFAULT NULL,
  `created_at`  timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`log_id`),
  KEY `idx_admin`   (`admin_id`),
  KEY `idx_action`  (`action`),
  KEY `idx_created` (`created_at`),
  CONSTRAINT `fk_admin_logs_user` FOREIGN KEY (`admin_id`)
    REFERENCES `users` (`user_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
