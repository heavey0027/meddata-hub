# --- START OF FILE app/api/auth.py ---
from flask import Blueprint, request, jsonify
from app.utils.db import get_db_connection
from app.utils.common import SECRET_KEY  # 导入 SECRET_KEY
import logging
import jwt
import datetime

# 初始化蓝图和日志
auth_bp = Blueprint('auth', __name__)
logger = logging.getLogger(__name__)

# 登录接口
@auth_bp.route('/api/login', methods=['POST'])
def login():
    data = request.json
    user_id = data.get('id')
    password = data.get('password')
    role = data.get('role')  # 'patient', 'doctor', 'admin'

    conn = None
    cursor = None

    try:
        # 管理员登录（无需查库）
        if role == 'admin':
            # 管理员账号密码为硬编码
            if user_id == 'admin' and password == 'admin123':
                logger.info("Admin login successful: %s", user_id)
                # 生成 JWT
                token = generate_jwt(user_id, role)
                return jsonify({
                    "success": True,
                    "token": token,
                    "user": {"id": "admin", "name": "系统管理员", "role": "admin"}
                })
            else:
                logger.warning("Admin login failed: %s", user_id)
                return jsonify({"success": False, "message": "管理员认证失败"}), 401

        # 医患登录（查询数据库）
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        table_name = ""
        if role == 'patient':
            table_name = "patients"
        elif role == 'doctor':
            table_name = "doctors"
        else:
            logger.warning("Invalid role: %s", role)
            return jsonify({"success": False, "message": "无效的角色"}), 400

        # 从数据库获取用户数据
        sql = f"SELECT id, name FROM {table_name} WHERE id = %s AND password = %s"
        cursor.execute(sql, (user_id, password))
        user = cursor.fetchone()

        if user:
            logger.info("User login successful: %s, Role: %s", user_id, role)
            # 生成 JWT
            token = generate_jwt(user_id, role)
            return jsonify({
                "success": True,
                "token": token,
                "user": {
                    "id": user['id'],
                    "name": user['name'],
                    "role": role
                }
            })
        else:
            logger.warning("Password mismatch for user: %s", user_id)
            return jsonify({"success": False, "message": "账号或密码错误"}), 401

    except Exception as e:
        logger.error("Login error: %s", e)
        return jsonify({"success": False, "message": "服务器内部错误"}), 500

    finally:
        if cursor: cursor.close()
        if conn: conn.close()


# 生成 JWT
def generate_jwt(user_id, role):
    # 设置 JWT 过期时间（例如 1 小时）
    expiration_time = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=1)
    payload = {
        'user_id': user_id,
        'role': role,
        'exp': expiration_time  # 设置过期时间
    }

    # 使用导入的 SECRET_KEY 来生成 JWT
    token = jwt.encode(payload, SECRET_KEY, algorithm='HS256')

    return token
# --- END OF FILE app/api/auth.py ---
