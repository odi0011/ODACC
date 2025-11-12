import jwt from 'jsonwebtoken';
import redis from '../config/redisClient.js';
import dotenv from 'dotenv';
dotenv.config();

export async function authMiddleware(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ message: '未授权，请登录' });

  const blacklisted = await redis.get(`blacklist:${token}`);
  if (blacklisted) return res.status(403).json({ message: 'Token 已失效' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(403).json({ message: '无效或过期 Token' });
  }
}

// role 权限控制
export function roleMiddleware(requiredRole) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: '未登录' });
    if (req.user.role < requiredRole) return res.status(403).json({ message: '权限不足' });
    next();
  };
}
