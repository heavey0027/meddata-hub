# --- START OF FILE app/stats.py ---
from flask import Blueprint, request, jsonify
from app.utils.db import get_db_connection
from app.utils.redis_client import redis_client  # 导入 Redis
from datetime import date, datetime
import re
import logging
import json

stats_bp = Blueprint('stats', __name__)
logger = logging.getLogger(__name__)


@stats_bp.route('/api/stats/sankey', methods=['GET'])
def get_patient_flow_sankey():
    conn = None
    cursor = None
    try:
        # --- 1. 查缓存 (1分钟) ---
        cache_key = "stats:sankey"
        cached_data = redis_client.get(cache_key)
        if cached_data:
            logger.info(f"[CACHE HIT] Sankey diagram data")
            return jsonify(json.loads(cached_data))

        # --- 2. 查库 ---
        logger.info("[DB QUERY] Calculating Sankey diagram flow...")
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        nodes = [{"name": "挂号总数"}]
        links = []

        # Step 1: 挂号 -> 科室
        logger.info("[DB STEP] 1/4 Calculating Department Flow")
        sql_dept_flow = """
            SELECT d.name AS dept_name, COUNT(a.id) AS value
            FROM appointments a
            JOIN departments d ON a.department_id = d.id
            GROUP BY d.name
            HAVING value > 0
        """
        cursor.execute(sql_dept_flow)
        dept_flows = cursor.fetchall()

        # 动态添加科室节点和连线
        for flow in dept_flows:
            dept_node_name = f"科室: {flow['dept_name']}"

            # 添加节点
            if dept_node_name not in [n['name'] for n in nodes]:
                nodes.append({"name": dept_node_name})

            # 添加连线: 挂号总数 -> 具体科室
            links.append({
                "source": "挂号总数",
                "target": dept_node_name,
                "value": flow['value']
            })

        # Step 2: 科室 -> 确诊
        logger.info("[DB STEP] 2/4 Calculating Diagnosis Flow")
        sql_diag_flow = """
            SELECT d.name AS dept_name, COUNT(r.id) AS value
            FROM appointments a
            JOIN departments d ON a.department_id = d.id
            JOIN medical_records r ON a.patient_id = r.patient_id 
                AND a.doctor_id = r.doctor_id 
                AND DATE(a.create_time) = r.visit_date
            GROUP BY d.name
            HAVING value > 0
        """
        cursor.execute(sql_diag_flow)
        diag_flows = cursor.fetchall()

        # 添加 "确诊" 节点
        nodes.append({"name": "确诊/检查"})

        for flow in diag_flows:
            dept_node_name = f"科室: {flow['dept_name']}"
            # 添加连线: 具体科室 -> 确诊
            links.append({
                "source": dept_node_name,
                "target": "确诊/检查",
                "value": flow['value']
            })

        # Step 3: 确诊 -> 开药
        logger.info("[DB STEP] 3/4 Calculating Medication Flow")
        sql_med_flow = """
            SELECT COUNT(DISTINCT r.id) AS value
            FROM medical_records r
            JOIN prescription_details pd ON r.id = pd.record_id
        """
        cursor.execute(sql_med_flow)
        med_flow = cursor.fetchone()
        med_count = med_flow['value'] if med_flow else 0

        nodes.append({"name": "开药/治疗"})

        # 添加连线: 确诊 -> 开药
        links.append({
            "source": "确诊/检查",
            "target": "开药/治疗",
            "value": med_count
        })

        # Step 4: 离院
        logger.info("[DB STEP] 4/4 Calculating Discharge Flow")
        nodes.append({"name": "离院/康复"})
        links.append({
            "source": "开药/治疗",
            "target": "离院/康复",
            "value": med_count  # 这里简化流量，保持平衡
        })

        # 计算未开药直接离院的人数 (确诊总数 - 开药总数)
        # 先算出确诊总数
        total_diag = sum(item['value'] for item in diag_flows)
        no_med_count = total_diag - med_count

        if no_med_count > 0:
            links.append({
                "source": "确诊/检查",
                "target": "离院/康复",
                "value": no_med_count
            })

        result = {"nodes": nodes, "links": links}

        logger.info(f"[DB RESULT] Sankey calculation done. Nodes: {len(nodes)}, Links: {len(links)}")

        # --- 3. 写缓存 (1分钟) ---
        redis_client.set(cache_key, json.dumps(result), ex=60)

        return jsonify(result)

    except Exception as e:
        logger.error(f"[ERROR] Sankey calculation failed: {str(e)}")
        return jsonify({"error": str(e)}), 500
    finally:
        if cursor: cursor.close()
        if conn: conn.close()

