import os
import mysql.connector
from faker import Faker
import random
from datetime import datetime, timedelta

# ================= 数据库配置 =================
DB_CONFIG = {
    "host": os.getenv("DB_HOST", "localhost"),
    "user": os.getenv("DB_USER", "root"),
    "password": os.getenv("DB_PASSWORD", "root"), # 如果你在 docker-compose 里设了 rootpassword，这里默认值无所谓，因为会读环境变量
    "database": os.getenv("DB_NAME", "meddata_hub")
}

# ================= 生成配置 =================
# 获取当前年份
current_year = datetime.now().year

# 动态生成该年的起始和结束时间
START_DATE = datetime(current_year -2, 1, 1)
END_DATE = datetime(current_year +1 , 12, 31)

# 每天挂号人数范围 (模拟每日波动)
DAILY_MIN_VISITS = 10
DAILY_MAX_VISITS = 30

NUM_PATIENTS = 800  # 患者基数
# ===============================================

fake = Faker('zh_CN')

# 1. 科室数据
DEPARTMENTS = [
    ('D001', '心血管内科', '门诊楼2F-A区'),
    ('D002', '呼吸内科', '门诊楼2F-B区'),
    ('D003', '消化内科', '门诊楼2F-C区'),
    ('D004', '神经内科', '门诊楼3F-A区'),
    ('D005', '骨科', '外科楼1F'),
    ('D006', '普外科', '外科楼2F'),
    ('D007', '皮肤科', '门诊楼4F'),
    ('D008', '儿科', '急诊楼1F'),
    ('D009', '眼科', '五官楼2F'),
    ('D010', '耳鼻喉科', '五官楼3F'),
    ('D011', '中医科', '康复楼1F'),
    ('D012', '急诊科', '急诊楼1F')
]

# 2. 药品数据
MEDICINES_DATA = [
    ('M001', '阿莫西林胶囊', 25.50, '0.25g*24粒'),
    ('M002', '头孢克肟分散片', 35.00, '6片/盒'),
    ('M003', '阿奇霉素片', 28.00, '0.25g*6片'),
    ('M004', '罗红霉素胶囊', 16.50, '150mg*10粒'),
    ('M005', '布洛芬缓释胶囊', 18.00, '0.3g*20粒'),
    ('M006', '连花清瘟胶囊', 22.00, '24粒/盒'),
    ('M007', '复方氨酚烷胺片', 12.50, '10片/盒'),
    ('M008', '急支糖浆', 25.00, '200ml/瓶'),
    ('M009', '川贝枇杷糖浆', 19.80, '150ml/瓶'),
    ('M010', '奥美拉唑肠溶胶囊', 15.00, '20mg*14粒'),
    ('M011', '多潘立酮片(吗丁啉)', 21.00, '10mg*30片'),
    ('M012', '蒙脱石散', 18.50, '3g*10袋'),
    ('M013', '硝苯地平控释片', 32.00, '30mg*7片'),
    ('M014', '阿司匹林肠溶片', 14.00, '100mg*30片'),
    ('M015', '二甲双胍片', 8.50, '0.5g*20片'),
    ('M016', '瑞舒伐他汀钙片', 45.00, '10mg*7片'),
    ('M017', '速效救心丸', 38.00, '60粒*2瓶'),
    ('M018', '云南白药喷雾剂', 45.00, '85g/瓶'),
    ('M019', '红花油', 12.00, '20ml/瓶'),
    ('M020', '双氯芬酸钠缓释片', 22.50, '0.1g*10片'),
    ('M021', '钙尔奇D片', 55.00, '60片/瓶'),
    ('M022', '皮炎平软膏', 15.00, '20g/支'),
    ('M023', '红霉素软膏', 5.00, '10g/支'),
    ('M024', '阿昔洛韦乳膏', 8.00, '10g/支'),
    ('M025', '左氧氟沙星滴眼液', 18.00, '5ml/支'),
    ('M026', '玻璃酸钠滴眼液', 35.00, '5ml/支'),
    ('M027', '复方薄荷脑滴鼻液', 12.00, '10ml/支'),
    ('M028', '六味地黄丸', 18.00, '200丸/瓶'),
    ('M029', '逍遥丸', 16.00, '200丸/瓶'),
    ('M030', '板蓝根颗粒', 10.00, '20袋/包')
]

