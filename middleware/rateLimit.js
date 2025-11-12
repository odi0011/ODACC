import redis from '../config/redisClient.js';

export function ipRateLimit({ windowSec = 60, maxRequests = 10 }) {
  return async (req, res, next) => {
    const ip = req.ip;
    const key = `rate:${ip}`;
    const current = await redis.incr(key);
    if (current === 1) await redis.expire(key, windowSec);
    if (current > maxRequests) return res.status(429).json({ message: '请求过于频繁' });
    next();
  };
}
