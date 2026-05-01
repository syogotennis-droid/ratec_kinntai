const express = require('express');
const router = express.Router();
const { db } = require('../database');
const { authMiddleware, adminMiddleware } = require('../auth');

const BOM = '﻿';

router.get('/work-records/:yearMonth', authMiddleware, adminMiddleware, (req, res) => {
  const { yearMonth } = req.params;
  const records = db.prepare(`SELECT u.employee_id,u.name,wr.work_date,wr.start_time,wr.end_time,wr.break_minutes,wr.actual_minutes,wr.work_type,wr.notes FROM work_records wr JOIN users u ON wr.user_id=u.id WHERE wr.work_date LIKE ? ORDER BY u.employee_id,wr.work_date`).all(`${yearMonth}-%`);
  const typeMap = { normal:'通常勤務', overtime:'残業', holiday:'休日出勤', training:'研修', paid_leave:'有給休暇' };
  const header = '社員番号,氏名,勤務日,開始時刻,終了時刻,休憩時間(分),実働時間(分),勤務区分,備考';
  const rows = records.map(r => [r.employee_id,r.name,r.work_date,r.start_time,r.end_time,r.break_minutes,r.actual_minutes??'',typeMap[r.work_type]||r.work_type,r.notes||''].map(v=>`"${String(v).replace(/"/g,'""')}"`).join(','));
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="work-records-${yearMonth}.csv"`);
  res.send(BOM + [header, ...rows].join('\r\n'));
});

router.get('/payroll/:yearMonth', authMiddleware, adminMiddleware, (req, res) => {
  const { yearMonth } = req.params;
  const records = db.prepare(`SELECT u.employee_id,u.name,pr.* FROM payroll_records pr JOIN users u ON pr.user_id=u.id WHERE pr.year_month=? ORDER BY u.employee_id`).all(yearMonth);
  const header = '社員番号,氏名,通常時間,残業時間,深夜時間,休日時間,合計時間,基本給,残業代,深夜手当,休日手当,交通費,手当,控除,支給額,状態';
  const statusMap = { calculated:'計算済', confirmed:'確定済' };
  const rows = records.map(r => [r.employee_id,r.name,r.regular_hours,r.overtime_hours,r.late_night_hours,r.holiday_hours,r.total_hours,r.base_salary,r.overtime_pay,r.late_night_pay,r.holiday_pay,r.transportation,r.allowances,r.deductions,r.gross_pay,statusMap[r.status]||r.status].map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(','));
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="payroll-${yearMonth}.csv"`);
  res.send(BOM + [header, ...rows].join('\r\n'));
});

module.exports = router;