# 按月份统计患者档案数与就诊人次，并计算环比增长率
@stats_bp.route('/api/statistics/monthly', methods=['GET'])
def get_monthly_statistics():
    month_str = request.args.get('month')
    if not month_str:
        return jsonify({"success": False, "message": "参数 month 必需"}), 400

    # 解析 month 参数
    try:
        month_str = month_str.strip()
        if re.match(r'^\d{4}-\d{2}$', month_str):
            dt = datetime.strptime(month_str, "%Y-%m")
        elif re.match(r'^\d{6}$', month_str):
            dt = datetime.strptime(month_str, "%Y%m")
        elif re.match(r'^\d{4}-\d{2}-\d{2}$', month_str):
            dt = datetime.strptime(month_str, "%Y-%m-%d")
        else:
            return jsonify({"success": False, "message": "month 格式错误"}), 400
        year = dt.year
        month = dt.month
    except Exception as e:
        logger.warning(f"[BLOCK] Invalid month param: {month_str}")
        return jsonify({"success": False, "message": "month 参数解析失败"}), 400

    conn = None
    cursor = None
    try:
        # --- 1. 查缓存 (10分钟) ---
        cache_key = f"stats:monthly:{year}:{month}"
        cached_data = redis_client.get(cache_key)
        if cached_data:
            logger.info(f"[CACHE HIT] Monthly stats: {year}-{month}")
            return jsonify(json.loads(cached_data))

        # --- 2. 查库 ---
        logger.info(f"[DB QUERY] Calculating monthly stats for {year}-{month}")

        if month == 1:
            prev_year = year - 1
            prev_month = 12
        else:
            prev_year = year
            prev_month = month - 1

        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # 本月患者档案数
        cursor.execute(
            "SELECT COUNT(*) AS cnt FROM patients WHERE YEAR(create_time) = %s AND MONTH(create_time) = %s",
            (year, month)
        )
        patient_count = int(cursor.fetchone()['cnt'] or 0)

        # 上个月患者档案数
        cursor.execute(
            "SELECT COUNT(*) AS cnt FROM patients WHERE YEAR(create_time) = %s AND MONTH(create_time) = %s",
            (prev_year, prev_month)
        )
        prev_patient_count = int(cursor.fetchone()['cnt'] or 0)

        # 本月就诊人次
        cursor.execute(
            "SELECT COUNT(*) AS cnt FROM medical_records WHERE YEAR(visit_date) = %s AND MONTH(visit_date) = %s",
            (year, month)
        )
        visit_count = int(cursor.fetchone()['cnt'] or 0)

        # 上个月就诊人次
        cursor.execute(
            "SELECT COUNT(*) AS cnt FROM medical_records WHERE YEAR(visit_date) = %s AND MONTH(visit_date) = %s",
            (prev_year, prev_month)
        )
        prev_visit_count = int(cursor.fetchone()['cnt'] or 0)

        # 计算环比增长率
        def calc_growth(current, previous):
            if previous == 0: return None
            return round((current - previous) / previous * 100.0, 2)

        res = {
            "month": f"{year:04d}-{month:02d}",
            "patientCount": patient_count,
            "prevPatientCount": prev_patient_count,
            "patientCountGrowthRate": calc_growth(patient_count, prev_patient_count),
            "visitCount": visit_count,
            "prevVisitCount": prev_visit_count,
            "visitCountGrowthRate": calc_growth(visit_count, prev_visit_count)
        }

        logger.info(f"[DB RESULT] {res['month']} Stats: Patients={patient_count}, Visits={visit_count}")

        # --- 3. 写缓存 (10分钟) ---
        redis_client.set(cache_key, json.dumps(res), ex=600)

        return jsonify(res)

    except Exception as e:
        logger.error(f"[ERROR] Monthly stats failed: {str(e)}")
        return jsonify({"error": str(e)}), 500

    finally:
        if cursor: cursor.close()
        if conn: conn.close()

# --- END OF FILE app/stats.py ---
