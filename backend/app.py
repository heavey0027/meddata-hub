from flask import Flask, request, jsonify
from flask_cors import CORS
from db_utils import get_db_connection
import logging
from collections import defaultdict
import datetime

# 配置日志
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)  # 设置日志级别

# 创建一个控制台输出处理器
console_handler = logging.StreamHandler()
console_handler.setLevel(logging.INFO)  # 控制台输出的日志级别

# 创建一个文件输出处理器
file_handler = logging.FileHandler('app.log', mode='a')  # 输出到 app.log 文件
file_handler.setLevel(logging.WARNING)  # 文件输出的日志级别

# 创建日志格式
formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
console_handler.setFormatter(formatter)  # 设置控制台输出格式
file_handler.setFormatter(formatter)  # 设置文件输出格式

# 将处理器添加到 logger
logger.addHandler(console_handler)
logger.addHandler(file_handler)

app = Flask(__name__)
# 允许跨域
CORS(app)


# 辅助函数：将数据库的一行数据转换为符合驼峰命名的字典
def format_date(d):
    return str(d) if d else None


@app.route('/')
def index():
    return "MedData Hub API is running..."


# ==========================================
# 1. 读接口 (GET)
# ==========================================

#1.1 所有部门(基础下拉框)
@app.route('/api/departments', methods=['GET'])
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

# 1.2 所有医生(带子查询的高级查询)
@app.route('/api/doctors', methods=['GET'])
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


#1.3 所有药品(基础查询)
@app.route('/api/medicines', methods=['GET'])
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

#1.4 所有患者信息
@app.route('/api/patients', methods=['GET'])
def get_patients():
    conn = None
    cursor = None
    try:
        # 记录请求日志
        # 获取 query 参数（可以是 patient_id 或其他查询字段）
        query = request.args.get('query')

        # 根据 query 参数决定日志内容
        if query:
            logger.info(f"Request to get patient with query: {query}.")
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

        # 如果有 patient_id，添加过滤条件
        if patient_id:
            sql += " WHERE p.id = %s"
            params = (patient_id,)
        else:
            params = ()

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
        if cursor: cursor.close()
        if conn: conn.close()
        logger.info("Database connection closed.")

# 1.5 所有（或某个患者）病历(基础 JOIN 查询)
@app.route('/api/records', methods=['GET'])
def get_records():
    conn = None
    cursor = None
    try:
        # 记录请求日志
        logger.info("Request to get medical records.")

        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # 获取查询参数
        patient_id = request.args.get('patient_id')  # 获取 patient_id 参数

        # 基本查询 SQL，关联患者和医生
        sql = """
            SELECT 
                r.id, r.patient_id, p.name AS patient_name, 
                r.doctor_id, d.name AS doctor_name, 
                r.diagnosis, r.treatment_plan, r.visit_date 
            FROM medical_records r
            LEFT JOIN patients p ON r.patient_id = p.id
            LEFT JOIN doctors d ON r.doctor_id = d.id
        """

        # 如果提供了 patient_id 参数，限制查询该患者的记录
        if patient_id:
            sql += " WHERE r.patient_id = %s"
            cursor.execute(sql, (patient_id,))
        else:
            cursor.execute(sql)

        rows = cursor.fetchall()

        # 记录查询日志
        logger.info("Fetched %d medical records from the database.", len(rows))

        # 映射为前端驼峰命名
        data = []
        for row in rows:
            data.append({
                "id": row['id'],
                "patientId": row['patient_id'],
                "patientName": row['patient_name'],
                "doctorId": row['doctor_id'],
                "doctorName": row['doctor_name'],
                "diagnosis": row['diagnosis'],
                "treatmentPlan": row['treatment_plan'],
                "visitDate": format_date(row['visit_date'])
            })
        return jsonify(data)
    except Exception as e:
        # 记录异常日志
        logger.error("Error occurred while fetching medical records: %s", str(e))
        return jsonify({"error": str(e)}), 500
    finally:
        if cursor: cursor.close()
        if conn: conn.close()
        logger.info("Database connection closed.")


