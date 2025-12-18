# --- START OF FILE app/stats.py ---
from flask import Blueprint, request, jsonify
from app.utils.db import get_db_connection
import logging
from datetime import date, datetime
from app.utils.common import format_date
import re

stats_bp = Blueprint('stats', __name__)
logger = logging.getLogger(__name__)

@stats_bp.route('/api/stats/sankey', methods=['GET'])
def get_patient_flow_sankey():
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # 定义桑基图的节点列表
        nodes = [{"name": "挂号总数"}]
        links = []

        # -------------------------------------------------
        # Step 1: 获取各科室挂号量 (挂号 -> 科室)
        # -------------------------------------------------
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

            # 添加节点 (去重)
            if dept_node_name not in [n['name'] for n in nodes]:
                nodes.append({"name": dept_node_name})

            # 添加连线: 挂号总数 -> 具体科室
            links.append({
                "source": "挂号总数",
                "target": dept_node_name,
                "value": flow['value']
            })

        # -------------------------------------------------
        # Step 2: 获取各科室的确诊量 (科室 -> 确诊)
        # 逻辑: 只要有 medical_records 记录就算确诊
        # -------------------------------------------------
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

        # -------------------------------------------------
        # Step 3: 获取开药量 (确诊 -> 开药)
        # 逻辑: 在 medical_records 基础上，关联 prescription_details
        # -------------------------------------------------
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
        # 注意: 确诊人数通常 >= 开药人数
        links.append({
            "source": "确诊/检查",
            "target": "开药/治疗",
            "value": med_count
        })

        # -------------------------------------------------
        # Step 4: 离院 (开药 -> 离院)
        # 逻辑: 假设开药后的人都离院了 (也可以加上未开药直接离院的逻辑，这里简化处理)
        # -------------------------------------------------
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

        logging.info(f"Nodes: {nodes}")
        logging.info(f"Links: {links}")
        return jsonify({"nodes": nodes, "links": links})

    except Exception as e:
        logger.error(f"Sankey Error: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        if cursor: cursor.close()
        if conn: conn.close()

# 新增接口：按月份统计患者档案数与就诊人次，并计算环比增长率
@stats_bp.route('/api/statistics/monthly', methods=['GET'])
def get_monthly_statistics():
    """
    请求参数:
      - month: 必需，格式支持 "YYYY-MM"、"YYYYMM"、"YYYY-MM-DD"（只取年月部分）
    返回 JSON:
      {
        "month": "YYYY-MM",
        "patientCount": int,
        "prevPatientCount": int,
        "patientCountGrowthRate": float|null,  # 百分比，保留两位小数；若上个月为0则为 null
        "visitCount": int,
        "prevVisitCount": int,
        "visitCountGrowthRate": float|null
      }
    """
    month_str = request.args.get('month')
    if not month_str:
        return jsonify({"success": False, "message": "参数 month 必需，格式例如: 2025-12"}), 400

    # 解析 month 参数，支持多种格式
    try:
        month_str = month_str.strip()
        if re.match(r'^\d{4}-\d{2}$', month_str):
            dt = datetime.strptime(month_str, "%Y-%m")
        elif re.match(r'^\d{6}$', month_str):
            dt = datetime.strptime(month_str, "%Y%m")
        elif re.match(r'^\d{4}-\d{2}-\d{2}$', month_str):
            dt = datetime.strptime(month_str, "%Y-%m-%d")
        else:
            return jsonify({"success": False, "message": "month 格式不支持，请使用 YYYY-MM 或 YYYYMM"}), 400
        year = dt.year
        month = dt.month
    except Exception as e:
        logger.warning("Invalid month parameter: %s, error: %s", month_str, str(e))
        return jsonify({"success": False, "message": "month 参数解析失败"}), 400

    # 计算上个月的年月
    if month == 1:
        prev_year = year - 1
        prev_month = 12
    else:
        prev_year = year
        prev_month = month - 1

    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # 本月患者档案数（以 patients.create_time 计）
        cursor.execute(
            "SELECT COUNT(*) AS cnt FROM patients WHERE YEAR(create_time) = %s AND MONTH(create_time) = %s",
            (year, month)
        )
        row = cursor.fetchone()
        patient_count = int(row['cnt'] if row and row['cnt'] is not None else 0)

        # 上个月患者档案数
        cursor.execute(
            "SELECT COUNT(*) AS cnt FROM patients WHERE YEAR(create_time) = %s AND MONTH(create_time) = %s",
            (prev_year, prev_month)
        )
        row = cursor.fetchone()
        prev_patient_count = int(row['cnt'] if row and row['cnt'] is not None else 0)

        # 本月就诊人次（以 medical_records.visit_date 计）
        cursor.execute(
            "SELECT COUNT(*) AS cnt FROM medical_records WHERE YEAR(visit_date) = %s AND MONTH(visit_date) = %s",
            (year, month)
        )
        row = cursor.fetchone()
        visit_count = int(row['cnt'] if row and row['cnt'] is not None else 0)

        # 上个月就诊人次
        cursor.execute(
            "SELECT COUNT(*) AS cnt FROM medical_records WHERE YEAR(visit_date) = %s AND MONTH(visit_date) = %s",
            (prev_year, prev_month)
        )
        row = cursor.fetchone()
        prev_visit_count = int(row['cnt'] if row and row['cnt'] is not None else 0)

        # 计算增长率（环比）
        def calc_growth(current, previous):
            if previous == 0:
                return None
            try:
                rate = (current - previous) / previous * 100.0
                return round(rate, 2)
            except Exception:
                return None

        patient_growth = calc_growth(patient_count, prev_patient_count)
        visit_growth = calc_growth(visit_count, prev_visit_count)

        res = {
            "month": f"{year:04d}-{month:02d}",
            "patientCount": patient_count,
            "prevPatientCount": prev_patient_count,
            "patientCountGrowthRate": patient_growth,
            "visitCount": visit_count,
            "prevVisitCount": prev_visit_count,
            "visitCountGrowthRate": visit_growth
        }

        logger.info("Monthly statistics for %s fetched: patients=%d (prev=%d), visits=%d (prev=%d)",
                    res['month'], patient_count, prev_patient_count, visit_count, prev_visit_count)

        return jsonify(res)

    except Exception as e:
        logger.error("Error fetching monthly statistics for %s: %s", month_str, str(e))
        return jsonify({"error": str(e)}), 500

    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()
        logger.info("Database connection closed for monthly statistics.")
