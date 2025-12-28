# backend/Dockerfile
FROM python:3.9-slim

WORKDIR /app

# 安装系统依赖（如果 mysqlclient 需要编译）
RUN apt-get update && apt-get install -y default-libmysqlclient-dev build-essential pkg-config

# 复制依赖并安装
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
# 生产环境建议安装 gunicorn
RUN pip install gunicorn

# 复制后端代码
COPY . .

COPY entrypoint.sh /entrypoint.sh
# 赋予执行权限
RUN chmod +x /entrypoint.sh

# 设置 Entrypoint
ENTRYPOINT ["/entrypoint.sh"]

# 暴露端口
EXPOSE 5000

# 启动命令 (开发环境可用 python run.py，生产环境用 gunicorn)
CMD ["gunicorn", "-w", "4", "-b", "0.0.0.0:5000", "run:app"]