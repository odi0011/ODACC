import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

const redis = createClient({
  url: process.env.REDIS_URL || 'redis://127.0.0.1:6379'
});

redis.on('error', (err) => console.error('Redis 连接错误', err));
redis.on('connect', () => console.log('Redis 连接成功'));

await redis.connect();

export default redis;