#1.6 所有（或某个病历）处方细则(基础查询)
@app.route('/api/prescription_details', methods=['GET'])
def get_prescription_details():
    conn = None
    cursor = None
    try:
        # 记录请求日志
        logger.info("Request to get prescription details.")

        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # 获取查询参数
        record_id = request.args.get('record_id')  # 获取 record_id 参数

        # 基本查询 SQL
        sql = """
            SELECT id, record_id, medicine_id, dosage, usage_info, days 
            FROM prescription_details
        """

        # 如果提供了 record_id 参数，限制查询该处方的细则
        if record_id:
            sql += " WHERE record_id = %s"
            cursor.execute(sql, (record_id,))
        else:
            cursor.execute(sql)

        rows = cursor.fetchall()

        # 记录查询日志
        logger.info("Fetched %d prescription details from the database.", len(rows))

        # 映射 usage_info -> usage
        data = []
        for row in rows:
            data.append({
                "id": row['id'],
                "recordId": row['record_id'],
                "medicineId": row['medicine_id'],
                "dosage": row['dosage'],
                "usage": row['usage_info'],
                "days": row['days']
            })

        return jsonify(data)

    except Exception as e:
        # 记录异常日志
        logger.error("Error occurred while fetching prescription details: %s", str(e))
        return jsonify({"error": str(e)}), 500

    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()
        logger.info("Database connection closed.")

#1.7 获取预约数据(基础的多表连接)
@app.route('/api/appointments', methods=['GET'])
def get_appointments():
    conn = None
    cursor = None
    try:
        # 记录请求日志
        logger.info("Request to get all appointments.")

        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # 获取查询参数
        role = request.args.get('role')  # 获取 role 参数
        date = request.args.get('date')  # 获取 date 参数
        doctor_id = request.args.get('doctor_id')  # 获取 doctor_id 参数
        patient_id = request.args.get('patient_id')  # 获取 patient_id 参数

        # 构建基本查询 SQL，关联医生和科室
        sql = """
            SELECT a.id AS appointment_id, a.patient_id, a.department_id, a.doctor_id, a.description, a.status, 
                   a.create_time, d.name AS doctor_name, dept.name AS department_name
            FROM appointments a
            LEFT JOIN doctors d ON a.doctor_id = d.id
            LEFT JOIN departments dept ON a.department_id = dept.id
        """

        # 如果提供了 patient_id 参数，返回该患者所有 pending 状态的挂号记录
        if patient_id:
            sql += " WHERE a.patient_id = %s AND a.status = 'pending'"
            cursor.execute(sql, (patient_id,))

        # 处理 role=admin 的情况，返回当天的所有挂号记录（包括 completed 和 pending）
        elif role == 'admin' and date:
            sql += " WHERE DATE(a.create_time) = %s"
            cursor.execute(sql, (date,))

        # 如果提供了 doctor_id 参数，返回该科室的所有挂号记录
        elif doctor_id:
            # 获取该医生所属的科室
            cursor.execute("SELECT department_id FROM doctors WHERE id = %s", (doctor_id,))
            doctor = cursor.fetchone()
            if doctor:
                department_id = doctor['department_id']
                sql += " WHERE a.department_id = %s"
                cursor.execute(sql, (department_id,))
            else:
                return jsonify({"error": "Doctor not found"}), 404

        # 如果没有提供 role 和 doctor_id 参数，返回所有未完成挂号记录（pending 状态）
        else:
            sql += " WHERE a.status = 'pending'"

        rows = cursor.fetchall()

        # 记录查询日志
        logger.info("Fetched %d appointment records from the database.", len(rows))

        # 构造响应数据
        data = []
        for row in rows:
            # 查询患者信息
            cursor.execute("SELECT name, phone, age FROM patients WHERE id = %s", (row['patient_id'],))
            patient = cursor.fetchone()

            # 如果找不到患者信息，返回错误
            if not patient:
                continue

            data.append({
                "id": row['appointment_id'],
                "patientName": patient['name'],
                "patientPhone": patient['phone'],
                "age": patient['age'],
                "departmentId": row['department_id'],
                "departmentName": row['department_name'],
                "doctorId": row['doctor_id'] if row['doctor_id'] else None,
                "doctorName": row['doctor_name'] if row['doctor_name'] else None,
                "status": row['status'],
                "createTime": row['create_time'],
                "description": row['description']
            })

        # 记录返回的 data
        logger.info("Returned data for appointments: %s", data)

        return jsonify(data)

    except Exception as e:
        # 记录异常日志
        logger.error("Error occurred while fetching appointments: %s", str(e))
        return jsonify({"error": str(e)}), 500

    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()
        logger.info("Database connection closed.")


