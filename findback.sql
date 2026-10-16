-- MySQL dump 10.13  Distrib 8.0.43, for Win64 (x86_64)
--
-- Host: localhost    Database: findback_db
-- ------------------------------------------------------
-- Server version	8.0.43

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `claims`
--

DROP TABLE IF EXISTS `claims`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `claims` (
  `claim_id` int NOT NULL AUTO_INCREMENT,
  `found_item_id` int NOT NULL,
  `user_id` int NOT NULL,
  `claim_details` text,
  `status` varchar(30) DEFAULT 'pending',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`claim_id`),
  KEY `found_item_id` (`found_item_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `claims_ibfk_1` FOREIGN KEY (`found_item_id`) REFERENCES `found_items` (`found_item_id`),
  CONSTRAINT `claims_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `claims`
--

LOCK TABLES `claims` WRITE;
/*!40000 ALTER TABLE `claims` DISABLE KEYS */;
/*!40000 ALTER TABLE `claims` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `conversation_participants`
--

DROP TABLE IF EXISTS `conversation_participants`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `conversation_participants` (
  `conversation_id` int NOT NULL,
  `user_id` int NOT NULL,
  `joined_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`conversation_id`,`user_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `conversation_participants_ibfk_1` FOREIGN KEY (`conversation_id`) REFERENCES `conversations` (`conversation_id`),
  CONSTRAINT `conversation_participants_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `conversation_participants`
--

LOCK TABLES `conversation_participants` WRITE;
/*!40000 ALTER TABLE `conversation_participants` DISABLE KEYS */;
/*!40000 ALTER TABLE `conversation_participants` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `conversations`
--

DROP TABLE IF EXISTS `conversations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `conversations` (
  `conversation_id` int NOT NULL AUTO_INCREMENT,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`conversation_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `conversations`
--

LOCK TABLES `conversations` WRITE;
/*!40000 ALTER TABLE `conversations` DISABLE KEYS */;
/*!40000 ALTER TABLE `conversations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `feedback`
--

DROP TABLE IF EXISTS `feedback`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `feedback` (
  `feedback_id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `rating` int NOT NULL,
  `message` text NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`feedback_id`),
  KEY `fk_feedback_user` (`user_id`),
  CONSTRAINT `fk_feedback_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `feedback`
--

LOCK TABLES `feedback` WRITE;
/*!40000 ALTER TABLE `feedback` DISABLE KEYS */;
INSERT INTO `feedback` VALUES (1,3,4,'good','2026-10-13 13:21:20'),(2,3,4,'good','2026-10-13 13:27:01'),(3,3,3,'bad','2026-10-13 13:27:34'),(4,3,1,'need design','2026-10-14 06:30:56');
/*!40000 ALTER TABLE `feedback` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `found_items`
--

DROP TABLE IF EXISTS `found_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `found_items` (
  `found_item_id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `category_id` int DEFAULT NULL,
  `item_name` varchar(100) NOT NULL,
  `description` text,
  `location` varchar(255) DEFAULT NULL,
  `date_found` date DEFAULT NULL,
  `status` varchar(30) DEFAULT 'available',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `photo_path` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`found_item_id`),
  KEY `user_id` (`user_id`),
  KEY `category_id` (`category_id`),
  CONSTRAINT `found_items_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`),
  CONSTRAINT `found_items_ibfk_2` FOREIGN KEY (`category_id`) REFERENCES `item_categories` (`category_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `found_items`
--

LOCK TABLES `found_items` WRITE;
/*!40000 ALTER TABLE `found_items` DISABLE KEYS */;
/*!40000 ALTER TABLE `found_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `item_categories`
--

DROP TABLE IF EXISTS `item_categories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `item_categories` (
  `category_id` int NOT NULL AUTO_INCREMENT,
  `category_name` varchar(50) NOT NULL,
  `category_icon` varchar(255) NOT NULL,
  PRIMARY KEY (`category_id`),
  UNIQUE KEY `category_name` (`category_name`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `item_categories`
--

LOCK TABLES `item_categories` WRITE;
/*!40000 ALTER TABLE `item_categories` DISABLE KEYS */;
INSERT INTO `item_categories` VALUES (1,'Electronics','/img/categories/electronics.png'),(2,'Bags','/img/categories/bags.png'),(3,'IDs & Cards','img/categories/idandcard.png'),(4,'Keys','/img/categories/keys.png'),(5,'Clothing','/img/categories/clothing.png'),(6,'Wallets','/img/categories/wallets.png'),(7,'Others','/img/categories/others.png');
/*!40000 ALTER TABLE `item_categories` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `item_images`
--

DROP TABLE IF EXISTS `item_images`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `item_images` (
  `image_id` int NOT NULL AUTO_INCREMENT,
  `lost_item_id` int DEFAULT NULL,
  `found_item_id` int DEFAULT NULL,
  `image_path` varchar(255) NOT NULL,
  PRIMARY KEY (`image_id`),
  KEY `lost_item_id` (`lost_item_id`),
  KEY `found_item_id` (`found_item_id`),
  CONSTRAINT `item_images_ibfk_1` FOREIGN KEY (`lost_item_id`) REFERENCES `lost_items` (`lost_item_id`),
  CONSTRAINT `item_images_ibfk_2` FOREIGN KEY (`found_item_id`) REFERENCES `found_items` (`found_item_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `item_images`
--

LOCK TABLES `item_images` WRITE;
/*!40000 ALTER TABLE `item_images` DISABLE KEYS */;
/*!40000 ALTER TABLE `item_images` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `lost_items`
--

DROP TABLE IF EXISTS `lost_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `lost_items` (
  `lost_item_id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `category_id` int DEFAULT NULL,
  `item_name` varchar(100) NOT NULL,
  `description` text,
  `location` varchar(255) DEFAULT NULL,
  `date_lost` date DEFAULT NULL,
  `status` varchar(30) DEFAULT 'lost',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `photo_path` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`lost_item_id`),
  KEY `user_id` (`user_id`),
  KEY `category_id` (`category_id`),
  CONSTRAINT `lost_items_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`),
  CONSTRAINT `lost_items_ibfk_2` FOREIGN KEY (`category_id`) REFERENCES `item_categories` (`category_id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `lost_items`
--

LOCK TABLES `lost_items` WRITE;
/*!40000 ALTER TABLE `lost_items` DISABLE KEYS */;
INSERT INTO `lost_items` VALUES (2,3,1,'iphone 18 duo','rge','phinma ui comlab 3 3rd row left side near the aircon','2026-10-13','lost','2026-10-14 07:35:25','/uploads1791963325020-images.jpg'),(3,3,2,'makeup pouch','idiefbwdi','ml403','2026-10-14','lost','2026-10-14 07:37:58','/uploads1791963477965-pouch.jpg');
/*!40000 ALTER TABLE `lost_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `messages`
--

DROP TABLE IF EXISTS `messages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `messages` (
  `message_id` int NOT NULL AUTO_INCREMENT,
  `conversation_id` int NOT NULL,
  `sender_id` int NOT NULL,
  `message_text` text NOT NULL,
  `sent_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`message_id`),
  KEY `conversation_id` (`conversation_id`),
  KEY `sender_id` (`sender_id`),
  CONSTRAINT `messages_ibfk_1` FOREIGN KEY (`conversation_id`) REFERENCES `conversations` (`conversation_id`),
  CONSTRAINT `messages_ibfk_2` FOREIGN KEY (`sender_id`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `messages`
--

LOCK TABLES `messages` WRITE;
/*!40000 ALTER TABLE `messages` DISABLE KEYS */;
/*!40000 ALTER TABLE `messages` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `user_id` int NOT NULL AUTO_INCREMENT,
  `full_name` varchar(100) NOT NULL,
  `email` varchar(100) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `role` enum('admin','user') DEFAULT 'user',
  `profile_image` varchar(255) DEFAULT NULL,
  `account_status` varchar(20) DEFAULT 'active',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `contact_number` varchar(11) DEFAULT NULL,
  PRIMARY KEY (`user_id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (3,'Omi Pangiters','omipangitsomuch@gmail.com','1e5ac8889a7c98edee709ecb2ad8e5b01f9044c5b67bfbc499c9acc6b1efe94d','user','/uploads/1791891302146-5edf02cc1f0adaa3aab8e907890a5cb3.jpg','active','2026-10-13 11:39:39','09123456789'),(4,'Abegail Lesley Joplo','alj@email.com','4346fcaf120e15f3d0248c92489e5a3e6f20027f6e387aba1f386c66e33d69cc','user','/uploads/1791969238573-anya.jpg','active','2026-10-14 09:13:58','09291559475');
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping routines for database 'findback_db'
--
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;


-- ------------------------------------------------------
-- Update: user verification status
-- Added on 2026-10-16
-- ------------------------------------------------------

ALTER TABLE `users`
  ADD COLUMN `verification_status`
  ENUM('pending', 'verified', 'rejected')
  NOT NULL DEFAULT 'pending';

UPDATE `users`
SET `verification_status` = 'verified'
WHERE `role` = 'admin';

-- Dump completed on 2026-10-14 17:51:39
