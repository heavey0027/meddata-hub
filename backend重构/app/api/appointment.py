from flask import Blueprint, request, jsonify
from app.utils.db import get_db_connection
import logging
from collections import defaultdict
import datetime

appointment_bp = Blueprint('appointment', __name__)
logger = logging.getLogger(__name__)

# 获取预约数据
@appointment_bp.route('/api/appointments', methods=['GET'])
def get_appointments():
    conn = None
    cursor = None
    try:
        # 记录请求日志
        logger.info("Request to get all appointments.")

        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # 获取查询参数
        role = request.args.get('role')  
        date = request.args.get('date')  
        doctor_id = request.args.get('doctor_id')  
        patient_id = request.args.get('patient_id')  

        # 构建基本查询 SQL，关联医生和科室
        sql = """
            SELECT a.id AS appointment_id, a.patient_id, a.department_id, a.doctor_id, a.description, a.status, 
                   a.create_time, d.name AS doctor_name, dept.name AS department_name
            FROM appointments a
            LEFT JOIN doctors d ON a.doctor_id = d.id
            LEFT JOIN departments dept ON a.department_id = dept.id
        """

        # 若有 patient_id 参数，返回该患者所有 pending 状态的挂号记录
        if patient_id:
            sql += " WHERE a.patient_id = %s AND a.status = 'pending'"
            cursor.execute(sql, (patient_id,))

        # 当 role=admin 的情况，返回当天的所有挂号记录
        elif role == 'admin' and date:
            sql += " WHERE DATE(a.create_time) = %s"
            cursor.execute(sql, (date,))

        # 如有 doctor_id 参数，返回该科室的所有挂号记录
        elif doctor_id:
            cursor.execute("SELECT department_id FROM doctors WHERE id = %s", (doctor_id,))
            doctor = cursor.fetchone()
            if doctor:
                department_id = doctor['department_id']
                sql += " WHERE a.department_id = %s"
                cursor.execute(sql, (department_id,))
            else:
                return jsonify({"error": "Doctor not found"}), 404

        # 如果没有提供 role 和 doctor_id 参数，返回所有未完成挂号记录
        else:
            sql += " WHERE a.status = 'pending'"

        rows = cursor.fetchall()

        # 记录查询日志
        logger.info("Fetched %d appointment records from the database.", len(rows))

        # 构造响应数据
        data = []
        for row in rows:
            cursor.execute("SELECT name, phone, age FROM patients WHERE id = %s", (row['patient_id'],))
            patient = cursor.fetchone()

            if not patient:
                continue

            data.append({
                "id": row['appointment_id'],
                "patientId": row['patient_id'],
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

        logger.info("Returned data for appointments: %s", data)

        return jsonify(data)

    except Exception as e:
        logger.error("Error occurred while fetching appointments: %s", str(e))
        return jsonify({"error": str(e)}), 500

    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()
        logger.info("Database connection closed.")


# 根据年、月、日统计预约数据
@appointment_bp.route('/api/appointments/statistics', methods=['GET'])
def get_appointment_statistics():
    conn = None
    cursor = None
    try:
        # 记录请求日志
        logger.info("Request to get appointment statistics.")

        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # 获取查询参数
        date = request.args.get('date') 
        role = request.args.get('role') 

        # 记录传入的请求参数
        logger.info("Received parameters: date=%s, role=%s", date, role)

        # 确定查询的时间区间
        if date:
            date_parts = date.split('-')
            if len(date_parts) == 3:  
                year, month, day = map(int, date_parts)
                start_date = datetime.datetime(year, month, day, 0, 0)
                end_date = start_date + datetime.timedelta(days=1)
                time_condition = "WHERE a.create_time >= %s AND a.create_time < %s"
                params = (start_date, end_date)
                logger.info("Date filter: Single day %s", date)
            elif len(date_parts) == 2:  
                year, month = map(int, date_parts)
                start_date = datetime.datetime(year, month, 1, 0, 0)
                end_date = (start_date + datetime.timedelta(days=32)).replace(day=1)
                time_condition = "WHERE a.create_time >= %s AND a.create_time < %s"
                params = (start_date, end_date)
                logger.info("Date filter: Month %s", date)
            elif len(date_parts) == 1:  
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
            create_time = row['create_time']
            if isinstance(create_time, str):  
                try:
                    create_time = datetime.datetime.strptime(create_time, '%Y-%m-%d %H:%M:%S.%f')
                except ValueError as e:
                    create_time = datetime.datetime.strptime(create_time, '%Y-%m-%d %H:%M:%S')

            hour = create_time.hour
            hourly_stats[hour] += 1

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

# 提交挂号
@appointment_bp.route('/api/appointments', methods=['POST'])
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

        # 【高级查询】：合法性校验 - "有且仅有一个有效挂号"
        # 逻辑：查询该患者在该科室是否已经有一个状态为 'pending' 的挂号。如果 count > 0，则不允许再次挂号。
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

        # 【高级查询】：分组与聚合
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
                # 该科室无医生
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


# 更新挂号状态
@appointment_bp.route('/api/appointments/<string:apt_id>', methods=['PUT'])
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
