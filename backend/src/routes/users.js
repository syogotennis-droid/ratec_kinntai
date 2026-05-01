const express = require('express');
const router = express.Router();
const { db } = require('../database');
const { authMiddleware, adminMiddleware, hashPassword } = require('../auth');

const omitPassword = (u) => { const { hashed_password, ...rest } = u; return rest; };

router.get('/', authMiddleware, adminMiddleware, (req, res) => {
  const users = db.prepare('SELECT * FROM users WHERE is_active=1 ORDER BY employee_id').all();
  res.json(users.map(omitPassword));
});

router.post('/', authMiddleware, adminMiddleware, (req, res) => {
  const { password, ...data } = req.body;
  if (!password) return res.status(400).json({ detail: 'パスワードは必須です' });
  try {
    const stmt = db.prepare(`INSERT INTO users (employee_id,name,name_kana,email,hashed_password,department,employment_type,hourly_wage,daily_wage,transportation,fixed_allowance,overtime_rate,late_night_rate,holiday_rate,is_admin) VALUES (@employee_id,@name,@name_kana,@email,@hashed_password,@department,@employment_type,@hourly_wage,@daily_wage,@transportation,@fixed_allowance,@overtime_rate,@late_night_rate,@holiday_rate,@is_admin)`);
    const info = stmt.run({ ...data, hashed_password: hashPassword(password), is_admin: data.is_admin ? 1 : 0 });
    const user = db.prepare('SELECT * FROM users WHERE id=?').get(info.lastInsertRowid);
    res.status(201).json(omitPassword(user));
  } catch (e) {
    res.status(400).json({ detail: e.message });
  }
});

router.get('/:id', authMiddleware, (req, res) => {
  const id = parseInt(req.params.id);
  if (!req.user.is_admin && req.user.id !== id) return res.status(403).json({ detail: '権限がありません' });
  const user = db.prepare('SELECT * FROM users WHERE id=?').get(id);
  if (!user) return res.status(404).json({ detail: '従業員が見つかりません' });
  res.json(omitPassword(user));
});

router.put('/:id', authMiddleware, adminMiddleware, (req, res) => {
  const id = parseInt(req.params.id);
  const user = db.prepare('SELECT * FROM users WHERE id=?').get(id);
  if (!user) return res.status(404).json({ detail: '従業員が見つかりません' });
  const { password, ...data } = req.body;
  const updates = { ...data, updated_at: new Date().toISOString() };
  if (password) updates.hashed_password = hashPassword(password);
  if ('is_admin' in updates) updates.is_admin = updates.is_admin ? 1 : 0;
  const fields = Object.keys(updates).map(k => `${k}=@${k}`).join(',');
  db.prepare(`UPDATE users SET ${fields} WHERE id=@id`).run({ ...updates, id });
  res.json(omitPassword(db.prepare('SELECT * FROM users WHERE id=?').get(id)));
});

router.delete('/:id', authMiddleware, adminMiddleware, (req, res) => {
  db.prepare('UPDATE users SET is_active=0 WHERE id=?').run(req.params.id);
  res.json({ message: '無効化しました' });
});

module.exports = router;
