# --- START OF FILE app/api/patient.py ---
from flask import Blueprint, request, jsonify
from app.utils.db import get_db_connection
import logging
from datetime import date
from app.utils.common import format_date

patient_bp = Blueprint('patient', __name__)
logger = logging.getLogger(__name__)

# 获取所有患者信息
@patient_bp.route('/api/patients', methods=['GET'])
def get_patients():
    conn = None
    cursor = None
    try:
        # 记录请求日志
        query = request.args.get('query')  
        limit = request.args.get('limit',type=int)  
        offset = request.args.get('offset',type=int) 

        # 根据 query 参数决定日志内容
        if query:
            logger.info(f"Request to get patients with query: {query}.")
        else:
            logger.info("Request to get all patients.")

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
            sql += " WHERE p.id = %s"
            params = (query,)

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

# 新增/注册患者
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

        # 【高级查询】：存在性校验
        # 只有当该 ID 不存在时才插入
        check_sql = "SELECT id FROM patients WHERE id = %s"
        cursor.execute(check_sql, (data.get('id'),))
        if cursor.fetchone():
            logger.warning("Patient ID %s already exists. Registration failed.", data.get('id'))
            return jsonify({"success": False, "message": "ID已存在，请勿重复注册"}), 400

        # 映射 JSON 字段 -> 数据库字段
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
        if cursor: cursor.close()
        if conn: conn.close()
        logger.info("Database connection closed.")

# 更新患者信息
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

# 删除患者
@patient_bp.route('/api/patients/<string:patient_id>', methods=['DELETE'])
def delete_patient(patient_id):
    conn = None
    cursor = None
    try:
        logger.info("Request to delete patient with ID: %s", patient_id)
        conn = get_db_connection()
        cursor = conn.cursor()

        # 开启事务，确保所有操作要么都成功，要么都失败
        conn.start_transaction()

        # 删除该患者的挂号记录
        cursor.execute("DELETE FROM appointments WHERE patient_id = %s", (patient_id,))
        logger.info("Deleted %d appointment records for patient %s.", cursor.rowcount, patient_id)

        # 删除该患者的病历记录 (这将通过级联删除自动删除相关的处方明细)
        cursor.execute("DELETE FROM medical_records WHERE patient_id = %s", (patient_id,))
        logger.info("Deleted %d medical records for patient %s (and cascaded %d prescription details).", 
                     cursor.rowcount, patient_id, cursor.rowcount) 

        # 删除患者本身
        cursor.execute("DELETE FROM patients WHERE id = %s", (patient_id,))
        if cursor.rowcount == 0:
            conn.rollback()
            logger.warning("Patient with ID %s not found for deletion.", patient_id)
            return jsonify({"success": False, "message": "患者不存在或已删除。"}), 404

        conn.commit()
        logger.info("Patient with ID %s and all associated data deleted successfully.", patient_id)
        return jsonify({"success": True, "message": "患者及其所有相关数据删除成功。"}), 200

    except Exception as e:
        if conn:
            conn.rollback()
        logger.error("Error deleting patient %s: %s", patient_id, str(e))
        return jsonify({"success": False, "message": str(e)}), 500
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()
        logger.info("Database connection closed for patient deletion.")


# 查询患者总数
@patient_bp.route('/api/patients/count', methods=['GET'])
def get_patient_count():
    conn = None
    cursor = None
    try:
        # 记录请求日志
        logger.info("Request to get total number of patients.")

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
        logger.error("Error occurred while fetching total number of patients: %s", str(e))
        return jsonify({"error": str(e)}), 500

    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()
        logger.info("Database connection closed.")

# 患者性别比例统计
@patient_bp.route('/api/patients/gender_ratio', methods=['GET'])
def get_gender_ratio():
    conn = None
    cursor = None
    try:
        # 记录请求日志
        logger.info("Request to get patient gender ratio.")

        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # SQL 查询按性别分组统计患者数量
        cursor.execute("""
            SELECT gender, COUNT(*) AS count
            FROM patients
            GROUP BY gender
        """)
        rows = cursor.fetchall()

        # 如果没有查询结果，返回空的性别比例
        if not rows:
            return jsonify({"male": 0, "female": 0, "other": 0})

        # 构建性别比例统计
        gender_ratio = {"male": 0, "female": 0, "other": 0}
        for row in rows:
            gender = row['gender']
            if gender == '男':
                gender_ratio["male"] = row['count']
            elif gender == '女':
                gender_ratio["female"] = row['count']
            else:
                gender_ratio["other"] = row['count']

        # 返回性别比例
        logging.info("gender_ratio: %s",gender_ratio)
        return jsonify(gender_ratio)

    except Exception as e:
        logger.error("Error occurred while fetching patient gender ratio: %s", str(e))
        return jsonify({"error": str(e)}), 500

    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()
        logger.info("Database connection closed.")

# 患者年龄比例统计
@patient_bp.route('/api/patients/age_ratio', methods=['GET'])
def get_age_ratio():
    conn = None
    cursor = None
    try:
        # 记录请求日志
        logger.info("Request to get patient age ratio.")

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

        # 如果没有查询结果，返回空的年龄比例
        if not rows:
            return jsonify({"青少年": 0, "青年": 0, "中年": 0, "老年": 0})

        # 构建年龄比例统计
        age_ratio = {"青少年": 0, "青年": 0, "中年": 0, "老年": 0}
        for row in rows:
            age_group = row['age_group']
            age_ratio[age_group] = row['count']

        # 返回年龄比例
        logging.info("age_ratio: %s",age_ratio)
        return jsonify(age_ratio)

    except Exception as e:
        logger.error("Error occurred while fetching patient age ratio: %s", str(e))
        return jsonify({"error": str(e)}), 500

    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()
        logger.info("Database connection closed.")


# --- END OF FILE app/api/patient.py ---
