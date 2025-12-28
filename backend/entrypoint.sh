#!/bin/bash
set -e

# 等待数据库准备就绪（简单的重试逻辑）
echo "Waiting for MySQL to start..."
until python -c "import socket; s = socket.socket(socket.AF_INET, socket.SOCK_STREAM); s.connect(('$DB_HOST', 3306))" 2>/dev/null; do
  echo "MySQL is unavailable - sleeping"
  sleep 2
done

echo "MySQL is up - executing command"

# 检查是否需要初始化数据
# 原理：尝试查询 users 表的一条记录，如果返回空或报错，说明表是空的或不存在（虽然 meddata_hub.sql 应该建好表了）
# 这里我们使用一个简单的标志文件，或者直接查询数据库
# 为了简单起见，我们直接运行一个 Python 小脚本来检测并插入

python << END
import os
import sys
import mysql.connector
from mysql.connector import errorcode

try:
    # 连接数据库
    cnx = mysql.connector.connect(
        user=os.environ.get('DB_USER', 'root'),
        password=os.environ.get('DB_PASSWORD', 'root'),
        host=os.environ.get('DB_HOST', 'db'),
        database=os.environ.get('DB_NAME', 'meddata_hub')
    )
    cursor = cnx.cursor()

    # 检查 doctors 表是否有数据
    cursor.execute("SELECT count(*) FROM doctors")
    count = cursor.fetchone()[0]
    
    if count == 0:
        print(">> Database is empty. Starting data initialization...")
        # 因为是在 shell 脚本中调用的 python block，这里只需退出并返回特定的状态码
        # 或者直接在这里调用插入脚本
        sys.exit(100) # 100 代表需要初始化
    else:
        print(f">> Database already contains {count} users. Skipping initialization.")
        sys.exit(0) # 0 代表不需要初始化

except mysql.connector.Error as err:
    print(f">> Error connecting to DB: {err}")
    # 如果表都不存在，说明 sql 还没执行完，暂时跳过
    sys.exit(0)
except Exception as e:
    print(f">> Unexpected error: {e}")
    sys.exit(0)
finally:
    if 'cursor' in locals(): cursor.close()
    if 'cnx' in locals(): cnx.close()
END

# 获取上面 Python 脚本的退出码
STATUS=$?

if [ $STATUS -eq 100 ]; then
    echo ">> Running insert_data.py..."
    python insert_data_python/insert_data.py
    
    #echo ">> Running insert_sankey.py..."
    #python insert_data_python/insert_sankey.py
    
    # 如果想要其他初始化脚本，也可以在这里加
    echo ">> Running insert_multimodal.py..."
    python insert_data_python/insert_multimodal.py
    
    echo ">> Data initialization completed."
fi

# 启动主应用 (Gunicorn)
echo ">> Starting Gunicorn..."
exec "$@"