# 3. 诊断逻辑映射
DEPT_DIAGNOSIS_MAP = {
    '心血管内科': [('原发性高血压', '低盐低脂饮食，口服降压药。'), ('冠心病', '抗血小板药物，避免劳累。')],
    '呼吸内科': [('上呼吸道感染', '多饮水，对症治疗。'), ('支气管炎', '止咳化痰，抗感染。')],
    '消化内科': [('慢性胃炎', '抑酸护胃，规律饮食。'), ('肠胃炎', '补液，纠正电解质。')],
    '神经内科': [('偏头痛', '休息，止痛治疗。'), ('脑供血不足', '改善微循环。')],
    '骨科': [('腰肌劳损', '理疗，卧床休息。'), ('骨折术后', '功能锻炼，定期复查。')],
    '普外科': [('体表肿物', '手术切除，病理检查。'), ('腹痛待查', '完善CT检查。')],
    '皮肤科': [('湿疹', '外用激素软膏，保湿。'), ('荨麻疹', '抗过敏治疗。')],
    '儿科': [('小儿发热', '物理降温，退烧药。'), ('消化不良', '益生菌调理。')],
    '眼科': [('结膜炎', '抗生素滴眼液。'), ('干眼症', '人工泪液。')],
    '耳鼻喉科': [('鼻炎', '鼻喷激素。'), ('咽炎', '清咽利喉。')],
    '中医科': [('气虚', '补中益气汤。'), ('失眠', '酸枣仁汤。')],
    '急诊科': [('急性酒精中毒', '纳洛酮促醒。'), ('外伤', '清创缝合。')]
}


def connect_db():
    return mysql.connector.connect(**DB_CONFIG)


def clean_tables(cursor):
    print("🧹 正在清空旧数据...")
    cursor.execute("SET FOREIGN_KEY_CHECKS = 0")
    tables = ['prescription_details', 'medical_records', 'appointments', 'doctors', 'patients', 'medicines',
              'departments']
    for t in tables: cursor.execute(f"TRUNCATE TABLE {t}")
    cursor.execute("SET FOREIGN_KEY_CHECKS = 1")
    print("✅ 清空完成")


def generate_core_data(cursor):
    print("🏥 插入 12 个科室...")
    cursor.executemany("INSERT INTO departments (id, name, location) VALUES (%s, %s, %s)", DEPARTMENTS)

    print(f"💊 插入 {len(MEDICINES_DATA)} 种药品...")
    meds_with_stock = []
    for m in MEDICINES_DATA:
        stock = random.randint(500, 3000)
        meds_with_stock.append((m[0], m[1], m[2], stock, m[3]))
    cursor.executemany("INSERT INTO medicines (id, name, price, stock, specification) VALUES (%s, %s, %s, %s, %s)",
                       meds_with_stock)


def generate_people(cursor):
    print("👨‍⚕️ 生成医生团队...")
    doctors = []
    dept_map = {d[0]: d[1] for d in DEPARTMENTS}

    for dept_id, dept_name in dept_map.items():
        for _ in range(random.randint(2, 5)):
            d_id = f"DOC{len(doctors) + 1:03d}"
            name = fake.name()
            title = random.choices(['主任医师', '副主任医师', '主治医师'], weights=[2, 3, 5])[0]
            doctors.append((d_id, name, '123456', title, f"{dept_name}专家", fake.phone_number(), dept_id))

    cursor.executemany(
        "INSERT INTO doctors (id, name, password, title, specialty, phone, department_id) VALUES (%s, %s, %s, %s, %s, %s, %s)",
        doctors)
    doc_ids = [d[0] for d in doctors]

    print(f"🤒 生成 {NUM_PATIENTS} 名患者...")
    patients = []
    for i in range(1, NUM_PATIENTS + 1):
        patients.append((f"P{i:04d}", fake.name(), '123456', random.choice(['男', '女']), random.randint(1, 90),
                         fake.phone_number(), fake.address(), fake.date_between(start_date='-4y', end_date='today')))
    cursor.executemany(
        "INSERT INTO patients (id, name, password, gender, age, phone, address, create_time) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)",
        patients)
    pat_ids = [p[0] for p in patients]

    return doc_ids, pat_ids


