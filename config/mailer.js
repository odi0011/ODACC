import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

export async function sendVerificationEmail(email, code) {
  const mailOptions = {
    from: `"ODI 系统" <${process.env.SMTP_USER}>`,
    to: email,
    subject: 'ODI 用户注册验证码',
    html: `
      <div style="font-family:sans-serif;">
        <h3>您的注册验证码为：</h3>
        <p style="font-size:20px;font-weight:bold;color:#007bff;">${code}</p>
        <p>该验证码有效期为 <b>5分钟</b>。</p>
      </div>
    `
  };

  await transporter.sendMail(mailOptions);
}
