import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

export function generateAccessToken(user) {
  return jwt.sign({
    id: user.id,
    email: user.email,
    odacc: user.odacc,
    role: user.role
  }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES || '2h' });
}

export function generateRefreshToken(user) {
  return jwt.sign({ id: user.id }, process.env.JWT_REFRESH_SECRET, { expiresIn: process.env.JWT_REFRESH_EXPIRES || '7d' });
}
