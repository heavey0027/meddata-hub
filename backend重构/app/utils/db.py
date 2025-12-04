import mysql.connector
from mysql.connector import pooling

# 配置数据库连接池
db_config = {
    "pool_name": "medpool",
    "pool_size": 10,
    "host": "localhost",
    "user": "root",
    "password": "root", # 请修改此处
    "database": "meddata_hub",
    "autocommit": False          # 关闭自动提交，以便手动控制事务
}

pool = mysql.connector.pooling.MySQLConnectionPool(**db_config)

def get_db_connection():
    """从连接池获取连接"""
    try:
        connection = pool.get_connection()
        return connection
    except mysql.connector.Error as err:
        print(f"Error getting connection: {err}")
        raise err