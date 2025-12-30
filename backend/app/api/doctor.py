# --- START OF FILE app/api/doctor.py ---
from flask import Blueprint, request, jsonify
from app.utils.db import get_db_connection
from app.utils.redis_client import redis_client  # 直接导入 redis_client 实例
import logging
import json

doctor_bp = Blueprint('doctor', __name__)
logger = logging.getLogger(__name__)


# --- 辅助函数：清除缓存 ---
def clear_doctor_cache(doctor_id=None):
    try:
        # 1. 清除所有医生列表缓存 (因为包含 pending_count，任何变动都可能影响)
        redis_client.delete("doctors:list")

        # 2. 如果指定了 ID，清除该医生的详情缓存
        if doctor_id:
            redis_client.delete(f"doctor:{doctor_id}")

        logger.info(f"[CACHE CLEAR] Doctor cache cleared (ID: {doctor_id}).")
    except Exception as e:
        logger.error(f"[ERROR] Failed to clear doctor cache: {e}")


# 获取所有医生信息
@doctor_bp.route('/api/doctors', methods=['GET'])
def get_doctors():
    conn = None
    cursor = None
    try:
        # --- 1. 查缓存 ---
        cache_key = "doctors:list"
        cached_data = redis_client.get(cache_key)
        if cached_data:
            logger.info("[CACHE HIT] Doctors list")
            return jsonify(json.loads(cached_data))

        # --- 2. 查库 ---
        logger.info("[DB QUERY] Fetching all doctors with pending counts.")

        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # 【高级查询】：相关子查询
        sql = """
            SELECT 
                d.id, d.name, d.department_id, d.title, d.specialty, d.phone,
                (SELECT COUNT(*) FROM appointments a 
                 WHERE a.doctor_id = d.id AND a.status = 'pending') AS pending_count
            FROM doctors d
        """

        cursor.execute(sql)
        rows = cursor.fetchall()

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

        logger.info(f"[DB RESULT] Fetched {len(data)} doctors.")

        # --- 3. 写缓存 (10分钟 - pending_count 不需要秒级实时，但也别太久) ---
        redis_client.set(cache_key, json.dumps(data), ex=600)

        return jsonify(data)

    except Exception as e:
        logger.error(f"[ERROR] Fetching doctors failed: {str(e)}")
        return jsonify({"error": str(e)}), 500
    finally:
        if cursor: cursor.close()
        if conn: conn.close()


# 查看某个医生详情
@doctor_bp.route('/api/doctors/<string:doctor_id>', methods=['GET'])
def get_doctor_detail(doctor_id):
    conn = None
    cursor = None
    try:
        # 1. 尝试查询缓存
        cache_key = f"doctor:{doctor_id}"
        cached_data = redis_client.get(cache_key)

        if cached_data:
            try:
                logger.info(f"[CACHE HIT] Doctor detail: {doctor_id}")
                return jsonify(json.loads(cached_data)), 200
            except Exception as e:
                logger.error(f"[ERROR] Redis data parse error: {e}")
                redis_client.delete(cache_key)

        # 2. 缓存未命中或解析失败，查询数据库
        logger.info(f"[DB QUERY] Fetching doctor detail: {doctor_id}")

        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

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
            logger.warning(f"[BLOCK] Doctor {doctor_id} not found.")
            return jsonify({"success": False, "message": "医生不存在"}), 404

        # 构造返回数据
        data = {
            "id": row['id'],
            "name": row['name'],
            "title": row['title'],
            "specialty": row['specialty'],
            "phone": row['phone'],
            "departmentId": row['department_id'],
            "departmentName": row.get('department_name')
        }

        # 3. 写入缓存
        redis_client.set(cache_key, json.dumps(data), ex=3600)

        return jsonify(data), 200

    except Exception as e:
        logger.error(f"[ERROR] Fetching doctor {doctor_id} failed: {str(e)}")
        return jsonify({"success": False, "message": str(e)}), 500

    finally:
        if cursor: cursor.close()
        if conn: conn.close()

# 修改医生信息
@doctor_bp.route('/api/doctors/<string:doctor_id>', methods=['PUT'])
def update_doctor_detail(doctor_id):
    data = request.json or {}
    conn = None
    cursor = None
    try:
        logger.info(f"[ACTION] Updating doctor {doctor_id}: {data}")
        conn = get_db_connection()
        cursor = conn.cursor()

        # 若有 departmentId，先校验该科室是否存在
        dept_id = data.get('departmentId')
        if dept_id:
            cursor.execute("SELECT id FROM departments WHERE id = %s", (dept_id,))
            if not cursor.fetchone():
                return jsonify({"success": False, "message": "所属科室不存在"}), 400

        # 构造更新语句
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
            return jsonify({"success": False, "message": "医生不存在或已被删除"}), 404

        conn.commit()

        # 清除缓存
        clear_doctor_cache(doctor_id)

        logger.info(f"[SUCCESS] Doctor {doctor_id} updated.")
        return jsonify({"success": True, "message": "医生信息更新成功"}), 200

    except Exception as e:
        if conn: conn.rollback()
        logger.error(f"[ERROR] Updating doctor {doctor_id} failed: {str(e)}")
        return jsonify({"success": False, "message": str(e)}), 500

    finally:
        if cursor: cursor.close()
        if conn: conn.close()


# 删除医生：若有病历/挂号关联，则无法删除
@doctor_bp.route('/api/doctors/<string:doctor_id>', methods=['DELETE'])
def delete_doctor(doctor_id):
    conn = None
    cursor = None
    try:
        logger.info(f"[ACTION] Deleting doctor: {doctor_id}")
        conn = get_db_connection()
        cursor = conn.cursor()

        # 检查该医生是否有任何相关的挂号记录
        cursor.execute("SELECT COUNT(*) FROM appointments WHERE doctor_id = %s", (doctor_id,))
        appointment_count = cursor.fetchone()[0]

        if appointment_count > 0:
            logger.warning(f"[BLOCK] Delete failed. Doctor {doctor_id} has {appointment_count} appointments.")
            return jsonify({"success": False, "message": "无法删除：该医生仍有关联的挂号记录。请先处理相关挂号。"}), 400

        # 检查该医生是否有任何相关的病历记录
        cursor.execute("SELECT COUNT(*) FROM medical_records WHERE doctor_id = %s", (doctor_id,))
        record_count = cursor.fetchone()[0]

        if record_count > 0:
            logger.warning(f"[BLOCK] Delete failed. Doctor {doctor_id} has {record_count} medical records.")
            return jsonify({"success": False, "message": "无法删除：该医生仍有关联的病历记录。请先处理相关病历。"}), 400

        # 执行删除
        cursor.execute("DELETE FROM doctors WHERE id = %s", (doctor_id,))
        if cursor.rowcount == 0:
            conn.rollback()
            return jsonify({"success": False, "message": "医生不存在或已删除。"}), 404

        conn.commit()

        # 清除缓存
        clear_doctor_cache(doctor_id)

        logger.info(f"[SUCCESS] Doctor {doctor_id} deleted.")
        return jsonify({"success": True, "message": "医生删除成功。"}), 200

    except Exception as e:
        if conn: conn.rollback()
        logger.error(f"[ERROR] Deleting doctor {doctor_id} failed: {str(e)}")
        return jsonify({"success": False, "message": str(e)}), 500
    finally:
        if cursor: cursor.close()
        if conn: conn.close()

# --- END OF FILE app/api/doctor.py ---