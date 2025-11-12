import pool from '../config/db.js';

export async function generateUniqueODACC() {
  let odacc;
  let exists = true;
  while (exists) {
    const len = Math.floor(Math.random() * 3) + 6; // 6~8位
    odacc = Math.floor(10 ** (len - 1) + Math.random() * 9 * 10 ** (len - 1)).toString();
    const [rows] = await pool.query('SELECT id FROM users WHERE odacc = ?', [odacc]);
    exists = rows.length > 0;
  }
  return odacc;
}
