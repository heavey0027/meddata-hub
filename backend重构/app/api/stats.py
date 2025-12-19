# --- START OF FILE app/stats.py ---
from flask import Blueprint, request, jsonify
from app.utils.db import get_db_connection
import logging
from datetime import date, datetime
from app.utils.common import format_date
import re
from collections import defaultdict
from mysql.connector.errors import InternalError

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

@stats_bp.route('/api/stats/disease_drug_association', methods=['GET'])
def get_disease_drug_association():
    """
    通过分析病历数据，查找针对特定疾病最常使用的药物。
    返回每个疾病使用率前三的药物及其使用次数。
    参数:
        disease_keyword (str, optional): 疾病关键词，用于模糊匹配诊断。
                                      如果未提供，则返回所有疾病及其最常用药物。
        min_support (int, optional): 药物至少出现 N 次才计入结果，防止稀疏数据干扰。默认为5。
        top_n (int, optional): 返回每个疾病使用率最高的N种药物。默认为3。
    """
    conn = None
    cursor = None
    try:
        disease_keyword = request.args.get('disease_keyword', '').strip()
        min_support = int(request.args.get('min_support', 5))
        top_n = int(request.args.get('top_n', 3))

        logger.info(f"Request for disease-drug association. Keyword: '{disease_keyword}', Min Support: {min_support}, Top N: {top_n}")

        conn = get_db_connection()
        # *** 关键修改：显式设置 buffered=True 来避免 'Unread result found' 错误 ***
        cursor = conn.cursor(dictionary=True, buffered=True) 

        if not disease_keyword:
            return jsonify({
                "success": False,
                "message": "请提供疾病名称关键词 (disease_keyword) 进行查询。"
            }), 400

        sql_query = """
            SELECT
                mr.diagnosis,
                m.name AS drug_name,
                COUNT(pd.medicine_id) AS usage_count
            FROM medical_records mr
            JOIN prescription_details pd ON mr.id = pd.record_id
            JOIN medicines m ON pd.medicine_id = m.id
            WHERE mr.diagnosis LIKE %s
            GROUP BY mr.diagnosis, m.name
            HAVING COUNT(pd.medicine_id) >= %s
            ORDER BY mr.diagnosis, usage_count DESC;
        """

        cursor.execute(sql_query, (f"%{disease_keyword}%", min_support))
        results = cursor.fetchall()

        if not results:
            logger.info(f"No drug association found for disease keyword: '{disease_keyword}'")
            return jsonify({"success": True, "message": "未找到相关疾病或药物关联数据。", "data": []}), 200

        grouped_results = {}
        for row in results:
            diagnosis = row['diagnosis']
            if diagnosis not in grouped_results:
                grouped_results[diagnosis] = []
            grouped_results[diagnosis].append({
                "drug_name": row['drug_name'],
                "usage_count": row['usage_count']
            })

        response_data = []
        for diag, drugs_for_diag in grouped_results.items():
            response_data.append({
                "diagnosis": diag,
                "top_drugs": drugs_for_diag[:top_n]
            })

        logger.info(f"Successfully retrieved top {top_n} drug associations for '{disease_keyword}'. Found {len(response_data)} unique diagnoses.")
        return jsonify({"success": True, "data": response_data}), 200

    except Exception as e:
        logger.error(f"Error fetching disease-drug association for '{disease_keyword}': {e}", exc_info=True)
        return jsonify({"success": False, "message": str(e)}), 500
    finally:
        if cursor:
            try:
                pass
            except ProgrammingError:
                pass
            cursor.close()
        if conn:
            conn.close()

