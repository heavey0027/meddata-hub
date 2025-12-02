import mysql.connector
from faker import Faker
import random
from datetime import datetime, timedelta

# ================= 数据库配置 =================
DB_CONFIG = {
    "host": "localhost",
    "user": "root",
    "password": "root",  # <--- 请修改密码
    "database": "meddata_hub"
}

# ================= 生成规模设置 =================
NUM_PATIENTS = 800  # 患者数量
NUM_APPOINTMENTS = 3000  # 挂号数量 (大数据基础)
NUM_RECORDS = 2000  # 病历数量 (用于文本挖掘)
# ===============================================

fake = Faker('zh_CN')

# 1. 丰富多样的科室 (12个)
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

# 2. 海量药品库 (涵盖不同领域，用于关联挖掘)
MEDICINES_DATA = [
    # --- 抗生素/消炎 ---
    ('M001', '阿莫西林胶囊', 25.50, '0.25g*24粒'),
    ('M002', '头孢克肟分散片', 35.00, '6片/盒'),
    ('M003', '阿奇霉素片', 28.00, '0.25g*6片'),
    ('M004', '罗红霉素胶囊', 16.50, '150mg*10粒'),
    # --- 感冒/呼吸 ---
    ('M005', '布洛芬缓释胶囊', 18.00, '0.3g*20粒'),
    ('M006', '连花清瘟胶囊', 22.00, '24粒/盒'),
    ('M007', '复方氨酚烷胺片', 12.50, '10片/盒'),
    ('M008', '急支糖浆', 25.00, '200ml/瓶'),
    ('M009', '川贝枇杷糖浆', 19.80, '150ml/瓶'),
    # --- 消化系统 ---
    ('M010', '奥美拉唑肠溶胶囊', 15.00, '20mg*14粒'),
    ('M011', '多潘立酮片(吗丁啉)', 21.00, '10mg*30片'),
    ('M012', '蒙脱石散', 18.50, '3g*10袋'),
    # --- 心脑血管/慢性病 ---
    ('M013', '硝苯地平控释片', 32.00, '30mg*7片'),
    ('M014', '阿司匹林肠溶片', 14.00, '100mg*30片'),
    ('M015', '二甲双胍片', 8.50, '0.5g*20片'),
    ('M016', '瑞舒伐他汀钙片', 45.00, '10mg*7片'),
    ('M017', '速效救心丸', 38.00, '60粒*2瓶'),
    # --- 骨科/外伤 ---
    ('M018', '云南白药喷雾剂', 45.00, '85g/瓶'),
    ('M019', '红花油', 12.00, '20ml/瓶'),
    ('M020', '双氯芬酸钠缓释片', 22.50, '0.1g*10片'),
    ('M021', '钙尔奇D片', 55.00, '60片/瓶'),
    # --- 皮肤/外用 ---
    ('M022', '皮炎平软膏', 15.00, '20g/支'),
    ('M023', '红霉素软膏', 5.00, '10g/支'),
    ('M024', '阿昔洛韦乳膏', 8.00, '10g/支'),
    # --- 五官 ---
    ('M025', '左氧氟沙星滴眼液', 18.00, '5ml/支'),
    ('M026', '玻璃酸钠滴眼液', 35.00, '5ml/支'),
    ('M027', '复方薄荷脑滴鼻液', 12.00, '10ml/支'),
    # --- 中成药/调理 ---
    ('M028', '六味地黄丸', 18.00, '200丸/瓶'),
    ('M029', '逍遥丸', 16.00, '200丸/瓶'),
    ('M030', '板蓝根颗粒', 10.00, '20袋/包')
]

