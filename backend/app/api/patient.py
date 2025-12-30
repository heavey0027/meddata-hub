# --- START OF FILE app/api/patient.py ---
from flask import Blueprint, request, jsonify
from app.utils.db import get_db_connection
from app.utils.redis_client import redis_client
import logging
import json
from datetime import date
from app.utils.common import format_date

patient_bp = Blueprint('patient', __name__)
logger = logging.getLogger(__name__)


# --- 辅助函数：清除缓存 ---
def clear_patient_cache():
    """
    当患者数据发生变更(增删改)时，清除相关缓存
    """
    try:
        keys_to_delete = [
            'patients:stats:count',
            'patients:stats:gender',
            'patients:stats:age'
        ]
        redis_client.delete(*keys_to_delete)

        for key in redis_client.scan_iter("patients:list:*"):
            redis_client.delete(key)

        logger.info("[CACHE CLEAR] Patient related cache cleared.")
    except Exception as e:
        logger.error(f"[ERROR] Failed to clear patient cache: {e}")


# 获取所有患者信息
@patient_bp.route('/api/patients', methods=['GET'])
def get_patients():
    conn = None
    cursor = None
    try:
        query = request.args.get('query', '')
        limit = request.args.get('limit', type=int)
        offset = request.args.get('offset', type=int)

        # --- 1. 尝试从 Redis 获取缓存 ---
        cache_key = f"patients:list:{query}:{limit or 'all'}:{offset or 0}"

        cached_data = redis_client.get(cache_key)
        if cached_data:
            try:
                logger.info(f"[CACHE HIT] Patient list for key: {cache_key}")
                return jsonify(json.loads(cached_data))
            except Exception as e:
                logger.error(f"[ERROR] Redis json parse error: {e}")
                redis_client.delete(cache_key)

        # --- 2. 缓存未命中，查数据库 ---
        logger.info(f"[DB QUERY] Fetching patients (Query: '{query}', Limit: {limit}, Offset: {offset})")

        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # 【高级查询】：全称量词 / 关系除法 
        # 查找“去过所有科室”的患者(特别需要关注的病人)。
        sql = """
            SELECT 
                p.id, p.name, p.gender, p.age, p.phone, p.address, p.create_time,
                CASE 
                    WHEN NOT EXISTS (
                        SELECT d.id FROM departments d
                        WHERE NOT EXISTS (
                            SELECT a.id FROM appointments a
                            WHERE a.patient_id = p.id AND a.department_id = d.id
                        )
                    ) THEN 1 
                    ELSE 0 
                END AS is_vip
            FROM patients p
        """

        # 如果有 query 参数，添加过滤条件
        params = ()
        if query:
            sql += " WHERE p.id = %s OR p.name LIKE %s"
            params = (query, f"%{query}%")

        # 只有在提供 limit 和 offset 时才加上分页限制
        if limit :
            sql += " LIMIT %s OFFSET %s"
            params += (limit, offset)

        cursor.execute(sql, params)
        rows = cursor.fetchall()

        # 映射字段 create_time -> createTime 并格式化日期
        data = []
        for row in rows:
            data.append({
                "id": row['id'],
                "name": row['name'],
                "gender": row['gender'],
                "age": row['age'],
                "phone": row['phone'],
                "address": row['address'],
                "createTime": format_date(row['create_time']),
                "isVip": bool(row['is_vip'])
            })

        logger.info(f"[DB RESULT] Fetched {len(data)} patients.")

        # --- 3. 写入 Redis 缓存 ---
        redis_client.set(cache_key, json.dumps(data), ex=30)

        return jsonify(data)
    except Exception as e:
        logger.error(f"[ERROR] Fetching patients failed: {str(e)}")
        return jsonify({"error": str(e)}), 500
    finally:
        if cursor: cursor.close()
        if conn: conn.close()


