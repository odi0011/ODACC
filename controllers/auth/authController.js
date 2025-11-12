import pool from "../../config/db.js";
import bcrypt from "bcrypt";
import redis from "../../config/redisClient.js";
import { sendCode as sendCodeUtil } from "../../utils/codeSender.js";
import { generateUniqueODACC } from "../../utils/helper.js";
import { generateAccessToken, generateRefreshToken } from "../../utils/jwt.js";

// 防刷机制
async function checkLoginAttempts(key) {
  const attempts = await redis.incr(key);
  if (attempts === 1) await redis.expire(key, 600); // 10分钟
  return attempts <= 5;
}

async function resetLoginAttempts(key) {
  await redis.del(key);
}

export async function sendCode(req, res) {
  try {
    const { email, type } = req.body;

    if (!email) return res.status(400).json({ message: "邮箱不能为空" });
    if (!type) return res.status(400).json({ message: "type 参数不能为空" });

    // 配置不同类型的有效期和冷却期
    const configMap = {
      register: { expire: 300, cooldown: 60 },
      login: { expire: 180, cooldown: 30 },
      resetPwd: { expire: 120, cooldown: 30 },
    };

    const config = configMap[type] || { expire: 300, cooldown: 60 };

    await sendCodeUtil(email, {
      type,
      expire: config.expire,
      cooldown: config.cooldown,
    });

    res.json({ success: true, message: "验证码已发送" });
  } catch (err) {
    res.status(429).json({ success: false, message: err.message });
  }
}

export async function register(req, res) {
  try {
    const {
      email,
      code,
      password,
      confirmPassword,
      nickname,
      address,
      birthday,
      gender,
    } = req.body;

    if (!email || !code || !password || !confirmPassword)
      return res.status(400).json({ message: "邮箱、验证码、密码不能为空" });

    if (password !== confirmPassword)
      return res.status(400).json({ message: "两次密码不一致" });

    if (!/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/.test(password))
      return res.status(400).json({ message: "密码至少8位，含字母和数字" });

    const realCode = await redis.get(`verify:register:${email}`);
    if (!realCode || realCode !== code)
      return res.status(400).json({ message: "验证码错误或过期" });

    const [users] = await pool.query(
      "SELECT COUNT(*) AS cnt FROM users WHERE email=?",
      [email]
    );
    if (users[0].cnt >= 3)
      return res.status(400).json({ message: "邮箱注册账号超过3个" });

    const odacc = await generateUniqueODACC();
    const hash = await bcrypt.hash(password, 10);
    const finalNickname = nickname || `用户${odacc.slice(0, 4)}`;

    await pool.query(
      "INSERT INTO users (nickname, odacc, email, password_hash, birthday, address, gender) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [
        finalNickname,
        odacc,
        email,
        hash,
        birthday || null,
        address || null,
        gender || null,
      ]
    );

    await redis.del(`verify:register:${email}`);
    res.json({ success: true, message: "注册成功", odacc });
  } catch (err) {
    res.status(500).json({ message: "注册失败", error: err.message });
  }
}

export async function login(req, res) {
  try {
    const { emailOrOdacc, password, code } = req.body;
    if (!emailOrOdacc || (!password && !code))
      return res.status(400).json({ message: "参数不足" });

    const loginKey = `login:fail:${emailOrOdacc}`;
    if (!(await checkLoginAttempts(loginKey)))
      return res.status(429).json({ message: "尝试次数过多，请10分钟后再试" });

    let user;

    if (password) {
      const [rows] = await pool.query(
        "SELECT * FROM users WHERE email=? OR odacc=? LIMIT 1",
        [emailOrOdacc, emailOrOdacc]
      );
      if (!rows.length) return res.status(400).json({ message: "用户不存在" });
      user = rows[0];
      if (!(await bcrypt.compare(password, user.password_hash)))
        return res.status(401).json({ message: "密码错误" });
    } else if (code) {
      const realCode = await redis.get(`verify:login:${emailOrOdacc}`);
      if (!realCode || realCode !== code)
        return res.status(400).json({ message: "验证码错误或过期" });

      const [rows] = await pool.query(
        "SELECT * FROM users WHERE email=? LIMIT 1",
        [emailOrOdacc]
      );
      if (!rows.length) return res.status(400).json({ message: "邮箱未注册" });
      user = rows[0];

      await redis.del(`verify:login:${emailOrOdacc}`);
    }

    await resetLoginAttempts(loginKey);

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    await redis.set(`refresh:${refreshToken}`, user.id, { EX: 7 * 24 * 3600 });

    res.json({
      success: true,
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        odacc: user.odacc,
        nickname: user.nickname,
        email: user.email,
        avatar: user.avatar,
        role: user.role,
      },
    });
  } catch (err) {
    res.status(500).json({ message: "登录失败", error: err.message });
  }
}

export async function refreshToken(req, res) {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken)
      return res.status(400).json({ message: "缺少 refreshToken" });

    const userId = await redis.get(`refresh:${refreshToken}`);
    if (!userId)
      return res.status(403).json({ message: "RefreshToken 已失效" });

    const [rows] = await pool.query("SELECT * FROM users WHERE id=? LIMIT 1", [
      userId,
    ]);
    if (!rows.length) return res.status(404).json({ message: "用户不存在" });

    const accessToken = generateAccessToken(rows[0]);
    res.json({ accessToken });
  } catch (err) {
    res.status(500).json({ message: "刷新 Token 失败", error: err.message });
  }
}

// 注销
export async function logout(req, res) {
  try {
    const token = req.headers["authorization"]?.split(" ")[1];
    const { refreshToken } = req.body;

    if (!token) return res.status(400).json({ message: "缺少 Access Token" });

    // 将 Access Token 加入黑名单，过期时间同 JWT 本身
    const decoded = jwt.decode(token);
    const exp = decoded?.exp
      ? decoded.exp - Math.floor(Date.now() / 1000)
      : 3600;
    await redis.set(`blacklist:${token}`, "1", { EX: exp });

    // 删除 Refresh Token
    if (refreshToken) await redis.del(`refresh:${refreshToken}`);

    res.json({ success: true, message: "已注销，Token 已失效" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "注销失败", error: err.message });
  }
}
