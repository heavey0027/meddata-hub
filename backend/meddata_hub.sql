CREATE schema `meddata_hub` ;

CREATE TABLE `meddata_hub`.`departments` (
  `id` VARCHAR(50) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `location` VARCHAR(100) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `id_UNIQUE` (`id` ASC) VISIBLE,
  UNIQUE INDEX `name_UNIQUE` (`name` ASC) VISIBLE);

CREATE TABLE `meddata_hub`.`doctors` (
  `id` VARCHAR(50) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `password` VARCHAR(255) NOT NULL DEFAULT '123456',
  `title` VARCHAR(50) NOT NULL,
  `specialty` VARCHAR(100) NOT NULL,
  `phone` VARCHAR(20) NOT NULL,
  `department_id` VARCHAR(50) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `id_UNIQUE` (`id` ASC) VISIBLE);
  
  CREATE TABLE `meddata_hub`.`medicines` (
  `id` VARCHAR(50) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `price` DECIMAL(10,2) NOT NULL,
  `stock` INT NOT NULL,
  `specification` VARCHAR(100) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `id_UNIQUE` (`id` ASC) VISIBLE);

CREATE TABLE `meddata_hub`.`patients` (
  `id` VARCHAR(50) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `password` VARCHAR(255) NOT NULL,
  `gender` VARCHAR(10) NOT NULL,
  `age` INT NOT NULL,
  `phone` VARCHAR(20) NULL,
  `address` VARCHAR(255) NULL,
  `create_time` DATE NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `id_UNIQUE` (`id` ASC) VISIBLE);

ALTER TABLE `meddata_hub`.`patients`
CHANGE COLUMN `password` `password` VARCHAR(255) NOT NULL DEFAULT '123456' ;

CREATE TABLE `meddata_hub`.`medical_records` (
  `id` VARCHAR(50) NOT NULL,
  `patient_id` VARCHAR(50) NOT NULL,
  `doctor_id` VARCHAR(50) NOT NULL,
  `diagnosis` TEXT(1024) NOT NULL,
  `treatment_plan` TEXT(1024) NOT NULL,
  `visit_date` DATE NOT NULL,
  PRIMARY KEY (`id`));

CREATE TABLE `meddata_hub`.`prescription_details` (
  `id` VARCHAR(50) NOT NULL,
  `record_id` VARCHAR(50) NOT NULL,
  `medicine_id` VARCHAR(50) NOT NULL,
  `dosage` VARCHAR(100) NOT NULL,
  `usage_info` VARCHAR(100) NOT NULL,
  `days` INT NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `id_UNIQUE` (`id` ASC) VISIBLE);

  CREATE TABLE `meddata_hub`.`appointments` (
  `id` VARCHAR(50) NOT NULL,
  `patient_id` VARCHAR(45) NOT NULL,
  `department_id` VARCHAR(50) NOT NULL,
  `doctor_id` VARCHAR(50) NOT NULL,
  `description` TEXT(1024) NOT NULL,
  `status` VARCHAR(20) NOT NULL,
  `create_time` VARCHAR(50) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `id_UNIQUE` (`id` ASC) VISIBLE);

-- 医生表关联科室
ALTER TABLE `meddata_hub`.`doctors` 
ADD CONSTRAINT `fk_doctor_dept`
  FOREIGN KEY (`department_id`)
  REFERENCES `meddata_hub`.`departments` (`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- 挂号表关联
ALTER TABLE `meddata_hub`.`appointments` 
ADD CONSTRAINT `fk_appt_patient`
  FOREIGN KEY (`patient_id`)
  REFERENCES `meddata_hub`.`patients` (`id`),
ADD CONSTRAINT `fk_appt_doctor`
  FOREIGN KEY (`doctor_id`)
  REFERENCES `meddata_hub`.`doctors` (`id`),
ADD CONSTRAINT `fk_appt_dept`
  FOREIGN KEY (`department_id`)
  REFERENCES `meddata_hub`.`departments` (`id`);

-- 病历表关联
ALTER TABLE `meddata_hub`.`medical_records` 
ADD CONSTRAINT `fk_record_patient`
  FOREIGN KEY (`patient_id`)
  REFERENCES `meddata_hub`.`patients` (`id`),
ADD CONSTRAINT `fk_record_doctor`
  FOREIGN KEY (`doctor_id`)
  REFERENCES `meddata_hub`.`doctors` (`id`);

-- 处方明细关联
ALTER TABLE `meddata_hub`.`prescription_details` 
ADD CONSTRAINT `fk_detail_record`
  FOREIGN KEY (`record_id`)
  REFERENCES `meddata_hub`.`medical_records` (`id`)
  ON DELETE CASCADE, -- 删除病历时，自动删除处方详情
ADD CONSTRAINT `fk_detail_medicine`
  FOREIGN KEY (`medicine_id`)
  REFERENCES `meddata_hub`.`medicines` (`id`);



