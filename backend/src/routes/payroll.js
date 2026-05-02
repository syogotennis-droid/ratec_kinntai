const express = require('express');
const router = express.Router();
const { db } = require('../database');
const { authMiddleware, adminMiddleware } = require('../auth');
const { aggregateMonthlyHours } = require('../services/calculation');
const { calculatePayroll } = require('../services/payroll');

router.get('/:yearMonth/summary', authMiddleware, adminMiddleware, (req, res) => {
  const { yearMonth } = req.params;
  const users = db.prepare('SELECT * FROM users WHERE is_active=1').all();
  const result = users.map(u => {
    const records = db.prepare("SELECT * FROM work_records WHERE user_id=? AND work_date LIKE ?").all(u.id, `${yearMonth}-%`);
    const hours = aggregateMonthlyHours(records);
    const closing = db.prepare('SELECT status FROM monthly_closings WHERE year_month=? AND user_id=?').get(yearMonth, u.id);
    return { user_id: u.id, user_name: u.name, employee_id: u.employee_id, year_month: yearMonth, ...hours, closing_status: closing?.status || 'open' };
  });
  res.json(result);
});

router.get('/:yearMonth', authMiddleware, adminMiddleware, (req, res) => {
  const records = db.prepare(`SELECT pr.*, u.name as user_name, u.employee_id FROM payroll_records pr JOIN users u ON pr.user_id=u.id WHERE pr.year_month=? AND u.is_admin=0 ORDER BY u.employee_id`).all(req.params.yearMonth);
  res.json(records);
});

router.post('/:yearMonth/calculate', authMiddleware, adminMiddleware, (req, res) => {
  try {
    const { yearMonth } = req.params;
    const users = db.prepare('SELECT * FROM users WHERE is_active=1 AND is_admin=0').all();
    const upsert = db.prepare(`INSERT INTO payroll_records (year_month,user_id,regular_hours,overtime_hours,late_night_hours,holiday_hours,total_hours,base_salary,overtime_pay,late_night_pay,holiday_pay,transportation,allowances,deductions,gross_pay,status) VALUES (@year_month,@user_id,@regular_hours,@overtime_hours,@late_night_hours,@holiday_hours,@total_hours,@base_salary,@overtime_pay,@late_night_pay,@holiday_pay,@transportation,@allowances,@deductions,@gross_pay,'calculated') ON CONFLICT(year_month,user_id) DO UPDATE SET regular_hours=excluded.regular_hours,overtime_hours=excluded.overtime_hours,late_night_hours=excluded.late_night_hours,holiday_hours=excluded.holiday_hours,total_hours=excluded.total_hours,base_salary=excluded.base_salary,overtime_pay=excluded.overtime_pay,late_night_pay=excluded.late_night_pay,holiday_pay=excluded.holiday_pay,transportation=excluded.transportation,allowances=excluded.allowances,gross_pay=excluded.gross_pay,status='calculated',updated_at=datetime('now','localtime')`);
    const tx = db.transaction(() => {
      for (const u of users) {
        const records = db.prepare("SELECT * FROM work_records WHERE user_id=? AND work_date LIKE ?").all(u.id, `${yearMonth}-%`);
        const hours = aggregateMonthlyHours(records);
        const pay = calculatePayroll(u, hours);
        upsert.run({ year_month: yearMonth, user_id: u.id, ...hours, ...pay });
      }
    });
    tx();
    const result = db.prepare(`SELECT pr.*, u.name as user_name FROM payroll_records pr JOIN users u ON pr.user_id=u.id WHERE pr.year_month=? AND u.is_admin=0 ORDER BY u.employee_id`).all(yearMonth);
    res.json(result);
  } catch (err) {
    console.error('給与計算エラー:', err);
    res.status(500).json({ detail: '給与計算中にエラーが発生しました: ' + err.message });
  }
});

router.get('/:yearMonth/:userId', authMiddleware, (req, res) => {
  const { yearMonth, userId } = req.params;
  if (!req.user.is_admin && req.user.id !== parseInt(userId)) return res.status(403).json({ detail: '権限がありません' });
  const r = db.prepare('SELECT * FROM payroll_records WHERE year_month=? AND user_id=?').get(yearMonth, userId);
  if (!r) return res.status(404).json({ detail: '給与データがありません' });
  res.json(r);
});

router.put('/:yearMonth/:userId/adjust', authMiddleware, adminMiddleware, (req, res) => {
  const { yearMonth, userId } = req.params;
  const r = db.prepare('SELECT * FROM payroll_records WHERE year_month=? AND user_id=?').get(yearMonth, userId);
  if (!r) return res.status(404).json({ detail: '給与データがありません' });
  const { allowances, deductions, additional_notes, transportation } = req.body;
  const newAllowances = allowances ?? r.allowances;
  const newDeductions = deductions ?? r.deductions;
  const newTransportation = transportation ?? r.transportation;
  const grossPay = r.base_salary + r.overtime_pay + r.late_night_pay + r.holiday_pay + newTransportation + newAllowances - newDeductions;
  db.prepare(`UPDATE payroll_records SET allowances=?,deductions=?,transportation=?,additional_notes=?,gross_pay=?,updated_at=datetime('now','localtime') WHERE year_month=? AND user_id=?`)
    .run(newAllowances, newDeductions, newTransportation, additional_notes ?? r.additional_notes, grossPay, yearMonth, userId);
  res.json(db.prepare('SELECT * FROM payroll_records WHERE year_month=? AND user_id=?').get(yearMonth, userId));
});

router.post('/:yearMonth/:userId/confirm', authMiddleware, adminMiddleware, (req, res) => {
  const { yearMonth, userId } = req.params;
  db.prepare(`UPDATE payroll_records SET status='confirmed',confirmed_at=datetime('now','localtime'),confirmed_by=? WHERE year_month=? AND user_id=?`).run(req.user.id, yearMonth, userId);
  res.json(db.prepare('SELECT * FROM payroll_records WHERE year_month=? AND user_id=?').get(yearMonth, userId));
});

module.exports = router;
