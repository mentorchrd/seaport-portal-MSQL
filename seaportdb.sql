SELECT * FROM seaportdb.users;
CREATE TABLE cargo_master (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100),
  hs_code VARCHAR(20),
  cargo_type VARCHAR(50),
  sor_item INT,
  category ENUM('Break Bulk', 'Dry Bulk', 'Liquid Bulk', 'Containers'),
  norms FLOAT
);
CREATE TABLE sor_master (
  id INT PRIMARY KEY,
  value_based FLOAT,
  weight_based FLOAT,
  coastal_rate FLOAT,
  foreign_rate FLOAT
);
CREATE TABLE berth_master (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100),
  draft FLOAT,
  cargo_type VARCHAR(50),
  transit_shed BOOLEAN,
  warehouse BOOLEAN,
  tank_farm BOOLEAN,
  railway_siding BOOLEAN
);
CREATE TABLE port_dues (
  vessel_type VARCHAR(50) PRIMARY KEY,
  coastal_rate FLOAT,
  foreign_rate FLOAT
);
CREATE TABLE pilotage (
  vessel_type VARCHAR(50),
  gt_min INT,
  gt_max INT,
  coastal_rate FLOAT,
  foreign_rate FLOAT
);
CREATE TABLE berth_hire (
  vessel_type VARCHAR(50) PRIMARY KEY,
  coastal_rate FLOAT,
  foreign_rate FLOAT
);
select * from berth_hire;
select * from pilotage;
select * from port_dues;
select * from berth_master;
select * from sor_master;
ALTER TABLE sor_master CHANGE id sor_item INT PRIMARY KEY;
select * from sor_master;
ALTER TABLE sor_master CHANGE id sor_item INT;
ALTER TABLE cargo_master
ADD CONSTRAINT fk_sor_item
FOREIGN KEY (sor_item)
REFERENCES sor_master(sor_item);
select * from cargo_master;
desc cargo_master;
ALTER TABLE cargo_master ADD norms_HMC FLOAT AFTER norms;
ALTER TABLE cargo_master CHANGE id cargo_id;
ALTER TABLE cargo_master CHANGE id cargo_id INT AUTO_INCREMENT;
select * from cargo_master;
ALTER TABLE cargo_master CHANGE category VSL_category;

desc cargo_master;
ALTER TABLE cargo_master
ADD IE_Type ENUM('Import', 'Export', 'Both') AFTER category;
ALTER TABLE cargo_master CHANGE category VSL_category;
ALTER TABLE cargo_master
CHANGE category VSL_category ENUM('Break Bulk', 'Dry Bulk', 'Liquid Bulk', 'Containers');
ALTER TABLE cargo_master
MODIFY VSL_category ENUM('Tankers', 'Container', 'RoRo', 'Bulk Cargo', 'Others');
alter table sor_master change id sor_item;
ALTER TABLE sor_master CHANGE id sor_item INT;
ALTER TABLE sor_master
ADD COLUMN Commondity_GenricName VARCHAR(255)
AFTER sor_item;
select * from sor_master;
alter table sor_master
COLUMN Cost_basis AFTER Commondity_GenricName;
ALTER TABLE sor_master
DROP COLUMN value_based,
DROP COLUMN weight_based,
ADD COLUMN Cost_basis VARCHAR(100) AFTER sor_item;
UPDATE table sor_master
COLUMN Cost_basis AFTER Commondity_GenricName;
ALTER TABLE sor_master
desc table sor_master;
MODIFY COLUMN Cost_basis VARCHAR(100) AFTER Commondity_GenricName;
ALTER TABLE sor_master
ADD COLUMN Trade_type VARCHAR(255) after foreign_rate;
alter table sor_master
add column L_Max int after coastal_rate,
add column F_Max int after foreign_rate;
ALTER TABLE sor_master
CHANGE COLUMN Commondity_GenricName Commodity_GenricName VARCHAR(100);
desc table sor_master;
desc sor_master;
ALTER TABLE sor_master
MODIFY COLUMN sor_item VARCHAR(50);
select * from cargo_master;
desc cargo_master;
alter cargo_master
select * from cargo_master;
update cargo_master
ALTER TABLE cargo_master
MODIFY COLUMN cargo_id INT;
ALTER TABLE cargo_master MODIFY COLUMN cargo_id VARCHAR(10);
ALTER TABLE cargo_master MODIFY COLUMN sor_item VARCHAR(10);
select * from berth_hire;
alter table cargo_master drop primary key;
select * from cargo_master;
select * from pilotage;
drop table pilotage;
desc cargo_master;
delete from cargo_master;
select * from berth_master;
drop table berth_master;
