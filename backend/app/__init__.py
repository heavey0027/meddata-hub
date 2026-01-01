# --- START OF FILE app/__init__.py ---
import logging
from flask import Flask, request, jsonify
from flask_cors import CORS
from app.utils.common import check_timestamp, verify_jwt

def setup_logging():
    """配置全局日志"""
    logger = logging.getLogger()
    logger.setLevel(logging.INFO)

    # 如果已经有处理器，避免重复添加
    if logger.handlers:
        return

    # 控制台处理器
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.INFO)

    # 文件处理器 (只记录 Warning 以上级别，防止日志文件爆炸)
    file_handler = logging.FileHandler('app.log', mode='a', encoding='utf-8')
    file_handler.setLevel(logging.WARNING)

    # [结构化日志] 格式优化
    formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
    console_handler.setFormatter(formatter)
    file_handler.setFormatter(formatter)

    logger.addHandler(console_handler)
    logger.addHandler(file_handler)


def create_app():
    app = Flask(__name__)
    CORS(app)  # 允许跨域
    # 设置文件大小限制，配合 Nginx
    app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024

    # 1. 初始化日志
    setup_logging()

    # 2. 注册蓝图 (导入时才加载，避免循环引用)
    from app.api.auth import auth_bp
    from app.api.basic import basic_bp
    from app.api.doctor import doctor_bp
    from app.api.patient import patient_bp
    from app.api.record import record_bp
    from app.api.appointment import appointment_bp
    from app.api.stats import stats_bp
    from app.api.multimodal import multimodal_bp

    # 统一添加前缀，或者在各蓝图中定义
    app.register_blueprint(auth_bp)  # /api/login
    app.register_blueprint(basic_bp)  # /api/departments, /api/medicines
    app.register_blueprint(doctor_bp)  # /api/doctors
    app.register_blueprint(patient_bp)  # /api/patients
    app.register_blueprint(record_bp)  # /api/records
    app.register_blueprint(appointment_bp)  # /api/appointments
    app.register_blueprint(stats_bp) # /api/stats
    app.register_blueprint(multimodal_bp)  # /api/multimodal

    @app.before_request
    def before_request():
        # [优化] 处理浏览器的 OPTIONS 预检请求，直接放行，避免触发 401
        if request.method == 'OPTIONS':
            return

        # 1. 时间戳防重放校验
        error = check_timestamp()
        if error:
            return error

        # 2. 白名单放行
        # auth.login: 登录
        # patient.create_patient: 注册
        # root.index: 健康检查
        # static: 静态资源
        public_endpoints = ['auth.login', 'patient.create_patient', 'root.index', 'static']

        # 如果 endpoint 为空(404)或在白名单中，跳过 JWT 检查
        if not request.endpoint or request.endpoint in public_endpoints:
            return

        # 3. JWT 身份校验
        result = verify_jwt()

        if isinstance(result, dict):
            # 校验通过，挂载用户信息
            request.user_data = result
        else:
            # 校验失败，返回 Response (401)
            return result

    @app.route('/')
    def index():
        return "MedData Hub API is running..."

    return app
# --- END OF FILE app/__init__.py ---