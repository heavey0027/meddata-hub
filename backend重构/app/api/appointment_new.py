# --- START OF FILE app/api/appointment.py ---
from flask import Blueprint, request, jsonify
from app.utils.db import get_db_connection
import logging
from collections import defaultdict
import datetime

appointment_bp = Blueprint('appointment', __name__)
logger = logging.getLogger(__name__)


# 1.7 获取预约数据(基础的多表连接)
@appointment_bp.route('/api/appointments', methods=['GET'])
def get_appointments():
    conn = None
    cursor = None
    try:
        logger.info("Request to get all appointments.")

        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        role = request.args.get('role')
        date = request.args.get('date')
        doctor_id = request.args.get('doctor_id')
        patient_id = request.args.get('patient_id')

        sql = """
            SELECT a.id AS appointment_id, a.patient_id, a.department_id, a.doctor_id, a.description, a.status, 
                   a.create_time, d.name AS doctor_name, dept.name AS department_name
            FROM appointments a
            LEFT JOIN doctors d ON a.doctor_id = d.id
            LEFT JOIN departments dept ON a.department_id = dept.id
        """

        if patient_id:
            sql += " WHERE a.patient_id = %s AND a.status = 'pending'"
            cursor.execute(sql, (patient_id,))
        elif role == 'admin' and date:
            sql += " WHERE DATE(a.create_time) = %s"
            cursor.execute(sql, (date,))
        elif doctor_id:
            cursor.execute("SELECT department_id FROM doctors WHERE id = %s", (doctor_id,))
            doctor = cursor.fetchone()
            if doctor:
                department_id = doctor['department_id']
                sql += " WHERE a.department_id = %s"
                cursor.execute(sql, (department_id,))
            else:
                return jsonify({"error": "Doctor not found"}), 404
        else:
            sql += " WHERE a.status = 'pending'"

        rows = cursor.fetchall()
        logger.info("Fetched %d appointment records from the database.", len(rows))

        data = []
        for row in rows:
            cursor.execute("SELECT name, phone, age FROM patients WHERE id = %s", (row['patient_id'],))
            patient = cursor.fetchone()
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

        logger.info("Returned data for appointments: %s", data)
        return jsonify(data)

    except Exception as e:
        logger.exception("Error occurred while fetching appointments")
        return jsonify({"error": str(e)}), 500

    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()
        logger.info("Database connection closed.")


# 1.8 新增接口：根据年、月、日统计预约数据
@appointment_bp.route('/api/appointments/statistics', methods=['GET'])
def get_appointment_statistics():
    conn = None
    cursor = None
    try:
        logger.info("Request to get appointment statistics.")

        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        date = request.args.get('date')
        role = request.args.get('role')

        logger.info("Received parameters: date=%s, role=%s", date, role)

        if date:
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
                logger.error("Invalid date format: %s", date)
                return jsonify({"error": "Invalid date format"}), 400
        else:
            time_condition = ""
            params = ()
            logger.info("No date filter provided. Fetching all data.")

        sql = """
            SELECT a.create_time
            FROM appointments a
            LEFT JOIN doctors d ON a.doctor_id = d.id
            LEFT JOIN departments dept ON a.department_id = dept.id
            {}
        """.format(time_condition)

        logger.info("Executing SQL: %s with parameters %s", sql, params)
        cursor.execute(sql, params)
        rows = cursor.fetchall()
        logger.info("Fetched %d appointment records.", len(rows))

        hourly_stats = defaultdict(int)
        for row in rows:
            create_time = row['create_time']
            if isinstance(create_time, str):
                try:
                    create_time = datetime.datetime.strptime(create_time, '%Y-%m-%d %H:%M:%S.%f')
                except ValueError:
                    create_time = datetime.datetime.strptime(create_time, '%Y-%m-%d %H:%M:%S')
            hour = create_time.hour
            hourly_stats[hour] += 1

        stats = [{"hour": hour, "count": count} for hour, count in sorted(hourly_stats.items())]
        logger.info("Hourly statistics: %s", stats)
        return jsonify(stats)

    except Exception as e:
        logger.exception("Error occurred while fetching appointment statistics")
        return jsonify({"error": str(e)}), 500

    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()
        logger.info("Database connection closed.")


# 2.4 提交挂号 (CREATE APPOINTMENT)
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
                doctor_id = res[0] if isinstance(res, (list, tuple)) else (res.get('id') if isinstance(res, dict) else None)
                logger.info("Assigned doctor ID %s to the appointment", doctor_id)
            else:
                logger.error("No available doctors in department %s", dept_id)
                return jsonify({"success": False, "message": "该科室暂无医生排班"}), 400

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
        if conn:
            conn.rollback()
        logger.exception("Error creating appointment")
        return jsonify({"success": False, "message": str(e)}), 500

    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()
        logger.info("Database connection closed.")


# 2.5 更新挂号状态 (UPDATE APPOINTMENT STATUS)
@appointment_bp.route('/api/appointments/<string:apt_id>', methods=['PUT'])
def update_appointment_status(apt_id):
    data = request.json
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        new_status = data.get('status')
        logger.info("Received update request for appointment ID: %s with new status: %s", apt_id, new_status)

        sql = "UPDATE appointments SET status = %s WHERE id = %s"
        cursor.execute(sql, (data.get('status'), apt_id))

        conn.commit()
        logger.info("Successfully updated appointment ID: %s to status: %s", apt_id, new_status)
        return jsonify({"success": True, "message": "挂号状态已更新"})

    except Exception as e:
        if conn:
            conn.rollback()
        logger.exception("Error updating appointment ID %s", apt_id)
        return jsonify({"success": False, "message": str(e)}), 500

    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()
        logger.info("Database connection closed for appointment ID: %s", apt_id)