#1.8 新增接口：根据年、月、日统计预约数据
@app.route('/api/appointments/statistics', methods=['GET'])
def get_appointment_statistics():
    conn = None
    cursor = None
    try:
        # 记录请求日志
        logger.info("Request to get appointment statistics.")

        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # 获取查询参数
        date = request.args.get('date')  # 获取 date 参数, 格式：yyyy-mm-dd 或 yyyy-mm 或 yyyy
        role = request.args.get('role')  # 获取 role 参数

        # 记录传入的请求参数
        logger.info("Received parameters: date=%s, role=%s", date, role)

        # 确定查询的时间区间
        if date:
            date_parts = date.split('-')
            if len(date_parts) == 3:  # 年-月-日
                year, month, day = map(int, date_parts)
                start_date = datetime.datetime(year, month, day, 0, 0)
                end_date = start_date + datetime.timedelta(days=1)
                time_condition = "WHERE a.create_time >= %s AND a.create_time < %s"
                params = (start_date, end_date)
                logger.info("Date filter: Single day %s", date)
            elif len(date_parts) == 2:  # 年-月
                year, month = map(int, date_parts)
                start_date = datetime.datetime(year, month, 1, 0, 0)
                end_date = (start_date + datetime.timedelta(days=32)).replace(day=1)
                time_condition = "WHERE a.create_time >= %s AND a.create_time < %s"
                params = (start_date, end_date)
                logger.info("Date filter: Month %s", date)
            elif len(date_parts) == 1:  # 仅年
                year = int(date_parts[0])
                start_date = datetime.datetime(year, 1, 1, 0, 0)
                end_date = datetime.datetime(year + 1, 1, 1, 0, 0)
                time_condition = "WHERE a.create_time >= %s AND a.create_time < %s"
                params = (start_date, end_date)
                logger.info("Date filter: Year %s", date)
            else:
                logger.error("Invalid date format: %s", date)
                return jsonify({"error": "Invalid date format"}), 400
        else:
            # 如果没有传递 date 参数，则统计全部数据
            time_condition = ""
            params = ()
            logger.info("No date filter provided. Fetching all data.")

        # 构建基础查询 SQL，关联医生和科室
        sql = """
            SELECT a.create_time
            FROM appointments a
            LEFT JOIN doctors d ON a.doctor_id = d.id
            LEFT JOIN departments dept ON a.department_id = dept.id
            {}
        """.format(time_condition)

        # 记录执行的 SQL
        logger.info("Executing SQL: %s with parameters %s", sql, params)

        cursor.execute(sql, params)
        rows = cursor.fetchall()

        # 记录查询结果数量
        logger.info("Fetched %d appointment records.", len(rows))

        # 统计按小时分组
        hourly_stats = defaultdict(int)
        for row in rows:
            # 确保 create_time 是 datetime 类型，并且处理微秒部分
            create_time = row['create_time']
            if isinstance(create_time, str):  # 如果是字符串，转换为 datetime
                try:
                    # 修改为支持微秒部分
                    create_time = datetime.datetime.strptime(create_time, '%Y-%m-%d %H:%M:%S.%f')
                except ValueError as e:
                    # 如果有微秒部分，就按照这个格式进行解析
                    create_time = datetime.datetime.strptime(create_time, '%Y-%m-%d %H:%M:%S')

            hour = create_time.hour
            hourly_stats[hour] += 1

        # 格式化每小时统计数据
        stats = [{"hour": hour, "count": count} for hour, count in sorted(hourly_stats.items())]

        # 记录统计数据
        logger.info("Hourly statistics: %s", stats)

        return jsonify(stats)

    except Exception as e:
        # 捕获并记录异常
        logger.error("Error occurred while fetching appointment statistics: %s", str(e))
        return jsonify({"error": str(e)}), 500

    finally:
        # 确保资源被关闭
        if cursor:
            cursor.close()
        if conn:
            conn.close()
        # 记录数据库连接关闭
        logger.info("Database connection closed.")


# ==========================================
# 2. 写接口 (POST/PUT Requests)- 植入合法性校验
# ==========================================

# 2.1 新增/注册患者
@app.route('/api/patients', methods=['POST'])
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
@app.route('/api/patients/<string:p_id>', methods=['PUT'])
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