# 3. "科室-诊断" 映射逻辑 (核心：让数据看起来真实)
# 格式: '科室名': [('诊断结果', '治疗方案'), ...]
DEPT_DIAGNOSIS_MAP = {
    '心血管内科': [
        ('原发性高血压', '低盐低脂饮食，监测血压，口服降压药。'),
        ('冠状动脉粥样硬化性心脏病', '避免劳累，情绪激动，长期服用抗血小板药物。'),
        ('心律失常', '完善动态心电图，定期复查。'),
        ('心力衰竭', '限制液体入量，强心利尿治疗。')
    ],
    '呼吸内科': [
        ('急性上呼吸道感染', '多饮水，注意休息，对症治疗。'),
        ('急性支气管炎', '止咳化痰，抗感染治疗。'),
        ('慢性阻塞性肺疾病', '持续低流量吸氧，支气管扩张剂吸入。'),
        ('肺炎', '抗生素静脉滴注，卧床休息。')
    ],
    '消化内科': [
        ('慢性胃炎', '规律饮食，忌辛辣刺激，保护胃黏膜。'),
        ('十二指肠溃疡', '根除幽门螺杆菌，抑制胃酸分泌。'),
        ('反流性食管炎', '餐后避免平卧，抑酸治疗。'),
        ('急性肠胃炎', '补液，纠正电解质紊乱。')
    ],
    '神经内科': [
        ('脑梗死恢复期', '康复训练，控制三高，预防复发。'),
        ('偏头痛', '避免诱因，急性期服用止痛药。'),
        ('短暂性脑缺血发作', '抗血小板聚集，颈动脉彩超复查。')
    ],
    '骨科': [
        ('腰椎间盘突出', '卧硬板床休息，理疗，牵引。'),
        ('膝关节骨性关节炎', '减少负重，玻璃酸钠关节腔注射。'),
        ('软组织挫伤', '早期冷敷，后期热敷，活血化瘀。'),
        ('颈椎病', '纠正不良姿势，颈椎操锻炼。')
    ],
    '普外科': [
        ('急性阑尾炎', '急诊手术治疗，术后抗感染。'),
        ('甲状腺结节', '定期复查甲状腺彩超及功能。'),
        ('腹股沟疝', '择期行疝修补术。')
    ],
    '皮肤科': [
        ('湿疹', '保持皮肤清洁，外用激素类软膏。'),
        ('荨麻疹', '寻找过敏原，口服抗过敏药物。'),
        ('带状疱疹', '抗病毒，营养神经，止痛治疗。'),
        ('痤疮', '清淡饮食，维A酸乳膏外用。')
    ],
    '儿科': [
        ('小儿感冒', '监测体温，物理降温，小儿氨酚黄那敏颗粒。'),
        ('手足口病', '居家隔离，注意手卫生，观察精神状态。'),
        ('支气管肺炎', '雾化吸入，拍背排痰。')
    ],
    '眼科': [
        ('干眼症', '减少电子产品使用，人工泪液滴眼。'),
        ('结膜炎', '抗生素滴眼液，注意用眼卫生。'),
        ('屈光不正', '医学验光，配戴眼镜矫正。')
    ],
    '耳鼻喉科': [
        ('过敏性鼻炎', '鼻喷激素，口服抗组胺药。'),
        ('慢性咽炎', '清淡饮食，含片含服。'),
        ('中耳炎', '抗感染，保持耳道干燥。')
    ],
    '中医科': [
        ('气血亏虚', '中药汤剂调理，益气养血。'),
        ('脾胃不和', '健脾和胃，针灸治疗。'),
        ('失眠', '中药安神，睡前足浴。')
    ],
    '急诊科': [
        ('酒精中毒', '补液，利尿，促醒。'),
        ('急性胃肠炎', '解痉止痛，补液治疗。'),
        ('外伤清创', '清创缝合，注射破伤风抗毒素。')
    ]
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
        # 库存设置：常用药库存大(500-2000)，冷门药库存小(50-200)
        stock = random.randint(500, 2000) if m[2] < 30 else random.randint(50, 300)
        meds_with_stock.append((m[0], m[1], m[2], stock, m[3]))
    cursor.executemany("INSERT INTO medicines (id, name, price, stock, specification) VALUES (%s, %s, %s, %s, %s)",
                       meds_with_stock)


def generate_people(cursor):
    # --- 医生 (30人) ---
    print("👨‍⚕️ 生成医生团队...")
    doctors = []
    dept_map = {d[0]: d[1] for d in DEPARTMENTS}  # id -> name 映射

    # 确保每个科室至少有2个医生
    for dept_id, dept_name in dept_map.items():
        for _ in range(random.randint(2, 4)):
            d_id = f"DOC{len(doctors) + 1:03d}"
            name = fake.name()
            title = random.choices(['主任医师', '副主任医师', '主治医师'], weights=[2, 3, 5])[0]
            # 根据科室生成专业特长，不再是瞎编的
            spec_base = dept_name.replace('科', '').replace('内', '').replace('外', '')
            specialty = f"{spec_base}疑难病诊治"

            doctors.append((d_id, name, '123456', title, specialty, fake.phone_number(), dept_id))

    cursor.executemany(
        "INSERT INTO doctors (id, name, password, title, specialty, phone, department_id) VALUES (%s, %s, %s, %s, %s, %s, %s)",
        doctors)
    doc_ids = [d[0] for d in doctors]

    # --- 患者 ---
    print(f"🤒 生成 {NUM_PATIENTS} 名患者...")
    patients = []
    for i in range(1, NUM_PATIENTS + 1):
        patients.append((
            f"P{i:04d}", fake.name(), '123456',
            random.choice(['男', '女']), random.randint(1, 90),
            fake.phone_number(), fake.address(),
            fake.date_between(start_date='-3y', end_date='today')
        ))
    cursor.executemany(
        "INSERT INTO patients (id, name, password, gender, age, phone, address, create_time) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)",
        patients)
    pat_ids = [p[0] for p in patients]

    return doc_ids, pat_ids


def generate_business(cursor, doc_ids, pat_ids):
    print("📅 生成业务数据 (含复杂逻辑)...")

    # 1. 建立辅助映射
    cursor.execute("SELECT id, department_id, name FROM doctors")
    doc_info = {row[0]: {'dept_id': row[1], 'name': row[2]} for row in cursor.fetchall()}

    cursor.execute("SELECT id, name FROM departments")
    dept_name_map = {row[0]: row[1] for row in cursor.fetchall()}

    cursor.execute("SELECT id FROM medicines")
    all_med_ids = [row[0] for row in cursor.fetchall()]

    appointments = []
    records = []
    details = []

    start_date = datetime.now() - timedelta(days=365)

    # --- 更平滑真实的时间分布逻辑 ---
    # 定义 24 小时的权重分布 (索引0代表0点-1点，索引23代表23点-0点)
    # 模拟规律：深夜少 -> 早高峰猛增 -> 中午回落 -> 下午小高峰 -> 晚上渐少
    hour_weights = [
        1, 1, 1, 1, 1, 2,   # 00-05点 (深夜急诊，极少)
        5, 10,              # 06-07点 (早起排队)
        30, 40, 35, 25,     # 08-11点 (上午高峰)
        10, 15,             # 12-13点 (午休，少量)
        30, 35, 30, 20,     # 14-17点 (下午高峰)
        10, 5, 3, 2, 2, 1   # 18-23点 (晚间急诊)
    ]
    hours = list(range(24)) # [0, 1, ... 23]

    for i in range(1, NUM_APPOINTMENTS + 1):
        # 基础挂号信息
        a_id = f"APT{i:05d}"
        p_id = random.choice(pat_ids)
        doc_id = random.choice(doc_ids)
        dept_id = doc_info[doc_id]['dept_id']
        dept_name = dept_name_map[dept_id]

        # 生成平滑时间 ---
        rand_days = random.randint(0, 365)
        # 根据权重随机选择小时
        hour = random.choices(hours, weights=hour_weights, k=1)[0]
        # 随机分钟和秒，确保数据点在时间轴上均匀散开，画折线图更平滑
        minute = random.randint(0, 59)
        second = random.randint(0, 59)

        appt_time = start_date + timedelta(days=rand_days, hours=hour, minutes=minute, seconds=second)

        status = 'completed' if random.random() < 0.85 else random.choice(['pending'])

        # 描述根据科室来，不再随机
        desc_pool = ["不舒服", "复诊"]
        if "痛" in str(DEPT_DIAGNOSIS_MAP.get(dept_name, [])): desc_pool.append("疼痛")
        desc = random.choice(desc_pool)

        appointments.append((a_id, p_id, dept_id, doc_id, desc, status, appt_time))

        # 如果已完成，生成病历 (Apply Big Data Logic here!)
        if status == 'completed' and len(records) < NUM_RECORDS:
            r_id = f"REC{len(records) + 1:05d}"

            # 【核心逻辑】根据科室获取对应的诊断库
            possible_diagnoses = DEPT_DIAGNOSIS_MAP.get(dept_name, [('常规检查', '定期复查')])
            diag_result, treat_plan = random.choice(possible_diagnoses)

            records.append((r_id, p_id, doc_id, diag_result, treat_plan, appt_time.date()))

            # 生成处方 (随机1-4种药)
            # 进阶优化: 这里其实可以做一个 "疾病-药品" 映射，但为了代码不过于庞大，我们用随机
            # 但由于现在药品库分类了，虽然是随机，但数据量大时，关联规则依然能跑出来
            num_meds = random.randint(1, 4)
            chosen_meds = random.sample(all_med_ids, num_meds)

            for m_id in chosen_meds:
                d_id = f"DTL{len(details) + 1:07d}"
                details.append((d_id, r_id, m_id, '遵医嘱', '口服', random.randint(3, 14)))

    # 批量插入 (Batch Insert)
    print(f"  - 写入 {len(appointments)} 条挂号...")
    batch = 1000
    for k in range(0, len(appointments), batch):
        cursor.executemany(
            "INSERT INTO appointments (id, patient_id, department_id, doctor_id, description, status, create_time) VALUES (%s, %s, %s, %s, %s, %s, %s)",
            appointments[k:k + batch])

    print(f"  - 写入 {len(records)} 份病历...")
    for k in range(0, len(records), batch):
        cursor.executemany(
            "INSERT INTO medical_records (id, patient_id, doctor_id, diagnosis, treatment_plan, visit_date) VALUES (%s, %s, %s, %s, %s, %s)",
            records[k:k + batch])

    print(f"  - 写入 {len(details)} 条处方明细...")
    for k in range(0, len(details), batch):
        cursor.executemany(
            "INSERT INTO prescription_details (id, record_id, medicine_id, dosage, usage_info, days) VALUES (%s, %s, %s, %s, %s, %s)",
            details[k:k + batch])


def main():
    conn = None
    try:
        conn = connect_db()
        cursor = conn.cursor()
        print("🚀 大数据生成引擎启动...")

        clean_tables(cursor)
        generate_core_data(cursor)
        doc_ids, pat_ids = generate_people(cursor)
        generate_business(cursor, doc_ids, pat_ids)

        conn.commit()
        print("\n✅ 数据生成完毕！")
        print("📊 现在你可以去数据库里做这些分析了：")
        print("   1. SELECT name, stock FROM medicines ORDER BY stock ASC; (库存预警)")
        print("   2. 统计各科室挂号量占比 (饼图)")
        print("   3. 统计 '感冒' 相关的病历都开了什么药 (关联规则)")

    except Exception as e:
        print(f"❌ 错误: {e}")
        if conn: conn.rollback()
    finally:
        if conn: conn.close()


if __name__ == '__main__':
    main()