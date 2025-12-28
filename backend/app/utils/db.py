import os
import mysql.connector
from mysql.connector import pooling

# 配置数据库连接池
# 优先从环境变量读取，如果没有读取到，则使用默认值（本地开发配置）
db_config = {
    "pool_name": "medpool",
    "pool_size": 32,
    "host": os.getenv("DB_HOST", "localhost"),      # Docker 中通常设为 'db'
    "port": int(os.getenv("DB_PORT", 3306)),        # 端口
    "user": os.getenv("DB_USER", "root"),           # 用户名
    "password": os.getenv("DB_PASSWORD", "root"),   # 密码
    "database": os.getenv("DB_NAME", "meddata_hub"),# 数据库名
    "autocommit": False          # 关闭自动提交，以便手动控制事务
}

# 初始化连接池
# 加上 try-catch 防止配置错误导致整个应用启动瞬间崩溃看不到报错
try:
    pool = mysql.connector.pooling.MySQLConnectionPool(**db_config)
    print(f"Database connection pool created. Host: {db_config['host']}, DB: {db_config['database']}")
except Exception as e:
    print(f"Error creating connection pool: {e}")
    pool = None

def get_db_connection():
    """从连接池获取连接"""
    if not pool:
        raise Exception("Database pool is not initialized.")
    
    try:
        connection = pool.get_connection()
        return connection
    except mysql.connector.Error as err:
        print(f"Error getting connection: {err}")
        raise err