-- MySQL dump 10.13  Distrib 8.0.34, for Win64 (x86_64)
--
-- Host: localhost    Database: seaportdb
-- ------------------------------------------------------
-- Server version	8.0.35

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
-- Table structure for table `berth_hire`
--

DROP TABLE IF EXISTS `berth_hire`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `berth_hire` (
  `vessel_type` varchar(50) NOT NULL,
  `coastal_rate` float DEFAULT NULL,
  `foreign_rate` float DEFAULT NULL,
  PRIMARY KEY (`vessel_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `berth_hire`
--

LOCK TABLES `berth_hire` WRITE;
/*!40000 ALTER TABLE `berth_hire` DISABLE KEYS */;
INSERT INTO `berth_hire` VALUES ('Bulk Cargo',0.0052,0.1364),('Container ',0.0047,0.124),('Others',0.0063,0.1636),('RoRo ',0.0056,0.1473),('Tankers',0.0068,0.1785);
/*!40000 ALTER TABLE `berth_hire` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `berth_master`
--

DROP TABLE IF EXISTS `berth_master`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `berth_master` (
  `Berth_ID` int DEFAULT NULL,
  `BerthName` text,
  `Liquid_Bulk` text,
  `Container` text,
  `POL` text,
  `Bulk` text,
  `RORO` text,
  `PassnCruise` text,
  `Bunker` text,
  `Rated_Cap` double DEFAULT NULL,
  `Desired_Cap` double DEFAULT NULL,
  `Draft` double DEFAULT NULL,
  `Quay_Len` double DEFAULT NULL,
  `Dock_Name` text,
  `Facility` text
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `berth_master`
--

LOCK TABLES `berth_master` WRITE;
/*!40000 ALTER TABLE `berth_master` DISABLE KEYS */;
INSERT INTO `berth_master` VALUES (1,'19A-NQ','yes',NULL,NULL,'yes',NULL,NULL,NULL,1,0.7,8.5,198,'DRAMBEDKAR DOCK','OPENPAVED'),(2,'18A-WQ-1','yes',NULL,NULL,'yes','yes',NULL,NULL,1.4,0.9,11,170.6,'DRAMBEDKAR DOCK','OPENPAVED'),(3,'17A-WQ-2','yes',NULL,NULL,'yes','yes',NULL,NULL,2.5,1,12,170.6,'DRAMBEDKAR DOCK','OPENPAVED'),(4,'16A-CB',NULL,NULL,NULL,'yes','yes','yes',NULL,2.2,1.5,12,170.6,'DRAMBEDKAR DOCK','TRANSITSHED'),(5,'15A-WQ-III',NULL,NULL,NULL,'yes','yes','yes',NULL,2.7,1.9,12,170.6,'DRAMBEDKAR DOCK','TRANSITSHED'),(6,'14A-WQ-IV',NULL,NULL,NULL,'yes','yes','yes',NULL,2.7,1.9,11,170.6,'DRAMBEDKAR DOCK','TRANSITSHED'),(7,'13A-SQ-I',NULL,NULL,NULL,'yes',NULL,NULL,NULL,2.6,1.8,9.5,246.6,'DRAMBEDKAR DOCK','OPENPAVED'),(8,'6A-SQ-II','yes',NULL,NULL,'yes',NULL,NULL,NULL,1.4,1,9.5,179,'DRAMBEDKAR DOCK','TANKFARMS'),(9,'12J-JD-1',NULL,NULL,NULL,'yes',NULL,NULL,NULL,4.2,2.9,12.5,218.33,'JAWAHAR DOCK','TRANSITSHED'),(10,'11J-JD-3',NULL,NULL,NULL,'yes',NULL,NULL,NULL,4.3,3,13,218.33,'JAWAHAR DOCK','TRANSITSHED'),(11,'10J-JD-5',NULL,NULL,NULL,'yes',NULL,NULL,NULL,3.1,2.2,13,218.33,'JAWAHAR DOCK','TRANSITSHED'),(12,'7J-JD-2','yes',NULL,NULL,'yes',NULL,NULL,NULL,4.8,3.1,14,218.33,'JAWAHAR DOCK','TANKFARMS'),(13,'8J-JD-4','yes',NULL,NULL,'yes',NULL,NULL,NULL,2,1.3,14,218.33,'JAWAHAR DOCK','TANKFARMS'),(14,'9J-JD-6','yes',NULL,NULL,'yes',NULL,NULL,NULL,3.3,2.3,12.5,218.33,'JAWAHAR DOCK','TANKFARMS'),(15,'26B-BD1',NULL,NULL,'yes',NULL,NULL,NULL,NULL,6.7,4.7,14.6,355.65,'BHARATHI DOCK','MLA'),(16,'24B-BD II','yes',NULL,'yes',NULL,NULL,NULL,NULL,2.8,1.6,16.5,382,'BHARATHI DOCK','OPENPAVED'),(17,'27B-BD III',NULL,NULL,'yes',NULL,NULL,NULL,NULL,25.7,18,16.5,307.1,'BHARATHI DOCK','MLA'),(18,'20B-CTB 1',NULL,'yes',NULL,NULL,NULL,NULL,NULL,8,6.5,13.4,200,'BHARATHI DOCK','CONTAINERBAY'),(19,'21B-CTB 2',NULL,'yes',NULL,NULL,NULL,NULL,NULL,8,6.5,13.4,200,'BHARATHI DOCK','CONTAINERBAY'),(20,'22B-CTB 3',NULL,'yes',NULL,NULL,NULL,NULL,NULL,8,6.5,13.4,200,'BHARATHI DOCK','CONTAINERBAY'),(21,'23B-CTB 4',NULL,'yes',NULL,NULL,NULL,NULL,NULL,8,7,13.4,285,'BHARATHI DOCK','CONTAINERBAY'),(22,'5A-SCB 1',NULL,'yes',NULL,NULL,NULL,NULL,NULL,6,5,15,275,'DRAMBEDKAR DOCK','CONTAINERBAY'),(23,'4A-SCB 2',NULL,'yes',NULL,NULL,NULL,NULL,NULL,6,5,15,270,'DRAMBEDKAR DOCK','CONTAINERBAY'),(24,'3A-SCB 3',NULL,'yes',NULL,NULL,NULL,NULL,NULL,6,5,15,287,'DRAMBEDKAR DOCK','CONTAINERBAY'),(25,'01B-CB 1',NULL,NULL,NULL,'yes',NULL,NULL,NULL,1,1,11,130,'BHARATHI DOCK','OPENPAVED'),(26,'02B-CB 2',NULL,NULL,NULL,'yes',NULL,NULL,NULL,1,0.7,10,130,'BHARATHI DOCK','OPENPAVED'),(27,'28B-BB',NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,0.9,9,180,'BHARATHI DOCK','TANKFARMS');
/*!40000 ALTER TABLE `berth_master` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `cargo_master`
--

DROP TABLE IF EXISTS `cargo_master`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `cargo_master` (
  `cargo_id` varchar(10) NOT NULL,
  `name` varchar(100) DEFAULT NULL,
  `hs_code` varchar(20) DEFAULT NULL,
  `cargo_type` varchar(50) DEFAULT NULL,
  `sor_item` varchar(10) DEFAULT NULL,
  `VSL_category` enum('Tankers','Container','RoRo','Bulk Cargo','Others') DEFAULT NULL,
  `IE_Type` enum('Import','Export','Both') DEFAULT NULL,
  `norms` float DEFAULT NULL,
  `norms_HMC` float DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `cargo_master`
--

LOCK TABLES `cargo_master` WRITE;
/*!40000 ALTER TABLE `cargo_master` DISABLE KEYS */;
INSERT INTO `cargo_master` VALUES ('C310221I','Ammonium Sulphate','310221','Dry Bulk','20','Bulk Cargo','Import',2000,8333),('C310420I','Muriate of Potash','310420','Dry Bulk','20','Bulk Cargo','Import',2000,8333),('C25102010I','Rock Phosphate','25102010','Dry Bulk','20','Bulk Cargo','Import',2000,8333),('C25030090I','Sulphur','25030090','Dry Bulk','20','Bulk Cargo','Import',1800,8333),('C310210I','Urea','310210','Dry Bulk','20','Bulk Cargo','Import',1400,8333),('C250510I','Silica Sand','250510','Dry Bulk','18','Bulk Cargo','Import',1400,8333),('C251810I','Dolomite','251810','Dry Bulk','28','Bulk Cargo','Import',4200,8333),('C252100I','Limestone','252100','Dry Bulk','28','Bulk Cargo','Import',3400,8333),('C260112I','Iron Ore Pellet','260112','Dry Bulk','27','Bulk Cargo','Import',3300,8333),('C252010I','Gypsum','252010','Dry Bulk','28','Bulk Cargo','Import',3000,8333),('C100590I','Food Grains','100590','Dry Bulk','16','Bulk Cargo','Import',1400,8333),('C720449I','Shredded Scrap','720449','Dry Bulk','25','Bulk Cargo','Import',1600,8333),('C720430I','Heavy Melting Scrap','720430','Dry Bulk','25','Bulk Cargo','Import',750,8333),('C100590E','Food grains (Maize, etc.)','100590','Dry Bulk','16','Bulk Cargo','Export',700,8333),('C251110E','Barytes','251110','Dry Bulk','28','Bulk Cargo','Export',3400,8333),('C251740E','Cobble Stones','251740','Dry Bulk','28','Bulk Cargo','Export',2400,8333),('C261900E','Mil Scale','261900','Dry Bulk','28','Bulk Cargo','Export',3500,8333),('C252310E','Cement Clinkers','252310','Dry Bulk','28','Bulk Cargo','Export',3700,8333),('C261800E','Ferro Slag','261800','Dry Bulk','16','Bulk Cargo','Export',3500,8333),('C730630I','Steel bar/tubes/ pipes','730630','Break Bulk','24','Bulk Cargo','Import',850,850),('C720917I','Steel CR Coil','720917','Break Bulk','24','Bulk Cargo','Import',1700,1700),('C720851I','Steel Plate','720851','Break Bulk','24','Bulk Cargo','Import',1400,1400),('C720711I','Steel Billet','720711','Break Bulk','24','Bulk Cargo','Import',850,850),('C720839I','HR Coil','720839','Break Bulk','24','Bulk Cargo','Import',2300,2300),('C842952I','Excavator','842952','Break Bulk','22','Bulk Cargo','Import',450,450),('C847989I','Machinery','847989','Break Bulk','23','Bulk Cargo','Import',450,450),('C850231I','Windmill','850231','Break Bulk','23','Bulk Cargo','Import',450,450),('C440399I','Logs','440399','Break Bulk','35','Bulk Cargo','Import',700,700),('C720711E','Steel Billet','720711','Break Bulk','24','Bulk Cargo','Export',1000,1000),('C730630E','Steel bar','730630','Break Bulk','24','Bulk Cargo','Export',1000,1000),('C730630E','Steel tubes','730630','Break Bulk','24','Bulk Cargo','Export',1000,1000),('C730630E','Steel pipes','730630','Break Bulk','24','Bulk Cargo','Export',1000,1000),('C720917E','Steel CR Coil','720917','Break Bulk','24','Bulk Cargo','Export',1200,1200),('C68022310E','Granite Block','68022310','Break Bulk','21','Bulk Cargo','Export',1000,1000),('C720839E','HR Coil','720839','Break Bulk','24','Bulk Cargo','Export',2300,2300),('C251110E','Barytes - J. Bags','251110','Break Bulk','28','Bulk Cargo','Export',1200,1200),('C842952E','Excavator','842952','Break Bulk','22','Bulk Cargo','Export',250,250),('C847989E','Machinery','847989','Break Bulk','23','Bulk Cargo','Export',250,250),('C850231E','Windmill','850231','Break Bulk','23','Bulk Cargo','Export',250,250);
/*!40000 ALTER TABLE `cargo_master` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `pilotage`
--

DROP TABLE IF EXISTS `pilotage`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `pilotage` (
  `ï»¿GT_Min` int DEFAULT NULL,
  `GT_Max` int DEFAULT NULL,
  `Tankers` double DEFAULT NULL,
  `Container` double DEFAULT NULL,
  `RoRo` double DEFAULT NULL,
  `Bulk` double DEFAULT NULL,
  `Other` double DEFAULT NULL,
  `Category` text
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `pilotage`
--

LOCK TABLES `pilotage` WRITE;
/*!40000 ALTER TABLE `pilotage` DISABLE KEYS */;
INSERT INTO `pilotage` VALUES (0,10000,0.6306,0.438,0.5203,0.4819,0.5781,'Foreign'),(10001,15000,0.7229,0.5021,0.5966,0.5524,0.6629,'Foreign'),(15001,30000,0.8325,0.5781,0.6869,0.6359,0.7632,'Foreign'),(30001,60000,1.183,0.8215,0.976,0.9036,1.0844,'Foreign'),(60001,999999,1.3693,0.9509,1.1296,1.046,1.2551,'Foreign'),(0,10000,16.6646,11.5726,13.7483,12.7299,15.2758,'Coastal'),(10001,15000,19.1213,13.2786,15.775,14.6066,17.5278,'Coastal'),(15001,30000,20.1612,15.2889,18.1632,16.8178,20.1813,'Coastal'),(30001,60000,31.2479,21.7,25.7795,23.87,28.6439,'Coastal'),(60001,999999,36.177,25.1229,29.846,27.6352,33.1622,'Coastal');
/*!40000 ALTER TABLE `pilotage` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `port_dues`
--

DROP TABLE IF EXISTS `port_dues`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `port_dues` (
  `vessel_type` varchar(50) NOT NULL,
  `coastal_rate` float DEFAULT NULL,
  `foreign_rate` float DEFAULT NULL,
  PRIMARY KEY (`vessel_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `port_dues`
--

LOCK TABLES `port_dues` WRITE;
/*!40000 ALTER TABLE `port_dues` DISABLE KEYS */;
INSERT INTO `port_dues` VALUES ('Bulk Cargo',9.646,0.3647),('Container ',8.7691,0.3315),('Others',11.5753,0.4376),('RoRo ',10.4178,0.3939),('Tankers',12.6276,0.4773);
/*!40000 ALTER TABLE `port_dues` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sor_master`
--

DROP TABLE IF EXISTS `sor_master`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sor_master` (
  `sor_item` varchar(10) NOT NULL,
  `Commodity_GenricName` varchar(50) DEFAULT NULL,
  `Cost_basis` varchar(25) DEFAULT NULL,
  `coastal_rate` double DEFAULT NULL,
  `L_Max` double DEFAULT NULL,
  `foreign_rate` double DEFAULT NULL,
  `F_Max` double DEFAULT NULL,
  `Trade_type` varchar(10) DEFAULT NULL,
  PRIMARY KEY (`sor_item`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sor_master`
--

LOCK TABLES `sor_master` WRITE;
/*!40000 ALTER TABLE `sor_master` DISABLE KEYS */;
INSERT INTO `sor_master` VALUES ('1','Acids of all kinds','Weight',143.44,NULL,86.07,NULL,'Both'),('10','Bunker oil for vessels','Weight',56.18,NULL,56.18,NULL,'Both'),('11','Edible oil of all kinds','Weight',132.22,NULL,79.33,NULL,'Both'),('12','Molasses','Weight',59.46,NULL,35.68,NULL,'Both'),('13','Sludge Oil / Waste Oil','Weight',81.4,NULL,81.4,NULL,'Both'),('14','Aircraft','Unit',203480,NULL,122088,NULL,'Both'),('15','Boats and launches','Unit',30522,NULL,18313,NULL,'Both'),('16','Cereals and pulses of all kinds','Weight',58.68,NULL,35.21,NULL,'Both'),('17','Coir, Coir products and Jute & Jute products','Weight',160.17,NULL,96.11,NULL,'Both'),('18','Building and Construction Materials','Weight',64.56,NULL,38.74,NULL,'Both'),('19','Defence stores','Weight',349.46,NULL,209.68,NULL,'Both'),('2','Chemicals of all kinds','Weight',198.21,NULL,118.93,NULL,'Both'),('20','Fertilizer ','Weight',58.68,NULL,35.21,NULL,'Both'),('21','Granite Blocks, Dressed marbles and slabs','Weight',381.43,NULL,228.83,NULL,'Both'),('22','Machineries and Equipment with Wheels','Value',0.425,149965,0.255,89979,'Both'),('23','Machineries and Equipment without Wheels','Value',0.425,NULL,0.255,NULL,'Both'),('24','Metal and Metal Products ','Weight',117.35,NULL,70.41,NULL,'Both'),('25','Metal scrap including shredded scrap','Weight',76.29,NULL,45.78,NULL,'Both'),('26-a','MVTwo wheelers-CargoPassenger','Unit',814,NULL,488,NULL,'Both'),('26-b','MVThree wheelers-CargoPassenger','Unit',2544,NULL,1526,NULL,'Both'),('26-c','MVFour wheelers-CargoPassenger','Value',0.5617,12047,0.3371,7228,'Both'),('26-d','MVSix wheelers and above -CargoPassenger','Value',0.425,43484,0.255,26090,'Both'),('27','Iron Ore Pellets','Weight',70.43,NULL,70.43,NULL,'Both'),('28-a','Ores and Minerals - Import','Weight',58.68,NULL,35.21,NULL,'Import'),('28-b','Ores and Minerals - Export','Weight',40.68,NULL,24.41,NULL,'Export'),('29','Provisions & Consumables for Passengers','Weight',87.03,NULL,52.22,NULL,'Both'),('3','Crude oil','Weight',89.2,NULL,89.2,NULL,'Both'),('30','Railway wagons & coaches','Unit',50870,NULL,30522,NULL,'Both'),('31','Locomotives','Unit',76305,NULL,45783,NULL,'Both'),('32','Salt of all kinds','Weight',33.47,NULL,20.08,NULL,'Both'),('33','Sugar of all kinds','Weight',73.64,NULL,44.19,NULL,'Both'),('34','Unaccompanied personal baggage','Unit',203.48,NULL,122.09,NULL,'Both'),('35','Timber logs','Weight',47.8,NULL,28.69,NULL,'Both'),('36','Wood and Wood-Based Products','Weight',80.08,NULL,48.06,NULL,'Both'),('37-a','OtherCargo-In Bulk','Weight',96.5,NULL,57.9,NULL,'Both'),('37-b','OtherCargo-Other than in Bulk','Value',0.425,NULL,0.255,NULL,'Both'),('4','Diesel oil','Weight',107.97,NULL,107.97,NULL,'Both'),('5','Furnace oil','Weight',95.46,NULL,95.46,NULL,'Both'),('6','Kerosene oil & Aviation Turbine Fuel (ATF)','Weight',114.23,NULL,114.23,NULL,'Both'),('7','Lubricants, Bitumen & Base oil','Weight',114.23,NULL,114.23,NULL,'Both'),('8','Naphtha','Weight',120.5,NULL,120.5,NULL,'Both'),('9','Petrol','Weight',126.75,NULL,126.75,NULL,'Both');
/*!40000 ALTER TABLE `sor_master` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `first_name` varchar(100) DEFAULT NULL,
  `last_name` varchar(100) DEFAULT NULL,
  `mobile` varchar(15) DEFAULT NULL,
  `email` varchar(100) DEFAULT NULL,
  `company` varchar(100) DEFAULT NULL,
  `password` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `mobile` (`mobile`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,'mk','kk','654','lkh','23','$2b$10$rEtp0VtiYp8Pbs1NkrafR.uUksIqQ/Pbg8ZQoCIJY/BbztqpTt7Fa'),(2,'swathi','m','25896','your@huy','55','$2b$10$KYDghshfBljQVVlrIvwY2.vJ7W1ENQ7WICvGK5ghDufHnA4KEGCry'),(3,'4','4','4','4@4.4','4','$2b$10$cpQUoUY3SxZXpQD43EKEIeP8ug2Fmfi26NZMrCoh8Phe0kBL/VLo2');
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping events for database 'seaportdb'
--

--
-- Dumping routines for database 'seaportdb'
--
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-08-08 19:56:48
