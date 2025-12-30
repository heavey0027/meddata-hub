# --- START OF FILE app/api/appointment.py ---
from flask import Blueprint, request, jsonify
from app.utils.db import get_db_connection
from app.utils.redis_client import redis_client
import logging
from collections import defaultdict
import datetime
import json

appointment_bp = Blueprint('appointment', __name__)
logger = logging.getLogger(__name__)


# 获取预约数据
@appointment_bp.route('/api/appointments', methods=['GET'])
def get_appointments():
    conn = None
    cursor = None
    try:
        role = request.args.get('role', '')
        date = request.args.get('date', '')
        doctor_id = request.args.get('doctor_id', '')
        patient_id = request.args.get('patient_id', '')

        # --- 1. 尝试查缓存 ---
        cache_key = f"appt:list:{role}:{date}:{doctor_id}:{patient_id}"
        cached_data = redis_client.get(cache_key)
        if cached_data:
            # [结构化日志] 明确标识缓存命中
            logger.info(f"[CACHE HIT] Appointments list for key: {cache_key}")
            return jsonify(json.loads(cached_data))

        # --- 2. 查数据库 ---
        # [结构化日志] 明确标识缓存未命中，开始查库
        logger.info(f"[DB QUERY] Fetching appointments (Role: {role}, Date: {date}, Doc: {doctor_id}, Patient: {patient_id})")

        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

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

        # 只记录返回条数，不打印完整数据，防止刷屏
        logger.info(f"[DB RESULT] Fetched {len(data)} appointment records.")

        # --- 3. 写入缓存 ---
        redis_client.set(cache_key, json.dumps(data, default=str), ex=15)

        return jsonify(data)

    except Exception as e:
        logger.error(f"[ERROR] Fetching appointments failed: {str(e)}")
        return jsonify({"error": str(e)}), 500

    finally:
        if cursor: cursor.close()
        if conn: conn.close()


# 根据年、月、日统计预约数据
@appointment_bp.route('/api/appointments/statistics', methods=['GET'])
def get_appointment_statistics():
    conn = None
    cursor = None
    try:
        date = request.args.get('date', '')
        role = request.args.get('role', '')

        # --- 1. 尝试查缓存 ---
        cache_key = f"appt:stats:{date}:{role}"
        cached_data = redis_client.get(cache_key)
        if cached_data:
            logger.info(f"[CACHE HIT] Appointment statistics for {date}")
            return jsonify(json.loads(cached_data))

        # --- 2. 查数据库 ---
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        if date:
            logger.info(f"[DB QUERY] Calculating statistics for period: {date}")
            date_parts = date.split('-')
            if len(date_parts) == 3:
                year, month, day = map(int, date_parts)
                start_date = datetime.datetime(year, month, day, 0, 0)
                end_date = start_date + datetime.timedelta(days=1)
                time_condition = "WHERE a.create_time >= %s AND a.create_time < %s"
                params = (start_date, end_date)
            elif len(date_parts) == 2:
                year, month = map(int, date_parts)
                start_date = datetime.datetime(year, month, 1, 0, 0)
                end_date = (start_date + datetime.timedelta(days=32)).replace(day=1)
                time_condition = "WHERE a.create_time >= %s AND a.create_time < %s"
                params = (start_date, end_date)
            elif len(date_parts) == 1:
                year = int(date_parts[0])
                start_date = datetime.datetime(year, 1, 1, 0, 0)
                end_date = datetime.datetime(year + 1, 1, 1, 0, 0)
                time_condition = "WHERE a.create_time >= %s AND a.create_time < %s"
                params = (start_date, end_date)
            else:
                return jsonify({"error": "Invalid date format"}), 400
        else:
            # 如果没有传递 date 参数，则统计全部数据
            time_condition = ""
            params = ()
            logger.info("[DB QUERY] Calculating statistics for ALL time")

        # 构建基础查询 SQL，关联医生和科室
        sql = """
            SELECT a.create_time
            FROM appointments a
            LEFT JOIN doctors d ON a.doctor_id = d.id
            LEFT JOIN departments dept ON a.department_id = dept.id
            {}
        """.format(time_condition)

        cursor.execute(sql, params)
        rows = cursor.fetchall()

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
        logger.info(f"[STATS RESULT] Hourly counts: {stats}")

        # --- 3. 写入缓存 ---
        redis_client.set(cache_key, json.dumps(stats), ex=600)

        return jsonify(stats)

    except Exception as e:
        logger.error(f"[ERROR] Statistics calculation failed: {str(e)}")
        return jsonify({"error": str(e)}), 500

    finally:
        if cursor: cursor.close()
        if conn: conn.close()


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

        # 只记录关键意图，不打印包含描述等敏感信息的完整 JSON
        logger.info(f"[ACTION] New appointment request - Patient: {patient_id}, Dept: {dept_id}")

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
                logger.warning(f"[BLOCK] Duplicate appointment blocked for Patient {patient_id}")
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
                logger.info(f"[AUTO ASSIGN] Assigned Doctor {doctor_id} to appointment")
            else:
                logger.warning(f"[BLOCK] No doctors available in Dept {dept_id}")
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

        # 清除统计缓存
        for key in redis_client.scan_iter("appt:stats:*"):
            redis_client.delete(key)

        logger.info(f"[SUCCESS] Appointment created. ID: {data.get('id')}")
        return jsonify({"success": True, "message": f"挂号成功，已分配医生ID: {doctor_id}"})

    except Exception as e:
        if conn: conn.rollback()
        logger.error(f"[ERROR] Create appointment failed: {str(e)}")
        return jsonify({"success": False, "message": str(e)}), 500

    finally:
        if cursor: cursor.close()
        if conn: conn.close()


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
        # 清晰记录状态流转
        logger.info(f"[ACTION] Update Appointment {apt_id} -> Status: {new_status}")

        sql = "UPDATE appointments SET status = %s WHERE id = %s"
        cursor.execute(sql, (data.get('status'), apt_id))

        conn.commit()

        # 清除统计缓存
        for key in redis_client.scan_iter("appt:stats:*"):
            redis_client.delete(key)

        return jsonify({"success": True, "message": "挂号状态已更新"})

    except Exception as e:
        if conn: conn.rollback()
        logger.error(f"[ERROR] Update status failed for {apt_id}: {str(e)}")
        return jsonify({"success": False, "message": str(e)}), 500

    finally:
        if cursor: cursor.close()
        if conn: conn.close()

# --- END OF FILE app/api/appointment.py ---