# 新增/注册患者
@patient_bp.route('/api/patients', methods=['POST'])
def create_patient():
    data = request.json
    conn = None
    cursor = None
    try:
        p_id = data.get('id')
        logger.info(f"[ACTION] Registering new patient: {p_id}")

        conn = get_db_connection()
        cursor = conn.cursor()

        # 【高级查询】：存在性校验
        # 只有当该 ID 不存在时才插入
        check_sql = "SELECT id FROM patients WHERE id = %s"
        cursor.execute(check_sql, (p_id,))
        if cursor.fetchone():
            logger.warning(f"[BLOCK] Patient ID {p_id} already exists.")
            return jsonify({"success": False, "message": "ID已存在，请勿重复注册"}), 400

        # 映射 JSON 字段 -> 数据库字段
        sql = """
            INSERT INTO patients 
            (id, name, password, gender, age, phone, address, create_time)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """
        cursor.execute(sql, (
            p_id,
            data.get('name'),
            data.get('password', '123456'),  # 默认密码处理
            data.get('gender'),
            data.get('age'),
            data.get('phone'),
            data.get('address'),
            data.get('createTime')
        ))

        conn.commit()

        clear_patient_cache()

        logger.info(f"[SUCCESS] Patient {p_id} registered.")
        return jsonify({"success": True, "message": "患者注册成功"})

    except Exception as e:
        if conn: conn.rollback()
        logger.error(f"[ERROR] Creating patient failed: {str(e)}")
        return jsonify({"success": False, "message": str(e)}), 500

    finally:
        if cursor: cursor.close()
        if conn: conn.close()


# 更新患者信息
@patient_bp.route('/api/patients/<string:p_id>', methods=['PUT'])
def update_patient(p_id):
    data = request.json
    logger.info(f"[ACTION] Updating patient info: {p_id}")
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # 更新患者表中的信息
        sql_patient = """
            UPDATE patients 
            SET name = %s, phone = %s, address = %s, age = %s
            WHERE id = %s
        """
        cursor.execute(sql_patient, (
            data.get('name'),
            data.get('phone'),
            data.get('address'),
            data.get('age'),
            p_id
        ))

        conn.commit()

        clear_patient_cache()

        logger.info(f"[SUCCESS] Patient {p_id} updated.")
        return jsonify({"success": True, "message": "患者信息更新成功"})

    except Exception as e:
        if conn: conn.rollback()
        logger.error(f"[ERROR] Updating patient {p_id} failed: {str(e)}")
        return jsonify({"success": False, "message": str(e)}), 500

    finally:
        if cursor: cursor.close()
        if conn: conn.close()


# 删除患者
@patient_bp.route('/api/patients/<string:patient_id>', methods=['DELETE'])
def delete_patient(patient_id):
    conn = None
    cursor = None
    try:
        logger.info(f"[ACTION] Deleting patient: {patient_id}")
        conn = get_db_connection()
        cursor = conn.cursor()

        # 开启事务，确保所有操作要么都成功，要么都失败
        conn.start_transaction()

        # 删除该患者的挂号记录
        cursor.execute("DELETE FROM appointments WHERE patient_id = %s", (patient_id,))
        deleted_appts = cursor.rowcount

        # 删除该患者的病历记录 (这将通过级联删除自动删除相关的处方明细)
        cursor.execute("DELETE FROM medical_records WHERE patient_id = %s", (patient_id,))
        deleted_records = cursor.rowcount

        # 删除患者本身
        cursor.execute("DELETE FROM patients WHERE id = %s", (patient_id,))
        if cursor.rowcount == 0:
            conn.rollback()
            logger.warning(f"[BLOCK] Patient {patient_id} not found for deletion.")
            return jsonify({"success": False, "message": "患者不存在或已删除。"}), 404

        conn.commit()

        logger.info(
            f"[SUCCESS] Patient {patient_id} deleted (Cascaded: {deleted_appts} Appts, {deleted_records} Records).")

        clear_patient_cache()

        return jsonify({"success": True, "message": "患者及其所有相关数据删除成功。"}), 200

    except Exception as e:
        if conn: conn.rollback()
        logger.error(f"[ERROR] Deleting patient {patient_id} failed: {str(e)}")
        return jsonify({"success": False, "message": str(e)}), 500
    finally:
        if cursor: cursor.close()
        if conn: conn.close()


