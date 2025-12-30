# --- START OF FILE app/utils/common.py ---
import time
import logging
import jwt
from flask import Flask, request, jsonify

SECRET_KEY = 'ARE_YOU_LJF_YES_I_AM_AND_I_LOVE_DATABASE_JWT_SECRET'  # 用于加密JWT的密钥
logger = logging.getLogger(__name__)

def format_date(d):
    """辅助函数：将数据库的一行数据转换为符合驼峰命名的字典"""
    return str(d) if d else None

# 时间戳校验函数
def check_timestamp():
    """校验时间戳"""
    timestamp = request.args.get('_t')

    if not timestamp:
        logger.warning("[SECURITY] Blocked request: Missing timestamp (_t)")
        return "Timestamp is required", 400

    try:
        timestamp = int(timestamp)
    except ValueError:
        logger.error(f"[SECURITY] Invalid timestamp format: {timestamp}")
        return "Invalid timestamp", 400

    current_timestamp = int(time.time() * 1000)  # 当前时间戳（毫秒）
    max_allowed_diff = 5 * 60 * 1000  # 最大允许差异：5分钟

    time_diff = abs(current_timestamp - timestamp)
    if time_diff > max_allowed_diff:
        logger.warning(f"[SECURITY] Timestamp out of range. Diff: {time_diff}ms")
        return "Timestamp is too old or too far in the future", 400

    # 校验通过
    return None

def verify_jwt():
    auth_header = request.headers.get('Authorization')

    if not auth_header:
        logger.warning("[AUTH] Blocked: Missing Authorization header")
        return jsonify({'message': 'Token is missing!'}), 401

    try:
        # 健壮性处理：确保格式为 "Bearer <token>"
        parts = auth_header.split()
        if len(parts) != 2 or parts[0].lower() != 'bearer':
            logger.warning("[AUTH] Blocked: Invalid Authorization header format")
            return jsonify({'message': 'Invalid header format!'}), 401
        
        token = parts[1]
        payload = jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
        
        # 认证成功，记录用户身份而非 Token 本身
        logger.info(f"[AUTH] Verified User: {payload.get('user_id')} (Role: {payload.get('role')})")
        return payload  # 返回解码后的 payload

    except jwt.ExpiredSignatureError:
        #  如果 JWT 已经过期，记录日志并返回 401 错误
        logger.warning("[AUTH] Blocked: Token has expired")
        return jsonify({'message': 'Token has expired!'}), 401

    except jwt.InvalidTokenError:
        # 如果 JWT 无效，记录日志并返回 401 错误
        logger.warning("[AUTH] Blocked: Invalid token signature")
        return jsonify({'message': 'Invalid token!'}), 401
    
    except Exception as e:
        logger.error(f"[AUTH] Unexpected error: {str(e)}")
        return jsonify({'message': 'Authentication failed!'}), 500

# --- END OF FILE app/utils/common.py ---