# 2.3 提交病历 (CREATE RECORD - 核心事务)
@app.route('/api/records', methods=['POST'])
def create_record():
    data = request.json
    record_data = data.get('record')
    details_list = data.get('details', [])

    logger.info("Received data to create a new medical record: %s", record_data)
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        # 开启事务 (尽管 mysql-connector 如果 autocommit=False 默认就是开启的，显式调用更清晰)
        conn.start_transaction()
        cursor = conn.cursor()

        # 1. 插入主表 (medical_records)
        sql_record = """
            INSERT INTO medical_records 
            (id, patient_id, doctor_id, diagnosis, treatment_plan, visit_date)
            VALUES (%s, %s, %s, %s, %s, %s)
        """
        cursor.execute(sql_record, (
            record_data.get('id'),
            record_data.get('patientId'),
            record_data.get('doctorId'),
            record_data.get('diagnosis'),
            record_data.get('treatmentPlan'),
            record_data.get('visitDate')
        ))
        logger.info("Medical record ID %s created successfully.", record_data.get('id'))

        # 2. 循环插入子表 (prescription_details)
        sql_detail = """
            INSERT INTO prescription_details 
            (id, record_id, medicine_id, dosage, usage_info, days)
            VALUES (%s, %s, %s, %s, %s, %s)
        """
        # 注意: 这里假设前端回传的 recordId 就是 record_data['id']
        # 且 usage 字段对应数据库的 usage_info
        for detail in details_list:
            # 【高级查询 4】：嵌套查询校验库存
            # 逻辑：如果(请求的药在数据库中不存在 OR 库存<=0)，则报错
            cursor.execute("SELECT stock FROM medicines WHERE id = %s", (detail['medicineId'],))
            res = cursor.fetchone()
            if not res:
                logger.error("Medicine ID %s does not exist.", detail['medicineId'])
                raise Exception(f"药品ID {detail['medicineId']} 不存在")
            elif res['stock'] <= 0:
                logger.warning("Medicine ID %s has insufficient stock.", detail['medicineId'])
                raise Exception(f"药品ID {detail['medicineId']} 库存不足")

            cursor.execute(sql_detail, (
                detail.get('id'),
                record_data.get('id'),
                detail.get('medicineId'),
                detail.get('dosage'),
                detail.get('usage'),
                detail.get('days')
            ))
            logger.info("Prescription detail for Medicine ID %s inserted successfully.", detail['medicineId'])

        # 3. 提交事务
        conn.commit()
        logger.info("Medical record and prescription details committed successfully.")
        return jsonify({"success": True, "message": "病历提交成功"})

    except Exception as e:
        # 发生任何错误，立即回滚
        if conn: conn.rollback()
        logger.error("Error creating medical record: %s", str(e))
        return jsonify({"success": False, "message": "提交失败: " + str(e)}), 500

    finally:
        if cursor: cursor.close()
        if conn: conn.close()
        logger.info("Database connection closed.")

# 2.4 提交挂号 (CREATE APPOINTMENT)
@app.route('/api/appointments', methods=['POST'])
def create_appointment():
    data = request.json
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        patient_id = data.get('patientId')
        dept_id = data.get('departmentId')

        logger.info("Received data to create appointment: %s", data)

        # 【高级查询 5】：合法性校验 - "有且仅有一个有效挂号"
        # 逻辑：查询该患者在该科室是否已经有一个状态为 'pending' 的挂号。
        # 如果 count > 0，则不允许再次挂号。
        if patient_id:
            check_sql = """
                SELECT COUNT(*) FROM appointments 
                WHERE patient_id = %s AND department_id = %s AND status = 'pending'
            """
            cursor.execute(check_sql, (patient_id, dept_id))
            (existing_count,) = cursor.fetchone()

            if existing_count > 0:
                logger.warning("Patient ID %s already has a pending appointment in department %s", patient_id, dept_id)
                return jsonify({"success": False, "message": "您在该科室已有待就诊的挂号，请勿重复挂号"}), 400

        # 【高级查询 6】：分组与聚合 (GROUP BY & AGGREGATION)
        # 逻辑：如果没有指定医生，自动分配给该科室当前 'pending' 挂号最少的医生
        doctor_id = data.get('doctorId')
        if not doctor_id:
            assign_sql = """
                SELECT d.id 
                FROM doctors d
                LEFT JOIN appointments a ON d.id = a.doctor_id AND a.status = 'pending'
                WHERE d.department_id = %s
                GROUP BY d.id
                ORDER BY COUNT(a.id) ASC
                LIMIT 1
            """
            cursor.execute(assign_sql, (dept_id,))
            res = cursor.fetchone()
            if res:
                doctor_id = res[0]
                logger.info("Assigned doctor ID %s to the appointment", doctor_id)
            else:
                # 极端情况：该科室无医生
                logger.error("No available doctors in department %s", dept_id)
                return jsonify({"success": False, "message": "该科室暂无医生排班"}), 400

        # 执行插入
        sql = """
            INSERT INTO appointments (id, patient_id, department_id, doctor_id, description, status, create_time)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """
        cursor.execute(sql, (
            data.get('id'),
            data.get('patientId'),
            dept_id,
            doctor_id,
            data.get('description', ''), 'pending',
            data.get('createTime')
        ))

        conn.commit()
        logger.info("Appointment created successfully with ID: %s", data.get('id'))
        return jsonify({"success": True, "message": f"挂号成功，已分配医生ID: {doctor_id}"})

    except Exception as e:
        if conn: conn.rollback()
        logger.error("Error creating appointment: %s", str(e))
        return jsonify({"success": False, "message": str(e)}), 500

    finally:
        if cursor: cursor.close()
        if conn: conn.close()
        logger.info("Database connection closed.")


