# --- START OF FILE app/utils/common.py ---
def format_date(d):
    """辅助函数：将数据库的一行数据转换为符合驼峰命名的字典"""
    return str(d) if d else None