def generate_business(cursor, doc_ids, pat_ids):
    print(f"📅 正在生成 {current_year -2}-{current_year +1} 每一天的数据 (这可能需要一分钟)...")

    # 辅助映射
    cursor.execute("SELECT id, department_id, name FROM doctors")
    doc_info = {row[0]: {'dept_id': row[1], 'name': row[2]} for row in cursor.fetchall()}
    cursor.execute("SELECT id, name FROM departments")
    dept_name_map = {row[0]: row[1] for row in cursor.fetchall()}
    cursor.execute("SELECT id FROM medicines")
    all_med_ids = [row[0] for row in cursor.fetchall()]

    appointments = []
    records = []
    details = []

    # === 时间生成逻辑核心 ===
    curr_date = START_DATE
    total_days = (END_DATE - START_DATE).days + 1

    # 24小时权重 (平滑曲线)
    hour_weights = [
        0.5, 0.5, 0.5, 0.5, 0.5, 1,  # 0-5点 (极少)
        3, 8,  # 6-7点 (早起)
        25, 35, 30, 20,  # 8-11点 (早高峰)
        10, 15,  # 12-13点 (午休)
        25, 30, 25, 15,  # 14-17点 (下午高峰)
        8, 5, 3, 2, 1, 1  # 18-23点 (回落)
    ]
    hours = list(range(24))

    appt_counter = 0  # 全局计数器
    rec_counter = 0
    dtl_counter = 0

    processed_days = 0

    while curr_date <= END_DATE:
        # 显示进度
        processed_days += 1
        if processed_days % 100 == 0:
            print(f"  ...正在处理: {curr_date.strftime('%Y-%m-%d')} ({processed_days}/{total_days}天)")

        # 决定今天的挂号量 (波动)
        # 周末人稍微多一点
        is_weekend = curr_date.weekday() >= 5
        base_visits = random.randint(DAILY_MIN_VISITS, DAILY_MAX_VISITS)
        daily_visits = int(base_visits * 1.2) if is_weekend else base_visits

        for _ in range(daily_visits):
            appt_counter += 1
            a_id = f"APT{appt_counter:06d}"  # 6位数字以支持海量数据

            p_id = random.choice(pat_ids)
            doc_id = random.choice(doc_ids)
            dept_id = doc_info[doc_id]['dept_id']
            dept_name = dept_name_map[dept_id]

            # 生成具体时间 (加权小时 + 随机分秒)
            hour = random.choices(hours, weights=hour_weights, k=1)[0]
            appt_time = curr_date + timedelta(hours=hour, minutes=random.randint(0, 59), seconds=random.randint(0, 59))

            status = 'completed' if random.random() < 0.9 else 'pending'  # 90% 完成率

            desc_pool = ["不舒服", "复诊", "检查", "开药"]
            if "痛" in str(DEPT_DIAGNOSIS_MAP.get(dept_name, [])): desc_pool.append("剧烈疼痛")
            desc = random.choice(desc_pool)

            appointments.append((a_id, p_id, dept_id, doc_id, desc, status, appt_time))

            # 生成病历 (仅当状态为 completed)
            if status == 'completed':
                rec_counter += 1
                r_id = f"REC{rec_counter:06d}"
                possible_diagnoses = DEPT_DIAGNOSIS_MAP.get(dept_name, [('常规检查', '观察')])
                diag_result, treat_plan = random.choice(possible_diagnoses)

                records.append((r_id, p_id, doc_id, diag_result, treat_plan, appt_time.date()))

                # 生成处方
                num_meds = random.randint(1, 3)
                chosen_meds = random.sample(all_med_ids, num_meds)
                for m_id in chosen_meds:
                    dtl_counter += 1
                    d_id = f"DTL{dtl_counter:07d}"
                    details.append((d_id, r_id, m_id, '遵医嘱', '口服', random.randint(3, 7)))

        # 内存优化：每积累 5000 条左右插入一次，防止内存溢出
        if len(appointments) >= 5000:
            flush_to_db(cursor, appointments, records, details)
            appointments, records, details = [], [], []  # 清空缓存

        # 进入下一天
        curr_date += timedelta(days=1)

    # 插入剩余数据
    if appointments:
        flush_to_db(cursor, appointments, records, details)

    print(f"✅ 生成完毕！总计挂号: {appt_counter} 条, 病历: {rec_counter} 份")


def flush_to_db(cursor, appointments, records, details):
    # 批量插入辅助函数
    if appointments:
        cursor.executemany(
            "INSERT INTO appointments (id, patient_id, department_id, doctor_id, description, status, create_time) VALUES (%s, %s, %s, %s, %s, %s, %s)",
            appointments)
    if records:
        cursor.executemany(
            "INSERT INTO medical_records (id, patient_id, doctor_id, diagnosis, treatment_plan, visit_date) VALUES (%s, %s, %s, %s, %s, %s)",
            records)
    if details:
        cursor.executemany(
            "INSERT INTO prescription_details (id, record_id, medicine_id, dosage, usage_info, days) VALUES (%s, %s, %s, %s, %s, %s)",
            details)


def main():
    conn = None
    try:
        conn = connect_db()
        cursor = conn.cursor()
        print("🚀 超级大数据生成引擎启动...")

        clean_tables(cursor)
        generate_core_data(cursor)
        doc_ids, pat_ids = generate_people(cursor)
        generate_business(cursor, doc_ids, pat_ids)

        conn.commit()
        print("\n🎉🎉🎉 数据库构建完成！")

    except Exception as e:
        print(f"❌ 错误: {e}")
        if conn: conn.rollback()
    finally:
        if conn: conn.close()


if __name__ == '__main__':
    main()