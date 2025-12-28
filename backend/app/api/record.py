# --- START OF FILE app/api/record.py ---
from flask import Blueprint, request, jsonify
from app.utils.db import get_db_connection
import logging
from app.utils.common import format_date
from datetime import date

record_bp = Blueprint('record', __name__)
logger = logging.getLogger(__name__)

# 获取所有（或某个患者）病历
@record_bp.route('/api/records', methods=['GET'])
def get_records():
    conn = None
    cursor = None
    try:
        # 记录请求日志
        logger.info("Request to get medical records.")

        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # 获取查询参数
        patient_id = request.args.get('patient_id')  

        # 基本查询 SQL，关联患者和医生
        sql = """
            SELECT 
                r.id, r.patient_id, p.name AS patient_name, 
                r.doctor_id, d.name AS doctor_name, 
                r.diagnosis, r.treatment_plan, r.visit_date 
            FROM medical_records r
            LEFT JOIN patients p ON r.patient_id = p.id
            LEFT JOIN doctors d ON r.doctor_id = d.id
        """

        # 若有 patient_id 参数，限制查询该患者的记录
        if patient_id:
            sql += " WHERE r.patient_id = %s"
            cursor.execute(sql, (patient_id,))
        else:
            cursor.execute(sql)

        rows = cursor.fetchall()

        # 记录查询日志
        logger.info("Fetched %d medical records from the database.", len(rows))

        # 映射为前端驼峰命名
        data = []
        for row in rows:
            data.append({
                "id": row['id'],
                "patientId": row['patient_id'],
                "patientName": row['patient_name'],
                "doctorId": row['doctor_id'],
                "doctorName": row['doctor_name'],
                "diagnosis": row['diagnosis'],
                "treatmentPlan": row['treatment_plan'],
                "visitDate": format_date(row['visit_date'])
            })
        return jsonify(data)
    except Exception as e:
        # 记录异常日志
        logger.error("Error occurred while fetching medical records: %s", str(e))
        return jsonify({"error": str(e)}), 500
    finally:
        if cursor: cursor.close()
        if conn: conn.close()
        logger.info("Database connection closed.")

# 获取所有（或某个病历）处方细则
@record_bp.route('/api/prescription_details', methods=['GET'])
def get_prescription_details():
    conn = None
    cursor = None
    try:
        # 记录请求日志
        logger.info("Request to get prescription details.")

        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # 获取查询参数
        record_id = request.args.get('record_id') 

        # 基本查询 SQL
        sql = """
            SELECT id, record_id, medicine_id, dosage, usage_info, days 
            FROM prescription_details
        """

        # 若有 record_id 参数，限制查询该处方的细则
        if record_id:
            sql += " WHERE record_id = %s"
            cursor.execute(sql, (record_id,))
        else:
            cursor.execute(sql)

        rows = cursor.fetchall()

        # 记录查询日志
        logger.info("Fetched %d prescription details from the database.", len(rows))

        # 映射 usage_info -> usage
        data = []
        for row in rows:
            data.append({
                "id": row['id'],
                "recordId": row['record_id'],
                "medicineId": row['medicine_id'],
                "dosage": row['dosage'],
                "usage": row['usage_info'],
                "days": row['days']
            })

        return jsonify(data)

    except Exception as e:
        logger.error("Error occurred while fetching prescription details: %s", str(e))
        return jsonify({"error": str(e)}), 500

    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()
        logger.info("Database connection closed.")

