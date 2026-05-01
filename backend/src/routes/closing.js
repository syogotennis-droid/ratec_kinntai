const express = require('express');
const router = express.Router();
const { db } = require('../database');
const { authMiddleware, adminMiddleware } = require('../auth');

router.get('/:yearMonth', authMiddleware, adminMiddleware, (req, res) => {
  const users = db.prepare('SELECT * FROM users WHERE is_active=1').all();
  const result = users.map(u => {
    const c = db.prepare('SELECT * FROM monthly_closings WHERE year_month=? AND user_id=?').get(req.params.yearMonth, u.id);
    return { user_id: u.id, user_name: u.name, employee_id: u.employee_id, year_month: req.params.yearMonth, status: c?.status || 'open', closed_at: c?.closed_at || null };
  });
  res.json(result);
});

router.post('/:yearMonth/:userId/close', authMiddleware, adminMiddleware, (req, res) => {
  const { yearMonth, userId } = req.params;
  db.prepare(`INSERT INTO monthly_closings (year_month,user_id,status,closed_at,closed_by) VALUES (?,?,'closed',datetime('now','localtime'),?) ON CONFLICT(year_month,user_id) DO UPDATE SET status='closed',closed_at=datetime('now','localtime'),closed_by=?`)
    .run(yearMonth, userId, req.user.id, req.user.id);
  res.json({ message: '締め処理が完了しました' });
});

router.post('/:yearMonth/:userId/reopen', authMiddleware, adminMiddleware, (req, res) => {
  const { yearMonth, userId } = req.params;
  db.prepare(`INSERT INTO monthly_closings (year_month,user_id,status) VALUES (?,?,'open') ON CONFLICT(year_month,user_id) DO UPDATE SET status='open',closed_at=null`)
    .run(yearMonth, userId);
  res.json({ message: '締め解除しました' });
});

router.post('/:yearMonth/close-all', authMiddleware, adminMiddleware, (req, res) => {
  const { yearMonth } = req.params;
  const users = db.prepare('SELECT id FROM users WHERE is_active=1').all();
  const stmt = db.prepare(`INSERT INTO monthly_closings (year_month,user_id,status,closed_at,closed_by) VALUES (?,?,'closed',datetime('now','localtime'),?) ON CONFLICT(year_month,user_id) DO UPDATE SET status='closed',closed_at=datetime('now','localtime'),closed_by=?`);
  const tx = db.transaction(() => { for (const u of users) stmt.run(yearMonth, u.id, req.user.id, req.user.id); });
  tx();
  res.json({ message: `${users.length}名の締め処理が完了しました` });
});

module.exports = router;
