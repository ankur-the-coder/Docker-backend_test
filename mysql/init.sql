CREATE DATABASE IF NOT EXISTS benchmark_db;
USE benchmark_db;

DROP TABLE IF EXISTS users;

CREATE TABLE users (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_email (email)
);

DELIMITER $$

CREATE PROCEDURE seed_users()
BEGIN
  DECLARE i INT DEFAULT 1;
  WHILE i <= 10000 DO
    INSERT INTO users (name, email)
    VALUES (
      CONCAT('user_', i),
      CONCAT('user_', i, '@test.com')
    );
    SET i = i + 1;
  END WHILE;
END$$

DELIMITER ;

CALL seed_users();
DROP PROCEDURE seed_users;
