# --- START OF FILE app/stats.py ---
from flask import Blueprint, request, jsonify
from app.utils.db import get_db_connection
import logging

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

        return jsonify({"nodes": nodes, "links": links})

    except Exception as e:
        logger.error(f"Sankey Error: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        if cursor: cursor.close()
        if conn: conn.close()
