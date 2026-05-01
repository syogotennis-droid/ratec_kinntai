const { db, initDb } = require('./database');
const { hashPassword } = require('./auth');
const { calculateActualMinutes, aggregateMonthlyHours } = require('./services/calculation');
const { calculatePayroll } = require('./services/payroll');

const employees = [
  { employee_id: 'EMP001', name: '田中太郎', name_kana: 'タナカタロウ', email: 'tanaka@example.com', department: '営業部', hourly_wage: 1500, transportation: 10000 },
  { employee_id: 'EMP002', name: '佐藤花子', name_kana: 'サトウハナコ', email: 'sato@example.com', department: '事務部', hourly_wage: 1200, transportation: 8000 },
  { employee_id: 'EMP003', name: '鈴木次郎', name_kana: 'スズキジロウ', email: 'suzuki@example.com', department: '技術部', hourly_wage: 1800, transportation: 12000 },
  { employee_id: 'EMP004', name: '山田美咲', name_kana: 'ヤマダミサキ', email: 'yamada@example.com', department: '営業部', hourly_wage: 1300, transportation: 9000 },
  { employee_id: 'EMP005', name: '伊藤健二', name_kana: 'イトウケンジ', email: 'ito@example.com', department: '技術部', hourly_wage: 1600, transportation: 11000 },
];

async function main() {
  await initDb();

  for (const e of employees) {
    const exists = db.prepare('SELECT id FROM users WHERE employee_id=?').get(e.employee_id);
    if (!exists) {
      db.prepare(`INSERT INTO users (employee_id,name,name_kana,email,hashed_password,department,employment_type,hourly_wage,transportation,overtime_rate,late_night_rate,holiday_rate) VALUES (?,?,?,?,?,?,'hourly',?,?,1.25,1.25,1.35)`)
        .run(e.employee_id, e.name, e.name_kana, e.email, hashPassword('password123'), e.department, e.hourly_wage, e.transportation);
      console.log(`  従業員を作成: ${e.employee_id} ${e.name}`);
    }
  }

  const users = db.prepare("SELECT * FROM users WHERE is_admin=0 AND is_active=1").all();
  const now = new Date();

  for (let monthOffset = 1; monthOffset >= 0; monthOffset--) {
    const d = new Date(now.getFullYear(), now.getMonth() - monthOffset, 1);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const yearMonth = `${year}-${month}`;
    const daysInMonth = new Date(year, d.getMonth() + 1, 0).getDate();

    for (const u of users) {
      const existing = db.prepare("SELECT COUNT(*) as cnt FROM work_records WHERE user_id=? AND work_date LIKE ?").get(u.id, `${yearMonth}-%`);
      if (existing.cnt > 0) continue;

      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, d.getMonth(), day);
        if (date.getDay() === 0 || date.getDay() === 6) continue;

        const isOvertime = day % 7 === 3;
        const start = '09:00', end = isOvertime ? '21:00' : '18:00', breakMin = 60;
        const actual = calculateActualMinutes(start, end, breakMin);
        const workDate = `${year}-${month}-${String(day).padStart(2, '0')}`;
        db.prepare(`INSERT INTO work_records (user_id,work_date,start_time,end_time,break_minutes,actual_minutes,work_type,created_by) VALUES (?,?,?,?,?,?,?,1)`)
          .run(u.id, workDate, start, end, breakMin, actual, isOvertime ? 'overtime' : 'normal');
      }
      console.log(`  ${u.name}: ${yearMonth} 勤怠記録を追加`);
    }

    if (monthOffset === 1) {
      for (const u of users) {
        db.prepare(`INSERT INTO monthly_closings (year_month,user_id,status,closed_at,closed_by) VALUES (?,?,'closed',datetime('now','localtime'),1) ON CONFLICT(year_month,user_id) DO UPDATE SET status='closed'`)
          .run(yearMonth, u.id);
        const records = db.prepare("SELECT * FROM work_records WHERE user_id=? AND work_date LIKE ?").all(u.id, `${yearMonth}-%`);
        const hours = aggregateMonthlyHours(records);
        const pay = calculatePayroll(u, hours);
        db.prepare(`INSERT INTO payroll_records (year_month,user_id,regular_hours,overtime_hours,late_night_hours,holiday_hours,total_hours,base_salary,overtime_pay,late_night_pay,holiday_pay,transportation,allowances,deductions,gross_pay,status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'confirmed') ON CONFLICT(year_month,user_id) DO NOTHING`)
          .run(yearMonth, u.id, hours.regular_hours, hours.overtime_hours, hours.late_night_hours, hours.holiday_hours, hours.total_hours, pay.base_salary, pay.overtime_pay, pay.late_night_pay, pay.holiday_pay, pay.transportation, pay.allowances, pay.deductions, pay.gross_pay);
      }
      console.log(`  ${yearMonth} の月次締め・給与計算完了`);
    }
  }

  const total = db.prepare('SELECT COUNT(*) as cnt FROM work_records').get();
  console.log(`\n=== シード完了 ===`);
  console.log(`  従業員数: ${users.length}名`);
  console.log(`  勤怠記録: ${total.cnt}件`);
  console.log(`\nログイン情報:`);
  console.log(`  管理者  : employee_id=admin    / password=admin1234`);
  console.log(`  従業員例: employee_id=EMP001   / password=password123`);
}

main().catch(err => { console.error(err); process.exit(1); });
