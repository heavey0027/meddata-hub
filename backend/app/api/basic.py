# --- START OF FILE app/api/basic.py ---
from flask import Blueprint, request, jsonify
from app.utils.db import get_db_connection
from app.utils.redis_client import redis_client
import logging
import json

basic_bp = Blueprint('basic', __name__)
logger = logging.getLogger(__name__)


# --- 辅助函数：清除缓存 ---
def clear_basic_cache(type_):
    """
    清除基础数据缓存
    type_: 'dept' (科室) | 'med' (药品)
    """
    try:
        if type_ == 'dept':
            # 清除列表和详情
            redis_client.delete('basic:depts:list')
            for key in redis_client.scan_iter("basic:dept:*"):
                redis_client.delete(key)
        elif type_ == 'med':
            # 清除列表和详情
            redis_client.delete('basic:meds:list')
            for key in redis_client.scan_iter("basic:med:*"):
                redis_client.delete(key)

        logger.info(f"[CACHE CLEAR] Cleared {type_} cache.")
    except Exception as e:
        logger.error(f"[ERROR] Failed to clear {type_} cache: {e}")


# 获取所有科室
@basic_bp.route('/api/departments', methods=['GET'])
def get_departments():
    conn = None
    cursor = None
    try:
        # --- 1. 查缓存 ---
        cache_key = 'basic:depts:list'
        cached_data = redis_client.get(cache_key)
        if cached_data:
            logger.info(f"[CACHE HIT] Departments list")
            return jsonify(json.loads(cached_data))

        # --- 2. 查库 ---
        logger.info("[DB QUERY] Fetching all departments.")

        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT id, name, location FROM departments")
        result = cursor.fetchall()

        logger.info(f"[DB RESULT] Fetched {len(result)} departments.")

        # --- 3. 写缓存 (1小时) ---
        redis_client.set(cache_key, json.dumps(result), ex=3600)

        return jsonify(result)
    except Exception as e:
        logger.error(f"[ERROR] Fetching departments failed: {str(e)}")
        return jsonify({"error": str(e)}), 500
    finally:
        if cursor: cursor.close()
        if conn: conn.close()


# 查看科室详情
@basic_bp.route('/api/departments/<string:department_id>', methods=['GET'])
def get_department_detail(department_id):
    conn = None
    cursor = None
    try:
        # --- 1. 查缓存 ---
        cache_key = f"basic:dept:{department_id}"
        cached_data = redis_client.get(cache_key)
        if cached_data:
            logger.info(f"[CACHE HIT] Department detail: {department_id}")
            return jsonify(json.loads(cached_data))

        # --- 2. 查库 ---
        logger.info(f"[DB QUERY] Fetching department detail: {department_id}")
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        sql = """
            SELECT d.id, d.name, d.location,
                   (SELECT COUNT(*) FROM doctors doc WHERE doc.department_id = d.id) AS doctor_count
            FROM departments d
            WHERE d.id = %s
        """
        cursor.execute(sql, (department_id,))
        row = cursor.fetchone()
        if not row:
            logger.warning(f"[BLOCK] Department {department_id} not found.")
            return jsonify({"success": False, "message": "科室不存在"}), 404

        data = {
            "id": row['id'],
            "name": row['name'],
            "location": row['location'],
            "doctorCount": int(row['doctor_count'])
        }

        # --- 3. 写缓存 (1小时) ---
        redis_client.set(cache_key, json.dumps(data), ex=3600)

        return jsonify(data)

    except Exception as e:
        logger.error(f"[ERROR] Fetching department {department_id} failed: {str(e)}")
        return jsonify({"error": str(e)}), 500

    finally:
        if cursor: cursor.close()
        if conn: conn.close()


# 删除科室：必须医生为0才可删除
@basic_bp.route('/api/departments/<string:department_id>', methods=['DELETE'])
def delete_department(department_id):
    conn = None
    cursor = None
    try:
        logger.info(f"[ACTION] Deleting department: {department_id}")
        conn = get_db_connection()
        cursor = conn.cursor()

        # 检查该科室是否有医生
        cursor.execute("SELECT COUNT(*) FROM doctors WHERE department_id = %s", (department_id,))
        doctor_count = cursor.fetchone()[0]

        if doctor_count > 0:
            logger.warning(f"[BLOCK] Delete failed. Dept {department_id} has {doctor_count} doctors.")
            return jsonify({"success": False, "message": "无法删除：该科室下仍有医生。请先移除所有医生。"}), 400

        # 删除科室
        cursor.execute("DELETE FROM departments WHERE id = %s", (department_id,))
        if cursor.rowcount == 0:
            conn.rollback()
            return jsonify({"success": False, "message": "科室不存在或已删除。"}), 404

        conn.commit()

        # 清除缓存
        clear_basic_cache('dept')

        logger.info(f"[SUCCESS] Department {department_id} deleted.")
        return jsonify({"success": True, "message": "科室删除成功。"}), 200

    except Exception as e:
        if conn: conn.rollback()
        logger.error(f"[ERROR] Deleting department {department_id} failed: {str(e)}")
        return jsonify({"success": False, "message": str(e)}), 500
    finally:
        if cursor: cursor.close()
        if conn: conn.close()


