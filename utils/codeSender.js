import redis from '../config/redisClient.js';
import { sendVerificationEmail } from '../config/mailer.js';


export async function sendCode(target, options = {}) {
  const {
    type = 'default',
    expire = 300,
    cooldown = 60,
    codeLength = 6,
    sendFunc = sendVerificationEmail
  } = options;

  // Redis key 结构： verify:{type}:{email}
  const prefix = `verify:${type}`;
  const codeKey = `${prefix}:${target}`;
  const lockKey = `${prefix}:lock:${target}`;

  // 防刷冷却
  if (await redis.exists(lockKey)) {
    throw new Error(`请勿频繁请求验证码，请 ${cooldown} 秒后再试`);
  }

  // 生成随机验证码
  const code = Array.from({ length: codeLength }, () =>
    Math.floor(Math.random() * 10)
  ).join('');

  // 写入 Redis
  await redis.set(codeKey, code, { EX: expire });
  await redis.set(lockKey, '1', { EX: cooldown });

  // 发送邮件（可自定义发送函数）
  await sendFunc(target, code);

  return code;
}