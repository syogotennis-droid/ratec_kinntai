'use strict';

function calculatePayroll(user, hours) {
  const w = user.hourly_wage || 0;
  const base = Math.round(hours.regular_hours * w);
  const overtime = Math.round(hours.overtime_hours * w * (user.overtime_rate || 1.25));
  const lateNight = Math.round(hours.late_night_hours * w * ((user.late_night_rate || 1.25) - 1));
  const holiday = Math.round(hours.holiday_hours * w * (user.holiday_rate || 1.35));
  const gross = base + overtime + lateNight + holiday + (user.transportation || 0) + (user.fixed_allowance || 0);
  return {
    base_salary: base,
    overtime_pay: overtime,
    late_night_pay: lateNight,
    holiday_pay: holiday,
    transportation: user.transportation || 0,
    allowances: user.fixed_allowance || 0,
    deductions: 0,
    gross_pay: gross,
  };
}

module.exports = { calculatePayroll };
