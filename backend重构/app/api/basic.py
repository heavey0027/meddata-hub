# --- START OF FILE app/api/basic.py ---
from flask import Blueprint, jsonify
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