# 查询患者总数
@patient_bp.route('/api/patients/count', methods=['GET'])
def get_patient_count():
    try:
        # --- 1. 查缓存 ---
        cache_key = "patients:stats:count"
        cached_val = redis_client.get(cache_key)
        if cached_val:
            logger.info(f"[CACHE HIT] Patient count: {cached_val}")
            return jsonify({"total_patients": int(cached_val)})

        # --- 2. 查库 ---
        logger.info("[DB QUERY] Counting total patients")
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # SQL 查询患者总数
        cursor.execute("SELECT COUNT(*) AS total FROM patients")
        result = cursor.fetchone()

        # 获取患者总数
        total_patients = result['total'] if result else 0

        # 返回 JSON 格式的结果
        logging.info(f"Total patients fetched: {total_patients}")
        return jsonify({"total_patients": total_patients})

    except Exception as e:
        logger.error(f"[ERROR] Fetching patient count failed: {str(e)}")
        return jsonify({"error": str(e)}), 500
    finally:
        if 'cursor' in locals() and cursor: cursor.close()
        if 'conn' in locals() and conn: conn.close()


# 患者性别比例统计
@patient_bp.route('/api/patients/gender_ratio', methods=['GET'])
def get_gender_ratio():
    try:
        # --- 1. 查缓存 ---
        cache_key = "patients:stats:gender"
        cached_data = redis_client.get(cache_key)
        if cached_data:
            logger.info("[CACHE HIT] Gender ratio statistics")
            return jsonify(json.loads(cached_data))

        # --- 2. 查库 ---
        logger.info("[DB QUERY] Calculating gender ratio")
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # SQL 查询按性别分组统计患者数量
        cursor.execute("""
            SELECT gender, COUNT(*) AS count
            FROM patients
            GROUP BY gender
        """)
        rows = cursor.fetchall()

        gender_ratio = {"male": 0, "female": 0, "other": 0}
        if rows:
            for row in rows:
                gender = row['gender']
                if gender == '男':
                    gender_ratio["male"] = row['count']
                elif gender == '女':
                    gender_ratio["female"] = row['count']
                else:
                    gender_ratio["other"] = row['count']

        # --- 3. 写缓存 ---
        redis_client.set(cache_key, json.dumps(gender_ratio), ex=3600)

        return jsonify(gender_ratio)

    except Exception as e:
        logger.error(f"[ERROR] Fetching gender ratio failed: {str(e)}")
        return jsonify({"error": str(e)}), 500
    finally:
        if 'cursor' in locals() and cursor: cursor.close()
        if 'conn' in locals() and conn: conn.close()


# 患者年龄比例统计
@patient_bp.route('/api/patients/age_ratio', methods=['GET'])
def get_age_ratio():
    try:
        # --- 1. 查缓存 ---
        cache_key = "patients:stats:age"
        cached_data = redis_client.get(cache_key)
        if cached_data:
            logger.info("[CACHE HIT] Age ratio statistics")
            return jsonify(json.loads(cached_data))

        # --- 2. 查库 ---
        logger.info("[DB QUERY] Calculating age ratio")
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # SQL 查询按年龄段分组统计患者数量
        cursor.execute("""
            SELECT 
                CASE
                    WHEN age BETWEEN 0 AND 18 THEN '青少年'
                    WHEN age BETWEEN 19 AND 35 THEN '青年'
                    WHEN age BETWEEN 36 AND 60 THEN '中年'
                    WHEN age > 60 THEN '老年'
                    ELSE '未知'
                END AS age_group,
                COUNT(*) AS count
            FROM patients
            GROUP BY age_group
        """)
        rows = cursor.fetchall()

        age_ratio = {"青少年": 0, "青年": 0, "中年": 0, "老年": 0}
        if rows:
            for row in rows:
                age_ratio[row['age_group']] = row['count']

        # --- 3. 写缓存 ---
        redis_client.set(cache_key, json.dumps(age_ratio), ex=3600)

        return jsonify(age_ratio)

    except Exception as e:
        logger.error(f"[ERROR] Fetching age ratio failed: {str(e)}")
        return jsonify({"error": str(e)}), 500
    finally:
        if 'cursor' in locals() and cursor: cursor.close()
        if 'conn' in locals() and conn: conn.close()

# --- END OF FILE app/api/patient.py ---
