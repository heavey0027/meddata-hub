# --- START OF FILE app/api/doctor.py ---
from flask import Blueprint, request, jsonify
from app.utils.db import get_db_connection
import logging

doctor_bp = Blueprint('doctor', __name__)
logger = logging.getLogger(__name__)

# 1.2 所有医生(带子查询的高级查询)
@doctor_bp.route('/api/doctors', methods=['GET'])
def get_doctors():
    conn = None
    cursor = None
    try:
        # 记录请求日志
        logger.info("Request to get all doctors.")

        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # 【高级查询 1】：相关子查询 (Correlated Subquery)
        # 既查医生基本信息，又计算该医生当前有多少个 'pending' 状态的挂号
        sql = """
            SELECT 
                d.id, d.name, d.department_id, d.title, d.specialty, d.phone,
                (SELECT COUNT(*) FROM appointments a 
                 WHERE a.doctor_id = d.id AND a.status = 'pending') AS pending_count
            FROM doctors d
        """

        cursor.execute(sql)
        rows = cursor.fetchall()

        # 字段名映射: department_id -> departmentId
        data = []
        for row in rows:
            data.append({
                "id": row['id'],
                "name": row['name'],
                "departmentId": row['department_id'],
                "title": row['title'],
                "specialty": row['specialty'],
                "phone": row['phone'],
                "pendingCount": row['pending_count']
            })

        # 记录查询日志
        logger.info("Fetched %d doctors with pending counts from the database.", len(data))

        return jsonify(data)

    except Exception as e:
        # 记录异常日志
        logger.error("Error occurred while fetching doctors: %s", str(e))

        return jsonify({"error": str(e)}), 500
    finally:
        if cursor: cursor.close()
        if conn: conn.close()
        logger.info("Database connection closed.")

# DELETE: 删除医生 - 最简逻辑：若有病历/挂号关联，则无法删除。
@doctor_bp.route('/api/doctors/<string:doctor_id>', methods=['DELETE'])
def delete_doctor(doctor_id):
    conn = None
    cursor = None
    try:
        logger.info("Request to delete doctor with ID: %s (simple logic).", doctor_id)
        conn = get_db_connection()
        cursor = conn.cursor()

        # 1. 检查该医生是否有任何相关的挂号记录 (ANY status)
        cursor.execute("SELECT COUNT(*) FROM appointments WHERE doctor_id = %s", (doctor_id,))
        appointment_count = cursor.fetchone()[0]

        if appointment_count > 0:
            logger.warning(
                "Attempt to delete doctor %s failed: Doctor has %d associated appointments (any status).",
                doctor_id, appointment_count
            )
            return jsonify({"success": False, "message": "无法删除：该医生仍有关联的挂号记录。请先处理相关挂号。"}), 400

        # 2. 检查该医生是否有任何相关的病历记录
        cursor.execute("SELECT COUNT(*) FROM medical_records WHERE doctor_id = %s", (doctor_id,))
        record_count = cursor.fetchone()[0]

        if record_count > 0:
            logger.warning(
                "Attempt to delete doctor %s failed: Doctor has %d associated medical records.",
                doctor_id, record_count
            )
            return jsonify({"success": False, "message": "无法删除：该医生仍有关联的病历记录。请先处理相关病历。"}), 400

        # 3. 如果没有关联记录，则执行删除医生操作
        cursor.execute("DELETE FROM doctors WHERE id = %s", (doctor_id,))
        if cursor.rowcount == 0:
            conn.rollback()
            logger.warning("Doctor with ID %s not found for deletion.", doctor_id)
            return jsonify({"success": False, "message": "医生不存在或已删除。"}), 404

        conn.commit()
        logger.info("Doctor with ID %s deleted successfully (simple logic).", doctor_id)
        return jsonify({"success": True, "message": "医生删除成功。"}), 200

    except Exception as e:
        if conn:
            conn.rollback()
        logger.error("Error deleting doctor %s: %s", doctor_id, str(e))
        return jsonify({"success": False, "message": str(e)}), 500
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()
        logger.info("Database connection closed for doctor deletion.")