# 提交病历
@record_bp.route('/api/records', methods=['POST'])
def create_record():
    data = request.json
    record_data = data.get('record')
    details_list = data.get('details', [])

    logger.info("Received data to create a new medical record: %s", record_data)
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        # 开启事务 
        conn.start_transaction()
        cursor = conn.cursor()

        # 插入主表
        sql_record = """
            INSERT INTO medical_records 
            (id, patient_id, doctor_id, diagnosis, treatment_plan, visit_date)
            VALUES (%s, %s, %s, %s, %s, %s)
        """
        cursor.execute(sql_record, (
            record_data.get('id'),
            record_data.get('patientId'),
            record_data.get('doctorId'),
            record_data.get('diagnosis'),
            record_data.get('treatmentPlan'),
            record_data.get('visitDate')
        ))
        logger.info("Medical record ID %s created successfully.", record_data.get('id'))

        # 循环插入子表
        sql_detail = """
            INSERT INTO prescription_details 
            (id, record_id, medicine_id, dosage, usage_info, days)
            VALUES (%s, %s, %s, %s, %s, %s)
        """

        for detail in details_list:
            # 【高级查询】：嵌套查询校验库存
            # 如果请求的药在数据库中不存在或库存为0，则报错
            cursor.execute("SELECT stock FROM medicines WHERE id = %s", (detail['medicineId'],))
            res = cursor.fetchone()

            if not res:
                logger.error("Medicine ID %s does not exist.", detail['medicineId'])
                raise Exception(f"药品ID {detail['medicineId']} 不存在")

            # 计算扣除的库存数量
            stock = res[0]
            days = detail.get('days')
            if stock <= 0:
                logger.warning("Medicine ID %s has insufficient stock.", detail['medicineId'])
                raise Exception(f"药品ID {detail['medicineId']} 库存不足")

            # 简化为按天数扣除
            if stock < days:
                logger.warning("Not enough stock for Medicine ID %s, available stock: %d, requested days: %d",
                               detail['medicineId'], stock, days)
                raise Exception(f"药品ID {detail['medicineId']} 库存不足，无法满足 {days} 天的需求")

            # 更新库存：扣除天数数量
            new_stock = stock - days
            cursor.execute("UPDATE medicines SET stock = %s WHERE id = %s", (new_stock, detail['medicineId']))
            logger.info("Stock updated for Medicine ID %s. New stock: %d", detail['medicineId'], new_stock)

            cursor.execute(sql_detail, (
                detail.get('id'),
                record_data.get('id'),
                detail.get('medicineId'),
                detail.get('dosage'),
                detail.get('usage'),
                detail.get('days')
            ))
            logger.info("Prescription detail for Medicine ID %s inserted successfully.", detail['medicineId'])

        # 提交事务
        conn.commit()
        logger.info("Medical record and prescription details committed successfully.")
        return jsonify({"success": True, "message": "病历提交成功"})

    except Exception as e:
        # 发生任何错误，立即回滚
        if conn: conn.rollback()
        logger.error("Error creating medical record: %s", str(e))
        return jsonify({"success": False, "message": "提交失败: " + str(e)}), 500

    finally:
        if cursor: cursor.close()
        if conn: conn.close()
        logger.info("Database connection closed.")
    
# 删除病历：级联删除处方明细
@record_bp.route('/api/records/<string:record_id>', methods=['DELETE'])
def delete_medical_record(record_id):
    conn = None
    cursor = None
    try:
        logger.info("Request to delete medical record with ID: %s", record_id)
        conn = get_db_connection()
        cursor = conn.cursor()

        # 执行删除病历操作。相关的处方明细将自动被删除。
        cursor.execute("DELETE FROM medical_records WHERE id = %s", (record_id,))
        if cursor.rowcount == 0:
            conn.rollback()
            logger.warning("Medical record with ID %s not found for deletion.", record_id)
            return jsonify({"success": False, "message": "病历不存在或已删除。"}), 404

        conn.commit()
        logger.info("Medical record with ID %s and associated prescription details deleted successfully.", record_id)
        return jsonify({"success": True, "message": "病历及其相关处方明细删除成功。"}), 200

    except Exception as e:
        if conn:
            conn.rollback()
        logger.error("Error deleting medical record %s: %s", record_id, str(e))
        return jsonify({"success": False, "message": str(e)}), 500
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()
        logger.info("Database connection closed for medical record deletion.")

# --- END OF FILE app/api/record.py ---
