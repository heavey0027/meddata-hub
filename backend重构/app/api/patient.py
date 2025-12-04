# --- START OF FILE app/api/patient.py ---
from flask import Blueprint, request, jsonify
from app.utils.db import get_db_connection
from app.utils.common import format_date
import logging

patient_bp = Blueprint('patient', __name__)
logger = logging.getLogger(__name__)

# 1.4 所有患者信息
@patient_bp.route('/api/patients', methods=['GET'])
def get_patients():
    conn = None
    cursor = None
    try:
        # 记录请求日志
        query = request.args.get('query')  # 获取查询参数，可能是 patient_id 或其他查询字段
        limit = int(request.args.get('limit', 100))  # 默认每次返回 100 条数据
        offset = int(request.args.get('offset', 0))  # 默认从第 0 条数据开始

        # 根据 query 参数决定日志内容
        if query:
            logger.info(f"Request to get patients with query: {query}.")
        else:
            logger.info("Request to get all patients.")

        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # 注意：不查询 password
        # 【高级查询 2】：全称量词 / 关系除法 (Relational Division)
        # 逻辑：查找“去过所有科室”的患者(特别需要关注的病人)。
        # 实现：不存在(NOT EXISTS) 一个科室，该患者没有(NOT EXISTS) 去挂过号。
        # 我们将其作为一个 Boolean 字段 'is_vip' 返回。
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
        if query:
            sql += " WHERE p.id = %s"
            params = (query,)
        else:
            params = ()

        # 添加分页参数
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

        # 记录查询日志
        logger.info("Fetched %d patients from the database.", len(data))

        return jsonify(data)
    except Exception as e:
        # 记录异常日志
        logger.error("Error occurred while fetching patients: %s", str(e))
        return jsonify({"error": str(e)}), 500
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()
        logger.info("Database connection closed.")

# 2.1 新增/注册患者
@patient_bp.route('/api/patients', methods=['POST'])
def create_patient():
    data = request.json
    conn = None
    cursor = None
    try:
        # 记录请求日志
        logger.info("Request to create a new patient with ID: %s", data.get('id'))

        conn = get_db_connection()
        cursor = conn.cursor()

        # 【高级查询 3】：存在性校验 (EXISTENCE)
        # 只有当该 ID 不存在时才插入
        check_sql = "SELECT id FROM patients WHERE id = %s"
        cursor.execute(check_sql, (data.get('id'),))
        if cursor.fetchone():
            logger.warning("Patient ID %s already exists. Registration failed.", data.get('id'))
            return jsonify({"success": False, "message": "ID已存在，请勿重复注册"}), 400

        # 映射 JSON 字段 -> 数据库字段 (注意 createTime -> create_time)
        sql = """
            INSERT INTO patients 
            (id, name, password, gender, age, phone, address, create_time)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """
        cursor.execute(sql, (
            data.get('id'),
            data.get('name'),
            data.get('password', '123456'),  # 默认密码处理
            data.get('gender'),
            data.get('age'),
            data.get('phone'),
            data.get('address'),
            data.get('createTime')
        ))

        conn.commit()
        # 记录成功日志
        logger.info("Patient ID %s registered successfully.", data.get('id'))
        return jsonify({"success": True, "message": "患者注册成功"})

    except Exception as e:
        if conn: conn.rollback()
        # 记录异常日志
        logger.error("Error creating patient: %s", str(e))
        return jsonify({"success": False, "message": str(e)}), 500

    finally:
        # 必须在 finally 中关闭资源
        if cursor: cursor.close()
        if conn: conn.close()
        logger.info("Database connection closed.")

# 2.2 更新患者信息 (UPDATE)
@patient_bp.route('/api/patients/<string:p_id>', methods=['PUT'])
def update_patient(p_id):
    data = request.json
    logger.info("Received data to update patient: %s", data)
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
        # 记录成功日志
        logger.info("Patient ID %s information updated successfully.", p_id)
        return jsonify({"success": True, "message": "患者信息更新成功，挂号信息已更新"})

    except Exception as e:
        if conn: conn.rollback()
        # 记录异常日志
        logger.error("Error updating patient ID %s: %s", p_id, str(e))
        return jsonify({"success": False, "message": str(e)}), 500

    finally:
        if cursor: cursor.close()
        if conn: conn.close()
        logger.info("Database connection closed.")