CREATE DATABASE IF NOT EXISTS meddata_hub; 
USE meddata_hub

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
  `password` VARCHAR(255) NOT NULL DEFAULT '123456',
  `gender` VARCHAR(10) NOT NULL,
  `age` INT NOT NULL,
  `phone` VARCHAR(20) NULL,
  `address` VARCHAR(255) NULL,
  `create_time` DATE NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `id_UNIQUE` (`id` ASC) VISIBLE);

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

  CREATE TABLE `meddata_hub`.`multimodal_data` (
    `id` VARCHAR(50) PRIMARY KEY,          -- 多模态记录的 ID，如 'img_1'
    `patient_id` VARCHAR(50) NULL,         -- 预留，之后可以填 patients.id
    `record_id` VARCHAR(50) NULL,         -- 预留，之后可以填 medical_records.id
    `source_table` VARCHAR(100) NOT NULL,  -- 来源类型：Document / MedicalImage / AudioRecord 等
    `source_pk` VARCHAR(50) NOT NULL,     -- 来源里的“主键”或标识，例如 AdmissionRecord1
    `modality` ENUM('text','image','audio','video','pdf','timeseries','other') NOT NULL, -- 文件类型
    `text_content` LONGTEXT NULL,          -- 纯文本内容（如果是 text 模态）
    `file_path` VARCHAR(255) NULL,         -- 文件相对路径，如 medicaldata/Document/AdmissionRecord1.pdf
    `file_format` VARCHAR(20) NULL,        -- 文件格式：pdf / jpg / mp3 / mp4 / csv 等
    `description` TEXT NULL,               -- 描述信息
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_patient` (`patient_id`),    -- 索引：病人的 ID
    INDEX `idx_modality` (`modality`)     -- 索引：文件类型
    );


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

-- 外键关联 patients 表
ALTER TABLE `meddata_hub`.`multimodal_data`
ADD CONSTRAINT `fk_multimodal_patient`
    FOREIGN KEY (`patient_id`)
    REFERENCES `meddata_hub`.`patients` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;

-- 外键关联 medical_records 表
ALTER TABLE `meddata_hub`.`multimodal_data`
ADD CONSTRAINT `fk_multimodal_record`
    FOREIGN KEY (`record_id`)
    REFERENCES `meddata_hub`.`medical_records` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;


