from flask import Blueprint, request, jsonify
from app.utils.db import get_db_connection
import logging

auth_bp = Blueprint('auth', __name__)
logger = logging.getLogger(__name__)

@auth_bp.route('/api/login', methods=['POST'])
def login():
    data = request.json
    user_id = data.get('id')
    password = data.get('password')
    role = data.get('role')  # 'patient', 'doctor', 'admin'

    conn = None
    cursor = None

    try:
        # 管理员登录(无需查库)
        if role == 'admin':
            # 管理员账号密码为硬编码
            if user_id == 'admin' and password == 'admin123':
                logger.info("Admin login successful: %s", user_id)
                return jsonify({
                    "success": True,
                    "token": "admin-session-token",
                    "user": {"id": "admin", "name": "系统管理员", "role": "admin"}
                })
            else:
                logger.warning("Admin login failed: %s", user_id)
                return jsonify({"success": False, "message": "管理员认证失败"}), 401

        # 医患登录 (查询数据库)
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
            return jsonify({
                "success": True,
                "token": f"token-{user_id}-{role}",
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
