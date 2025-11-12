import express from 'express';
import dotenv from 'dotenv';
import './config/redisClient.js';
import pool from './config/db.js';
import cors from 'cors';
import authRoutes from './routes/auth/auth.js';


dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.use('/auth', authRoutes);


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`服务启动${PORT}`);
});