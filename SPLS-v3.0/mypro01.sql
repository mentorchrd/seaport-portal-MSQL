create database seaportdb;
use seaportdb;
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  mobile VARCHAR(15) UNIQUE,
  email VARCHAR(100),
  company VARCHAR(100),
  password VARCHAR(255)
);

