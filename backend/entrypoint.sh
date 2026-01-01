#!/bin/bash
set -e

# 定义颜色以便在日志中快速定位
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

log_info() { echo -e "${GREEN}[INFO] $(date '+%Y-%m-%d %H:%M:%S') $1${NC}"; }
log_warn() { echo -e "${YELLOW}[WARN] $(date '+%Y-%m-%d %H:%M:%S') $1${NC}"; }
log_err() { echo -e "${RED}[ERROR] $(date '+%Y-%m-%d %H:%M:%S') $1${NC}"; }
log_step() { echo -e "${CYAN}[STEP] $1${NC}"; }

# 1. 打印环境变量 (用于调试连接配置，密码脱敏)
log_step "Checking Environment Variables..."
echo "DB_HOST: ${DB_HOST:-db}"
echo "DB_PORT: ${DB_PORT:-3306}"
echo "DB_USER: ${DB_USER:-root}"
echo "DB_NAME: ${DB_NAME:-meddata_hub}"
# 简单掩盖密码显示长度
PASS_LEN=${#DB_PASSWORD}
echo "DB_PASSWORD: (Length: ${PASS_LEN:-0}) ******"

# 2. 等待 TCP 端口连通 (网络层检查)
log_step "Network Check: Waiting for MySQL ($DB_HOST:3306) to be accessible..."
MAX_RETRIES=30
COUNT=0

# 这里也要临时关闭 set -e，因为 until 循环体里可能会通过 exit 返回非0
set +e
until python -c "import socket; s = socket.socket(socket.AF_INET, socket.SOCK_STREAM); s.settimeout(2); result = s.connect_ex(('$DB_HOST', 3306)); exit(result)" 2>/dev/null; do
  if [ $COUNT -ge $MAX_RETRIES ]; then
    log_err "Timeout waiting for MySQL at $DB_HOST:3306"
    exit 1
  fi
  echo -n "."
  sleep 2
  COUNT=$((COUNT+1))
done
set -e
echo ""
log_info "TCP Connection to MySQL successful!"

# 3. 运行 Python 诊断脚本 (应用层检查)
# 返回码定义: 
# 0 = 正常且有数据 (跳过初始化)
# 100 = 正常但无数据 (需要初始化)
# 1 = 连接失败或报错 (终止)

log_step "Database Logic Check: Running Python diagnostic script..."

# === 关键修改：暂时关闭 set -e 以捕获退出码 100 ===
set +e

python -u << END
import os
import sys
import traceback
import mysql.connector
from mysql.connector import errorcode

# 强制刷新 stdout 确保日志实时输出
def log(msg):
    print(f"[Python-Diag] {msg}", flush=True)

try:
    db_config = {
        'user': os.environ.get('DB_USER', 'root'),
        'password': os.environ.get('DB_PASSWORD', 'root'),
        'host': os.environ.get('DB_HOST', 'db'),
        'database': os.environ.get('DB_NAME', 'meddata_hub'),
        'connection_timeout': 5
    }
    
    log(f"Attempting to connect to database: {db_config['database']} at {db_config['host']}...")
    
    # 尝试连接
    cnx = mysql.connector.connect(**db_config)
    log(">> Connection successful!")
    
    cursor = cnx.cursor()
    
    # 检查表是否存在
    table_name = "doctors"
    log(f"Checking if table '{table_name}' exists and has data...")
    
    try:
        cursor.execute(f"SELECT count(*) FROM {table_name}")
        result = cursor.fetchone()
        
        if result:
            count = result[0]
            log(f">> Table '{table_name}' exists. Row count: {count}")
            
            if count == 0:
                log(">> Result: Database is empty. Requesting initialization.")
                sys.exit(100) # 需要初始化
            else:
                log(">> Result: Data already exists. Skipping initialization.")
                sys.exit(0)   # 不需要初始化
        else:
            log(">> Unexpected: Fetch returned None.")
            sys.exit(1)

    except mysql.connector.Error as err:
        # 如果是表不存在错误 (1146)，通常意味着 SQL 文件还没导入，或者需要初始化
        if err.errno == errorcode.ER_NO_SUCH_TABLE:
            log(f">> Table '{table_name}' does not exist yet.")
            log(">> Assuming fresh database or SQL init pending. Will try to initialize.")
            sys.exit(100)
        else:
            raise err

except mysql.connector.Error as err:
    print("\n" + "="*30)
    print("!!! SQL CONNECTION ERROR !!!")
    if err.errno == errorcode.ER_ACCESS_DENIED_ERROR:
        print(">> Error: Invalid Username or Password.")
    elif err.errno == errorcode.ER_BAD_DB_ERROR:
        print(f">> Error: Database '{db_config['database']}' does not exist.")
    else:
        print(f">> Error Code: {err.errno}")
        print(f">> Error Msg: {err}")
    print("="*30 + "\n", flush=True)
    sys.exit(1) # 严重错误，退出

except Exception as e:
    print("\n" + "="*30)
    print("!!! UNEXPECTED PYTHON ERROR !!!")
    traceback.print_exc()
    print("="*30 + "\n", flush=True)
    sys.exit(1)

finally:
    if 'cursor' in locals() and cursor: cursor.close()
    if 'cnx' in locals() and cnx: cnx.close()
    log("Check sequence finished.")
END

# 获取 Python 脚本退出码
STATUS=$?

# === 恢复 set -e ===
set -e

log_info "Python diagnostic script exited with code: $STATUS"

# 4. 根据退出码执行逻辑
if [ $STATUS -eq 1 ]; then
    log_err "Database check failed critically. Please check the logs above."
    exit 1
fi

if [ $STATUS -eq 100 ]; then
    log_step "Initializing Data..."
    
    echo ">> Running insert_data.py..."
    if python insert_data_python/insert_data.py; then
        log_info "Basic data inserted successfully."
    else
        log_err "Failed to run insert_data.py"
        exit 1
    fi
    
    echo ">> Running insert_multimodal.py..."
    if python insert_data_python/insert_multimodal.py; then
        log_info "Multimodal data inserted successfully."
    else
        log_warn "Failed to run insert_multimodal.py (Non-critical, continuing...)"
    fi
    
    log_info "Data initialization sequence completed."
else
    log_info "Skipping data initialization."
fi

# 5. 启动 Gunicorn
log_step "Starting Gunicorn Server..."
# 打印最终执行的命令
echo "Command: $@"
exec "$@"