@stats_bp.route('/api/stats/medicine_association', methods=['GET'])
def get_medicine_association_rules():
    """
    发现药品之间的关联规则，例如“买了药 A 的人通常也会买药 B”。
    参数:
        min_support (float, optional): 最小支持度。一个规则的左臂和右臂一起出现的频率。默认为0.001。
                                       范围 0.0 到 1.0。
        min_confidence (float, optional): 最小置信度。购买左臂的顾客购买右臂的概率。默认为0.1。
                                        范围 0.0 到 1.0。
        top_n_rules (int, optional): 返回置信度最高的N条规则。默认为5。
        # 新增参数
        medicine_name (str, optional): 可选参数，如果提供，则只返回以此药品为前项的关联规则。
    """
    conn = None
    cursor = None
    try:
        min_support = float(request.args.get('min_support', 0.001))
        min_confidence = float(request.args.get('min_confidence', 0.1))
        top_n_rules = int(request.args.get('top_n_rules', 5))
        # 新增：获取 medicine_name 参数
        query_medicine_name = request.args.get('medicine_name', '').strip()

        logger.info(f"Request for medicine association rules. Min Support: {min_support}, Min Confidence: {min_confidence}, Top N: {top_n_rules}, Query Medicine: '{query_medicine_name}'")

        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True, buffered=True)

        # 1. 从数据库获取所有处方数据
        sql_get_prescriptions = """
            SELECT
                pd.record_id,
                m.name AS medicine_name
            FROM prescription_details pd
            JOIN medicines m ON pd.medicine_id = m.id
            ORDER BY pd.record_id;
        """
        cursor.execute(sql_get_prescriptions)
        prescription_data = cursor.fetchall()

        if not prescription_data:
            return jsonify({"success": True, "message": "目前没有处方数据可用于分析。", "data": []}), 200

        # 将数据转换成“交易列表”的形式：每个 record_id 对应一个药品名称列表
        transactions = defaultdict(list)
        for row in prescription_data:
            transactions[row['record_id']].append(row['medicine_name'])

        transaction_list = list(transactions.values())
        total_transactions = len(transaction_list)

        if total_transactions == 0:
            return jsonify({"success": True, "message": "目前没有有效处方数据可用于分析。", "data": []}), 200

        # 2. 统计所有药品的出现次数 (Support of individual items)
        item_counts = defaultdict(int)
        for t in transaction_list:
            for item in set(t):
                item_counts[item] += 1

        # 3. 统计所有两两药品的共同出现次数 (Support of itemsets of size 2)
        pair_counts = defaultdict(int)
        for t in transaction_list:
            items_in_transaction = sorted(list(set(t)))
            for i in range(len(items_in_transaction)):
                for j in range(i + 1, len(items_in_transaction)):
                    pair = (items_in_transaction[i], items_in_transaction[j])
                    pair_counts[pair] += 1

        # 4. 生成关联规则并计算支持度和置信度
        all_association_rules = [] # 存储所有符合min_support/min_confidence的规则
        for (item_a, item_b), count_ab in pair_counts.items():
            support_ab = count_ab / total_transactions

            if support_ab < min_support:
                continue

            # Rule: A -> B
            if item_a in item_counts and item_counts[item_a] > 0:
                confidence_a_b = count_ab / item_counts[item_a]
                if confidence_a_b >= min_confidence:
                    lift_denom = (item_counts[item_a] / total_transactions) * (item_counts[item_b] / total_transactions)
                    lift_a_b = support_ab / lift_denom if lift_denom > 0 else float('inf')
                    all_association_rules.append({
                        "antecedent": item_a,
                        "consequent": item_b,
                        "support": round(support_ab, 4),
                        "confidence": round(confidence_a_b, 4),
                        "lift": round(lift_a_b, 4)
                    })

            # Rule: B -> A
            if item_b in item_counts and item_counts[item_b] > 0:
                confidence_b_a = count_ab / item_counts[item_b]
                if confidence_b_a >= min_confidence:
                    lift_denom = (item_counts[item_b] / total_transactions) * (item_counts[item_a] / total_transactions)
                    lift_b_a = support_ab / lift_denom if lift_denom > 0 else float('inf')
                    all_association_rules.append({
                        "antecedent": item_b,
                        "consequent": item_a,
                        "support": round(support_ab, 4),
                        "confidence": round(confidence_b_a, 4),
                        "lift": round(lift_b_a, 4)
                    })

        # 5. 过滤并排序规则 (根据 query_medicine_name 和 top_n_rules)
        filtered_rules = []
        if query_medicine_name:
            # 筛选出前项为指定药品的规则（模糊匹配）
            for rule in all_association_rules:
                if query_medicine_name.lower() in rule['antecedent'].lower():
                    # 按照您的需求，只返回药品B名称、支持度、置信度、提升度
                    filtered_rules.append({
                        "consequent_medicine_name": rule['consequent'],
                        "support": rule['support'],
                        "confidence": rule['confidence'],
                        "lift": rule['lift']
                    })
        else:
            # 如果没有指定 medicine_name，返回所有规则，但只取 top_n_rules
            for rule in all_association_rules:
                 filtered_rules.append({
                    "antecedent_medicine_name": rule['antecedent'],
                    "consequent_medicine_name": rule['consequent'],
                    "support": rule['support'],
                    "confidence": rule['confidence'],
                    "lift": rule['lift']
                 })

        # 6. 按 lift 降序排列（或 confidence），并取 top_n_rules
        # 这里对 filtered_rules 进行排序，如果filtered_rules中没有lift字段，需要调整
        if filtered_rules and 'lift' in filtered_rules[0]: # 确保字段存在再排序
            filtered_rules.sort(key=lambda x: x['lift'], reverse=True)
        # 例如：按 confidence 排序
        # filtered_rules.sort(key=lambda x: x['confidence'], reverse=True)

        return jsonify({"success": True, "data": filtered_rules[:top_n_rules]}), 200

    except Exception as e:
        logger.error(f"Error fetching medicine association rules: {e}", exc_info=True)
        return jsonify({"success": False, "message": str(e)}), 500
    finally:
        if cursor:
            try:
                cursor.close()
            except InternalError as e:
                logger.warning(f"Error closing cursor in medicine association: {e}. Attempting connection close.")
        if conn:
            try:
                conn.close()
            except InternalError as e:
                logger.warning(f"Error closing connection in medicine association: {e}.")
