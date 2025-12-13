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

# 查看某个医生详情
@doctor_bp.route('/api/doctors/<string:doctor_id>', methods=['GET'])
def get_doctor_detail(doctor_id):
    conn = None
    cursor = None
    try:
        logger.info("Request to get doctor detail: %s", doctor_id)
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # 同时返回所属科室名称
        sql = """
            SELECT d.id, d.name, d.title, d.specialty, d.phone, d.department_id,
                   dept.name AS department_name
            FROM doctors d
            LEFT JOIN departments dept ON d.department_id = dept.id
            WHERE d.id = %s
        """
        cursor.execute(sql, (doctor_id,))
        row = cursor.fetchone()
        if not row:
            logger.warning("Doctor %s not found.", doctor_id)
            return jsonify({"success": False, "message": "医生不存在"}), 404

        data = {
            "id": row['id'],
            "name": row['name'],
            "title": row['title'],
            "specialty": row['specialty'],
            "phone": row['phone'],
            "departmentId": row['department_id'],
            "departmentName": row.get('department_name')
        }
        return jsonify(data)

    except Exception as e:
        logger.error("Error fetching doctor %s: %s", doctor_id, str(e))
        return jsonify({"error": str(e)}), 500

    finally:
        if cursor: cursor.close()
        if conn: conn.close()
        logger.info("Database connection closed.")

# 修改医生信息
@doctor_bp.route('/api/doctors/<string:doctor_id>', methods=['PUT'])
def update_doctor_detail(doctor_id):
    data = request.json or {}
    conn = None
    cursor = None
    try:
        logger.info("Request to update doctor %s: %s", doctor_id, data)
        conn = get_db_connection()
        cursor = conn.cursor()

        # 如果前端传入 departmentId，先校验该科室是否存在
        dept_id = data.get('departmentId')
        if dept_id:
            cursor.execute("SELECT id FROM departments WHERE id = %s", (dept_id,))
            if not cursor.fetchone():
                logger.warning("Department %s not found when updating doctor %s.", dept_id, doctor_id)
                return jsonify({"success": False, "message": "所属科室不存在"}), 400

        # 构造更新语句（仅更新提供的字段）
        fields = []
        params = []
        if 'name' in data:
            fields.append("name = %s"); params.append(data.get('name'))
        if 'title' in data:
            fields.append("title = %s"); params.append(data.get('title'))
        if 'specialty' in data:
            fields.append("specialty = %s"); params.append(data.get('specialty'))
        if 'phone' in data:
            fields.append("phone = %s"); params.append(data.get('phone'))
        if dept_id is not None:
            fields.append("department_id = %s"); params.append(dept_id)
        # 可选修改密码
        if 'password' in data:
            fields.append("password = %s"); params.append(data.get('password'))

        if not fields:
            return jsonify({"success": False, "message": "没有提供可更新字段"}), 400

        sql = "UPDATE doctors SET " + ", ".join(fields) + " WHERE id = %s"
        params.append(doctor_id)

        cursor.execute(sql, tuple(params))
        if cursor.rowcount == 0:
            conn.rollback()
            logger.warning("Doctor %s not found for update.", doctor_id)
            return jsonify({"success": False, "message": "医生不存在或已被删除"}), 404

        conn.commit()
        logger.info("Doctor %s updated successfully.", doctor_id)
        return jsonify({"success": True, "message": "医生信息更新成功"}), 200

    except Exception as e:
        if conn: conn.rollback()
        logger.error("Error updating doctor %s: %s", doctor_id, str(e))
        return jsonify({"success": False, "message": str(e)}), 500

    finally:
        if cursor: cursor.close()
        if conn: conn.close()
        logger.info("Database connection closed for doctor update.")

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
        logger.info("Doctor with ID %s deleted successfully.", doctor_id)
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
