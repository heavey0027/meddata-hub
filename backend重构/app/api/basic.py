# --- START OF FILE app/api/basic.py ---
from flask import Blueprint, request, jsonify
from app.utils.db import get_db_connection
import logging

basic_bp = Blueprint('basic', __name__)
logger = logging.getLogger(__name__)

# 1.1 所有部门(基础下拉框)
@basic_bp.route('/api/departments', methods=['GET'])
def get_departments():
    conn = None
    cursor = None
    try:
        # 记录请求日志
        logger.info("Request to get all departments.")

        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT id, name, location FROM departments")
        result = cursor.fetchall()

        # 记录查询日志
        logger.info("Fetched %d departments from the database.", len(result))

        return jsonify(result)
    except Exception as e:
        # 记录异常日志
        logger.error("Error occurred while fetching departments: %s", str(e))

        return jsonify({"error": str(e)}), 500
    finally:
        if cursor: cursor.close()
        if conn: conn.close()
        logger.info("Database connection closed.")
        
# 删除科室：必须医生为0才可删除。
@basic_bp.route('/api/departments/<string:department_id>', methods=['DELETE'])
def delete_department(department_id):
    conn = None
    cursor = None
    try:
        logger.info("Request to delete department with ID: %s", department_id)
        conn = get_db_connection()
        cursor = conn.cursor()

        # 检查该科室是否有医生
        cursor.execute("SELECT COUNT(*) FROM doctors WHERE department_id = %s", (department_id,))
        doctor_count = cursor.fetchone()[0]

        if doctor_count > 0:
            logger.warning("Attempt to delete department %s failed: Department has %d associated doctors.", department_id, doctor_count)
            return jsonify({"success": False, "message": "无法删除：该科室下仍有医生。请先移除所有医生。"}), 400

        # 删除科室
        cursor.execute("DELETE FROM departments WHERE id = %s", (department_id,))
        if cursor.rowcount == 0:
            conn.rollback()
            logger.warning("Department with ID %s not found for deletion.", department_id)
            return jsonify({"success": False, "message": "科室不存在或已删除。"}), 404

        conn.commit()
        logger.info("Department with ID %s deleted successfully.", department_id)
        return jsonify({"success": True, "message": "科室删除成功。"}), 200

    except Exception as e:
        if conn:
            conn.rollback()
        logger.error("Error deleting department %s: %s", department_id, str(e))
        return jsonify({"success": False, "message": str(e)}), 500
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()
        logger.info("Database connection closed for department deletion.")


# 1.3 所有药品(基础查询)
@basic_bp.route('/api/medicines', methods=['GET'])
def get_medicines():
    conn = None
    cursor = None
    try:
        # 记录请求日志
        logger.info("Request to get all medicines.")

        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT id, name, price, stock, specification FROM medicines")
        rows = cursor.fetchall()

        # 确保 Decimal 类型转为 float 或 string，以便 JSON 序列化
        for row in rows:
            row['price'] = float(row['price'])
        return jsonify(rows)
    except Exception as e:
        # 记录异常日志
        logger.error("Error occurred while fetching medicines: %s", str(e))
        return jsonify({"error": str(e)}), 500
    finally:
        if cursor: cursor.close()
        if conn: conn.close()
        logger.info("Database connection closed.")
        
# DELETE: 删除药品 - 最简逻辑：若有相关处方细则，则无法删除。
@basic_bp.route('/api/medicines/<string:medicine_id>', methods=['DELETE'])
def delete_medicine(medicine_id):
    conn = None
    cursor = None
    try:
        logger.info("Request to delete medicine with ID: %s (simple logic).", medicine_id)
        conn = get_db_connection()
        cursor = conn.cursor()

        # 1. 检查该药品是否有任何相关的处方细则
        cursor.execute("SELECT COUNT(*) FROM prescription_details WHERE medicine_id = %s", (medicine_id,))
        prescription_detail_count = cursor.fetchone()[0]

        if prescription_detail_count > 0:
            logger.warning(
                "Attempt to delete medicine %s failed: Medicine has %d associated prescription details.",
                medicine_id, prescription_detail_count
            )
            return jsonify({"success": False, "message": "无法删除：该药品仍有关联的处方细则。请先处理相关处方。"}), 400

        # 2. 如果没有关联的处方细则，则执行删除药品操作
        cursor.execute("DELETE FROM medicines WHERE id = %s", (medicine_id,))
        if cursor.rowcount == 0:
            conn.rollback()
            logger.warning("Medicine with ID %s not found for deletion.", medicine_id)
            return jsonify({"success": False, "message": "药品不存在或已删除。"}), 404

        conn.commit()
        logger.info("Medicine with ID %s deleted successfully (simple logic).", medicine_id)
        return jsonify({"success": True, "message": "药品删除成功。"}), 200

    except Exception as e:
        if conn:
            conn.rollback()
        logger.error("Error deleting medicine %s: %s", medicine_id, str(e))
        return jsonify({"success": False, "message": str(e)}), 500
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()
        logger.info("Database connection closed for medicine deletion.")
