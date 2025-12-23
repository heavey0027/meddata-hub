# --- START OF FILE app/utils/common.py ---
import time
import logging
from flask import Flask, request, jsonify

def format_date(d):
    """辅助函数：将数据库的一行数据转换为符合驼峰命名的字典"""
    return str(d) if d else None

# 时间戳校验函数
def check_timestamp():
    """校验时间戳"""
    timestamp = request.args.get('_t')
    logger = logging.getLogger(__name__)  # 使用模块级日志

    # 记录收到的时间戳
    logger.info(f"Received timestamp: {timestamp}")

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

    # 记录校验过程
    logger.info(f"Current timestamp: {current_timestamp}")
    logger.info(f"Max allowed difference: {max_allowed_diff}")

    if abs(current_timestamp - timestamp) > max_allowed_diff:
        logger.warning(f"Timestamp out of range: {abs(current_timestamp - timestamp)}ms")
        return "Timestamp is too old or too far in the future", 400

    # 校验通过
    logger.info("Timestamp is valid")
    return None  # 校验通过