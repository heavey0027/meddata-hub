import redis
import os

# 从环境变量获取 Redis 配置
redis_host = os.getenv('REDIS_HOST', 'localhost')
redis_port = int(os.getenv('REDIS_PORT', 6379)) 
redis_db = int(os.getenv('REDIS_DB', 0))

# 创建 Redis 连接对象
redis_client = redis.StrictRedis(host=redis_host, port=redis_port, db=redis_db, decode_responses=True)

def get_redis_client():
    return redis_client
