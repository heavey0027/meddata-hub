# --- START OF FILE app/api/doctor.py ---
from flask import Blueprint, jsonify
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