# 获取所有药品
@basic_bp.route('/api/medicines', methods=['GET'])
def get_medicines():
    conn = None
    cursor = None
    try:
        # --- 1. 查缓存 ---
        cache_key = 'basic:meds:list'
        cached_data = redis_client.get(cache_key)
        if cached_data:
            logger.info("[CACHE HIT] Medicines list")
            return jsonify(json.loads(cached_data))

        # --- 2. 查库 ---
        logger.info("[DB QUERY] Fetching all medicines")

        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT id, name, price, stock, specification FROM medicines")
        rows = cursor.fetchall()

        # 确保 Decimal 类型转为 float 或 string，以便 JSON 序列化
        for row in rows:
            row['price'] = float(row['price'])

        # --- 3. 写缓存 (5分钟) ---
        redis_client.set(cache_key, json.dumps(rows), ex=300)

        return jsonify(rows)
    except Exception as e:
        logger.error(f"[ERROR] Fetching medicines failed: {str(e)}")
        return jsonify({"error": str(e)}), 500
    finally:
        if cursor: cursor.close()
        if conn: conn.close()


# 查看某个药品详情
@basic_bp.route('/api/medicines/<string:medicine_id>', methods=['GET'])
def get_medicine_detail(medicine_id):
    conn = None
    cursor = None
    try:
        # --- 1. 查缓存 ---
        cache_key = f"basic:med:{medicine_id}"
        cached_data = redis_client.get(cache_key)
        if cached_data:
            logger.info(f"[CACHE HIT] Medicine detail: {medicine_id}")
            return jsonify(json.loads(cached_data))

        # --- 2. 查库 ---
        logger.info(f"[DB QUERY] Fetching medicine detail: {medicine_id}")
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        sql = "SELECT id, name, price, stock, specification FROM medicines WHERE id = %s"
        cursor.execute(sql, (medicine_id,))
        row = cursor.fetchone()
        if not row:
            return jsonify({"success": False, "message": "药品不存在"}), 404

        row['price'] = float(row['price'])
        data = {
            "id": row['id'],
            "name": row['name'],
            "price": row['price'],
            "stock": row['stock'],
            "specification": row['specification']
        }

        # --- 3. 写缓存 (5分钟) ---
        redis_client.set(cache_key, json.dumps(data), ex=300)

        return jsonify(data)

    except Exception as e:
        logger.error(f"[ERROR] Fetching medicine {medicine_id} failed: {str(e)}")
        return jsonify({"error": str(e)}), 500

    finally:
        if cursor: cursor.close()
        if conn: conn.close()


# 修改药品信息
@basic_bp.route('/api/medicines/<string:medicine_id>', methods=['PUT'])
def update_medicine_detail(medicine_id):
    data = request.json or {}
    conn = None
    cursor = None
    try:
        logger.info(f"[ACTION] Updating medicine {medicine_id}: {data}")
        conn = get_db_connection()
        cursor = conn.cursor()

        fields = []
        params = []
        if 'name' in data:
            fields.append("name = %s"); params.append(data.get('name'))
        if 'price' in data:
            fields.append("price = %s"); params.append(data.get('price'))
        if 'stock' in data:
            fields.append("stock = %s"); params.append(data.get('stock'))
        if 'specification' in data:
            fields.append("specification = %s"); params.append(data.get('specification'))

        if not fields:
            return jsonify({"success": False, "message": "没有提供可更新字段"}), 400

        sql = "UPDATE medicines SET " + ", ".join(fields) + " WHERE id = %s"
        params.append(medicine_id)

        cursor.execute(sql, tuple(params))
        if cursor.rowcount == 0:
            conn.rollback()
            return jsonify({"success": False, "message": "药品不存在或已被删除"}), 404

        conn.commit()

        # 清除缓存
        clear_basic_cache('med')

        logger.info(f"[SUCCESS] Medicine {medicine_id} updated.")
        return jsonify({"success": True, "message": "药品信息更新成功"}), 200

    except Exception as e:
        if conn: conn.rollback()
        logger.error(f"[ERROR] Updating medicine {medicine_id} failed: {str(e)}")
        return jsonify({"success": False, "message": str(e)}), 500

    finally:
        if cursor: cursor.close()
        if conn: conn.close()


# 删除药品：若有相关处方细则，则无法删除
@basic_bp.route('/api/medicines/<string:medicine_id>', methods=['DELETE'])
def delete_medicine(medicine_id):
    conn = None
    cursor = None
    try:
        logger.info(f"[ACTION] Deleting medicine: {medicine_id}")
        conn = get_db_connection()
        cursor = conn.cursor()

        # 检查该药品是否有任何相关的处方细则
        cursor.execute("SELECT COUNT(*) FROM prescription_details WHERE medicine_id = %s", (medicine_id,))
        prescription_detail_count = cursor.fetchone()[0]

        if prescription_detail_count > 0:
            logger.warning(
                f"[BLOCK] Delete failed. Medicine {medicine_id} used in {prescription_detail_count} prescriptions.")
            return jsonify({"success": False, "message": "无法删除：该药品仍有关联的处方细则。请先处理相关处方。"}), 400

        # 如果没有关联的处方细则，则执行删除药品操作
        cursor.execute("DELETE FROM medicines WHERE id = %s", (medicine_id,))
        if cursor.rowcount == 0:
            conn.rollback()
            return jsonify({"success": False, "message": "药品不存在或已删除。"}), 404

        conn.commit()

        # 清除缓存
        clear_basic_cache('med')

        logger.info(f"[SUCCESS] Medicine {medicine_id} deleted.")
        return jsonify({"success": True, "message": "药品删除成功。"}), 200

    except Exception as e:
        if conn: conn.rollback()
        logger.error(f"[ERROR] Deleting medicine {medicine_id} failed: {str(e)}")
        return jsonify({"success": False, "message": str(e)}), 500
    finally:
        if cursor: cursor.close()
        if conn: conn.close()

# --- END OF FILE app/api/basic.py ---
