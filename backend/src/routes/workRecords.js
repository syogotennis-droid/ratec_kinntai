const express = require('express');
const router = express.Router();
const { db } = require('../database');
const { authMiddleware, adminMiddleware } = require('../auth');
const { calculateActualMinutes } = require('../services/calculation');

function isMonthClosed(yearMonth, userId) {
  const c = db.prepare("SELECT status FROM monthly_closings WHERE year_month=? AND user_id=?").get(yearMonth, userId);
  return c?.status === 'closed';
}

router.get('/', authMiddleware, (req, res) => {
  let { user_id, year_month } = req.query;
  if (!req.user.is_admin) user_id = req.user.id;
  let sql = 'SELECT wr.*, u.name as user_name FROM work_records wr JOIN users u ON wr.user_id=u.id WHERE 1=1';
  const params = [];
  if (user_id) { sql += ' AND wr.user_id=?'; params.push(user_id); }
  if (year_month) { sql += " AND wr.work_date LIKE ?"; params.push(`${year_month}-%`); }
  sql += ' ORDER BY wr.work_date, wr.start_time';
  res.json(db.prepare(sql).all(...params));
});

router.get('/calendar/:userId/:yearMonth', authMiddleware, (req, res) => {
  const { userId, yearMonth } = req.params;
  if (!req.user.is_admin && req.user.id !== parseInt(userId)) return res.status(403).json({ detail: '権限がありません' });
  const records = db.prepare("SELECT * FROM work_records WHERE user_id=? AND work_date LIKE ? ORDER BY work_date,start_time").all(userId, `${yearMonth}-%`);
  res.json(records);
});

router.post('/', authMiddleware, (req, res) => {
  const data = req.body;
  const yearMonth = data.work_date?.slice(0, 7);
  const userId = data.user_id || req.user.id;
  if (!req.user.is_admin && isMonthClosed(yearMonth, userId)) return res.status(400).json({ detail: 'この月は締め済みです' });
  const actual = calculateActualMinutes(data.start_time, data.end_time, data.break_minutes || 0);
  try {
    const info = db.prepare(`INSERT INTO work_records (user_id,work_date,start_time,end_time,break_minutes,actual_minutes,work_type,notes,created_by) VALUES (?,?,?,?,?,?,?,?,?)`)
      .run(userId, data.work_date, data.start_time, data.end_time, data.break_minutes || 0, actual, data.work_type || 'normal', data.notes || null, req.user.id);
    res.status(201).json(db.prepare('SELECT * FROM work_records WHERE id=?').get(info.lastInsertRowid));
  } catch (e) { res.status(400).json({ detail: e.message }); }
});

router.get('/:id', authMiddleware, (req, res) => {
  const r = db.prepare('SELECT * FROM work_records WHERE id=?').get(req.params.id);
  if (!r) return res.status(404).json({ detail: '記録が見つかりません' });
  if (!req.user.is_admin && req.user.id !== r.user_id) return res.status(403).json({ detail: '権限がありません' });
  res.json(r);
});

router.put('/:id', authMiddleware, (req, res) => {
  const r = db.prepare('SELECT * FROM work_records WHERE id=?').get(req.params.id);
  if (!r) return res.status(404).json({ detail: '記録が見つかりません' });
  if (!req.user.is_admin && req.user.id !== r.user_id) return res.status(403).json({ detail: '権限がありません' });
  const yearMonth = (req.body.work_date || r.work_date).slice(0, 7);
  if (!req.user.is_admin && isMonthClosed(yearMonth, r.user_id)) return res.status(400).json({ detail: 'この月は締め済みです' });
  const d = { ...r, ...req.body };
  const actual = calculateActualMinutes(d.start_time, d.end_time, d.break_minutes || 0);
  db.prepare(`UPDATE work_records SET work_date=?,start_time=?,end_time=?,break_minutes=?,actual_minutes=?,work_type=?,notes=?,updated_at=datetime('now','localtime') WHERE id=?`)
    .run(d.work_date, d.start_time, d.end_time, d.break_minutes, actual, d.work_type, d.notes, req.params.id);
  res.json(db.prepare('SELECT * FROM work_records WHERE id=?').get(req.params.id));
});

router.delete('/:id', authMiddleware, (req, res) => {
  const r = db.prepare('SELECT * FROM work_records WHERE id=?').get(req.params.id);
  if (!r) return res.status(404).json({ detail: '記録が見つかりません' });
  if (!req.user.is_admin && req.user.id !== r.user_id) return res.status(403).json({ detail: '権限がありません' });
  const yearMonth = r.work_date.slice(0, 7);
  if (!req.user.is_admin && isMonthClosed(yearMonth, r.user_id)) return res.status(400).json({ detail: 'この月は締め済みです' });
  db.prepare('DELETE FROM work_records WHERE id=?').run(req.params.id);
  res.json({ message: '削除しました' });
});

module.exports = router;
