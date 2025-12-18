import mysql.connector
from mysql.connector import Error

# 数据库连接配置
db_config = {
    'host': 'localhost',        # 数据库地址
    'user': 'root',    # 数据库用户名
    'password': 'root',# 数据库密码
    'database': 'meddata_hub'   # 数据库名称
}

# 插入数据的 SQL 语句
insert_sqls = [
    # Document - 文档（pdf）
    "INSERT INTO multimodal_data (id, source_table, source_pk, modality, file_path, file_format, description) VALUES"
    "('doc_admission_1', 'Document', 'AdmissionRecord1', 'pdf', 'uploaded_files/medicaldata/Document/AdmissionRecord1.pdf', 'pdf', '入院记录 PDF 示例'),"
    "('doc_discharge_1', 'Document', 'DischargeSummary1', 'pdf', 'uploaded_files/medicaldata/Document/DischargeSummary1.pdf', 'pdf', '出院小结 PDF 示例'),"
    "('doc_treat_1', 'Document', 'TreatmentPlan1', 'pdf', 'uploaded_files/medicaldata/Document/TreatmentPlan1.pdf', 'pdf', '治疗方案 PDF 示例');",

    # MedicalRecord - 诊断结果、处方（pdf）
    "INSERT INTO multimodal_data (id, source_table, source_pk, modality, file_path, file_format, description) VALUES"
    "('mr_diag_1', 'MedicalRecord', 'DiagnosisResult1', 'pdf', 'uploaded_files/medicaldata/MedicalRecord/DiagnosisResult1.pdf', 'pdf', '诊断结果 PDF 示例'),"
    "('mr_pres_1', 'MedicalRecord', 'Prescription1', 'pdf', 'uploaded_files/medicaldata/MedicalRecord/Prescription1.pdf', 'pdf', '处方单 PDF 示例');",

    # MedicalImage - 医学影像（image）
    "INSERT INTO multimodal_data (id, source_table, source_pk, modality, file_path, file_format, description) VALUES"
    "('img_ct_1', 'MedicalImage', 'CTImage1', 'image', 'uploaded_files/medicaldata/MedicalImage/CTImage1.jpg', 'jpg', 'CT 影像示例'),"
    "('img_mri_1', 'MedicalImage', 'MRIImage1', 'image', 'uploaded_files/medicaldata/MedicalImage/MRIImage1.bmp', 'bmp', 'MRI 影像示例'),"
    "('img_ultra_1', 'MedicalImage', 'UltrasoundImage1', 'image', 'uploaded_files/medicaldata/MedicalImage/UltrasoundImage1.png', 'png', '超声影像示例');",

    # AudioRecord - 音频（audio）
    "INSERT INTO multimodal_data (id, source_table, source_pk, modality, file_path, file_format, description) VALUES"
    "('audio_counsel_1', 'AudioRecord', 'Counseling', 'audio', 'uploaded_files/medicaldata/AudioRecord/心理咨询录音.mp3', 'mp3', '心理咨询录音示例'),"
    "('audio_postop_1', 'AudioRecord', 'PostOpCare', 'audio', 'uploaded_files/medicaldata/AudioRecord/术后护理录音.mp3', 'mp3', '术后护理录音示例'),"
    "('audio_change_1', 'AudioRecord', 'ConditionChange', 'audio', 'uploaded_files/medicaldata/AudioRecord/病情变化通知录音.mp3', 'mp3', '病情变化通知录音示例');",

    # StandardVideo - 视频（video）
    "INSERT INTO multimodal_data (id, source_table, source_pk, modality, file_path, file_format, description) VALUES"
    "('video_emergency_1', 'StandardVideo', 'EmergencyProcedure', 'video', 'uploaded_files/medicaldata/StandardVideo/应急处理标准视频.mp4', 'mp4', '应急处理标准视频示例'),"
    "('video_surgery_1', 'StandardVideo', 'SurgicalProcedure', 'video', 'uploaded_files/medicaldata/StandardVideo/手术流程视频.mp4', 'mp4', '手术流程视频示例'),"
    "('video_nursing_1', 'StandardVideo', 'NursingStandard', 'video', 'uploaded_files/medicaldata/StandardVideo/护理操作标准视频.mp4', 'mp4', '护理操作标准视频示例');",

    # GenomicData - 基因数据（text + image）
    "INSERT INTO multimodal_data (id, source_table, source_pk, modality, file_path, file_format, description) VALUES"
    "('gene_seq_1', 'GenomicData', 'GeneSequence1', 'text', 'uploaded_files/medicaldata/GenomicData/GeneSequence1.fasta', 'fasta', '基因序列文件示例');",

    "INSERT INTO multimodal_data (id, source_table, source_pk, modality, file_path, file_format, description) VALUES"
    "('gene_img_1', 'GenomicData', 'AnalysisResult1', 'image', 'uploaded_files/medicaldata/GenomicData/AnalysisResult1.jpeg', 'jpeg', '基因分析结果图示例');",

    # DeviceData - 设备数据（pdf）
    "INSERT INTO multimodal_data (id, source_table, source_pk, modality, file_path, file_format, description) VALUES"
    "('device_pdf_1', 'DeviceData', 'DataContent1', 'pdf', 'uploaded_files/medicaldata/DeviceData/DataContent1.pdf', 'pdf', '设备数据 PDF 示例');",
    # TimeSeries - 时间序列 CSV + 预测结果图片（timeseries + image）
    "INSERT INTO multimodal_data (id, source_table, source_pk, modality, file_path, file_format, description) VALUES"
    "('ts_bp_1', 'BloodPressureCSV', 'patient_blood_pressure1', 'timeseries', 'uploaded_files/patient_blood_pressure/patient_blood_pressure1.csv', 'csv', '血压时间序列数据示例 1'),"
    "('ts_bp_2', 'BloodPressureCSV', 'patient_blood_pressure2', 'timeseries', 'uploaded_files/patient_blood_pressure/patient_blood_pressure2.csv', 'csv', '血压时间序列数据示例 2');",

    "INSERT INTO multimodal_data (id, source_table, source_pk, modality, file_path, file_format, description) VALUES"
    "('ts_bs_1', 'BloodSugarCSV', 'patient_blood_sugar1', 'timeseries', 'uploaded_files/patient_blood_sugar/patient_blood_sugar.csv1.csv', 'csv', '血糖时间序列数据示例 1');",
    "INSERT INTO multimodal_data (id, source_table, source_pk, modality, file_path, file_format, description) VALUES"
    "('ts_temp_1', 'TemperatureCSV', 'patient_temperature1', 'timeseries', 'uploaded_files/patient_temperature/patient_temperature1.csv', 'csv', '体温时间序列数据示例 1');"
]

# 清空表的数据
clear_sql = "DELETE FROM multimodal_data;"

# 插入数据的函数
def insert_multimodal_data():
    try:
        # 连接到数据库
        connection = mysql.connector.connect(**db_config)
        cursor = connection.cursor()

        # 清空表的数据
        cursor.execute(clear_sql)
        print("表数据已清空！")

        # 执行所有插入语句
        for sql in insert_sqls:
            cursor.execute(sql)

        # 提交事务
        connection.commit()
        print("数据插入成功！")

    except Error as e:
        print(f"数据库错误：{e}")
    finally:
        if connection.is_connected():
            cursor.close()
            connection.close()

if __name__ == "__main__":
    insert_multimodal_data()