# -------------------------
# Sankey: 患者流转（挂号 -> 科室 -> 确诊 -> 开药 -> 离院）
# 返回格式兼容 ECharts（links 中 source/target 为 name 字符串）
# 也同时返回 links_indexed（source/target 为节点索引）以兼容其他客户端
# 同时支持两条路由：/api/stats/sankey 与 /stats/sankey
# -------------------------
@appointment_bp.route('/api/stats/sankey', methods=['GET'])
@appointment_bp.route('/stats/sankey', methods=['GET'])
def get_patient_flow_sankey():
    logger.info("Request to /api/stats/sankey args=%s", request.args)
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # 1) 各科室挂号量
        sql_dept_flow = """
            SELECT d.id AS dept_id, d.name AS dept_name, COUNT(a.id) AS value
            FROM appointments a
            JOIN departments d ON a.department_id = d.id
            GROUP BY d.id, d.name
        """
        cursor.execute(sql_dept_flow)
        dept_flows = cursor.fetchall() or []
        logger.info("dept_flows: %s", dept_flows)

        # 2) 各科室确诊数（按 patient_id + 同日匹配）
        sql_diag_flow = """
            SELECT d.id AS dept_id, d.name AS dept_name, COUNT(DISTINCT r.id) AS value
            FROM appointments a
            JOIN departments d ON a.department_id = d.id
            JOIN medical_records r ON a.patient_id = r.patient_id
                AND DATE(a.create_time) = DATE(r.visit_date)
            GROUP BY d.id, d.name
        """
        cursor.execute(sql_diag_flow)
        diag_flows = cursor.fetchall() or []
        logger.info("diag_flows: %s", diag_flows)

        # 3) 各科室开药数（按确诊记录关联处方）
        sql_med_per_dept = """
            SELECT d.id AS dept_id, d.name AS dept_name, COUNT(DISTINCT r.id) AS value
            FROM appointments a
            JOIN departments d ON a.department_id = d.id
            JOIN medical_records r ON a.patient_id = r.patient_id
                AND DATE(a.create_time) = DATE(r.visit_date)
            JOIN prescription_details pd ON r.id = pd.record_id
            GROUP BY d.id, d.name
        """
        cursor.execute(sql_med_per_dept)
        med_per_dept = cursor.fetchall() or []
        logger.info("med_per_dept: %s", med_per_dept)

        med_total = sum(item['value'] for item in med_per_dept) if med_per_dept else 0
        total_diag = sum(item['value'] for item in diag_flows) if diag_flows else 0
        logger.info("med_total=%s, total_diag=%s", med_total, total_diag)

        # 构建节点：挂号总数 + 每个科室 + 确诊/检查 + 开药/治疗 + 离院/康复
        nodes = [{"name": "挂号总数"}]
        dept_names = {}
        for d in dept_flows:
            name = f"科室: {d['dept_name']}"
            # 保证不重复添加
            if name not in [n['name'] for n in nodes]:
                nodes.append({"name": name})
            dept_names[d['dept_id']] = name

        # 固定后续节点
        for fixed in ("确诊/检查", "开药/治疗", "离院/康复"):
            if {"name": fixed} not in nodes:
                nodes.append({"name": fixed})

        # 构建基于 name 的 links（适配 ECharts）
        links_named = []

        # 挂号 -> 科室
        for d in dept_flows:
            src = "挂号总数"
            tgt = dept_names.get(d['dept_id'], f"科室: {d['dept_name']}")
            val = d.get('value', 0)
            if val and val > 0:
                links_named.append({"source": src, "target": tgt, "value": val})

        # 科室 -> 确诊
        for d in diag_flows:
            src = dept_names.get(d['dept_id'], f"科室: {d['dept_name']}")
            tgt = "确诊/检查"
            val = d.get('value', 0)
            if val and val > 0:
                links_named.append({"source": src, "target": tgt, "value": val})

        # 确诊 -> 开药 (按科室开药数累加)
        for d in med_per_dept:
            src = "确诊/检查"
            tgt = "开药/治疗"
            val = d.get('value', 0)
            if val and val > 0:
                links_named.append({"source": src, "target": tgt, "value": val})

        # 开药 -> 离院
        if med_total > 0:
            links_named.append({"source": "开药/治疗", "target": "离院/康复", "value": med_total})

        # 未开药直接离院（确诊 - 开药）
        no_med = max(0, total_diag - med_total)
        if no_med > 0:
            links_named.append({"source": "确诊/检查", "target": "离院/康复", "value": no_med})

        # 记录最终构造的 nodes 和 name-based links
        logger.info("sankey nodes (count=%d)=%s", len(nodes), nodes)
        logger.info("sankey links_named (count=%d)=%s", len(links_named), links_named)

        # 同时构造 indexed 版本以备兼容其他客户端
        name_to_index = {nodes[i]['name']: i for i in range(len(nodes))}
        links_indexed = []
        for l in links_named:
            src_name = l['source']
            tgt_name = l['target']
            if src_name in name_to_index and tgt_name in name_to_index:
                links_indexed.append({
                    "source": name_to_index[src_name],
                    "target": name_to_index[tgt_name],
                    "value": l['value']
                })
            else:
                logger.warning("Link references unknown node: %s -> %s", src_name, tgt_name)

        # 返回 ECharts-friendly 的 links（name-based），并保留 indexed 版本
        return jsonify({
            "nodes": nodes,
            "links": links_named,            # ECharts 格式：source/target 为 name 字符串
            "links_indexed": links_indexed   # 兼容性：source/target 为节点索引
        })

    except Exception as e:
        logger.exception("Sankey error")
        return jsonify({"error": str(e)}), 500

    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()
        logger.info("Database connection closed for sankey.")
# --- END OF FILE app/api/appointment.py ---