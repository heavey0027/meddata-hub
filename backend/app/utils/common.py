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
    logger = logging.getLogger(__name__)  # 使用模块级日志

    if not timestamp:
        logger.warning("Timestamp is missing")
        return "Timestamp is required", 400

    try:
        timestamp = int(timestamp)
    except ValueError:
        logger.error(f"Invalid timestamp format: {timestamp}")
        return "Invalid timestamp", 400

    current_timestamp = int(time.time() * 1000)  # 当前时间戳（毫秒）
    max_allowed_diff = 5 * 60 * 1000  # 最大允许差异：5分钟

    if abs(current_timestamp - timestamp) > max_allowed_diff:
        logger.warning(f"Timestamp out of range: {abs(current_timestamp - timestamp)}ms")
        return "Timestamp is too old or too far in the future", 400

    # 校验通过
    logger.info("Timestamp is valid")
    return None  # 校验通过

def verify_jwt():
    token = request.headers.get('Authorization')  # 获取 Authorization 头

    if not token:
        logging.warning("Token is missing!")
        return jsonify({'message': 'Token is missing!'}), 401

    try:
        token = token.split(' ')[1]  # 提取 Bearer token
        payload = jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
        return payload  # 返回解码后的 payload

    except jwt.ExpiredSignatureError:
        # 如果 JWT 已经过期，记录日志并返回 401 错误
        logger.warning("JWT expired for token: %s", token)  # 记录日志
        return jsonify({'message': 'Token has expired!'}), 401

    except jwt.InvalidTokenError:
        # 如果 JWT 无效，记录日志并返回 401 错误
        logger.warning("Invalid JWT token: %s", token)  # 记录日志
        return jsonify({'message': 'Invalid token!'}), 401