# 2.5 更新挂号状态 (UPDATE APPOINTMENT STATUS)
@app.route('/api/appointments/<string:apt_id>', methods=['PUT'])
def update_appointment_status(apt_id):
    data = request.json
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # 获取新的状态
        new_status = data.get('status')

        # 日志记录：收到的挂号更新请求
        logger.info("Received update request for appointment ID: %s with new status: %s", apt_id, new_status)

        sql = "UPDATE appointments SET status = %s WHERE id = %s"
        cursor.execute(sql, (data.get('status'), apt_id))

        conn.commit()
        # 日志记录：成功更新挂号状态
        logger.info("Successfully updated appointment ID: %s to status: %s", apt_id, new_status)

        return jsonify({"success": True, "message": "挂号状态已更新"})

    except Exception as e:
        if conn: conn.rollback()
        logger.error("Error updating appointment ID %s: %s", apt_id, str(e))
        return jsonify({"success": False, "message": str(e)}), 500

    finally:
        if cursor: cursor.close()
        if conn: conn.close()
        logger.info("Database connection closed for appointment ID: %s", apt_id)

# ==========================================
# 3. 用户登录 (Authentication)
# ==========================================

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    user_id = data.get('id')
    password = data.get('password')
    role = data.get('role')  # 'patient', 'doctor', 'admin'

    conn = None
    cursor = None

    try:
        # 1. 优先处理管理员登录 (无需查库)
        if role == 'admin':
            # 这里硬编码
            if user_id == 'admin' and password == 'admin123':
                logger.info("Admin login successful: %s", user_id)
                return jsonify({
                    "success": True,
                    "token": "admin-session-token",
                    "user": {"id": "admin", "name": "系统管理员", "role": "admin"}
                })
            else:
                logger.warning("Admin login failed: %s", user_id)
                return jsonify({"success": False, "message": "管理员认证失败"}), 401

        # 2. 普通角色登录 (查询数据库)
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        table_name = ""
        if role == 'patient':
            table_name = "patients"
        elif role == 'doctor':
            table_name = "doctors"
        else:
            logger.warning("Invalid role: %s", role)
            return jsonify({"success": False, "message": "无效的角色"}), 400

        # 从数据库获取用户数据
        sql = f"SELECT id, name FROM {table_name} WHERE id = %s AND password = %s"
        cursor.execute(sql, (user_id, password))
        user = cursor.fetchone()

        if user:
            logger.info("User login successful: %s, Role: %s", user_id, role)
            return jsonify({
                "success": True,
                "token": f"token-{user_id}-{role}",
                "user": {
                    "id": user['id'],
                    "name": user['name'],
                    "role": role
                }
            })
        else:
            logger.warning("Password mismatch for user: %s", user_id)
            return jsonify({"success": False, "message": "账号或密码错误"}), 401

    except Exception as e:
        logger.error("Login error: %s", e)
        return jsonify({"success": False, "message": "服务器内部错误"}), 500

    finally:
        # 必须在 finally 中关闭资源
        if cursor: cursor.close()
        if conn: conn.close()


if __name__ == '__main__':
    # 启动 Flask 服务，监听 5000 端口
    app.run(debug=True, host="0.0.0.0",port=5000)