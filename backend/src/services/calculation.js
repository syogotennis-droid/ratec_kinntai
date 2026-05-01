'use strict';

function parseTimeToMinutes(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

function calculateActualMinutes(startStr, endStr, breakMinutes) {
  let start = parseTimeToMinutes(startStr);
  let end = parseTimeToMinutes(endStr);
  if (end <= start) end += 24 * 60; // overnight shift
  return Math.max(0, end - start - (breakMinutes || 0));
}

function calculateLateNightMinutes(startStr, endStr) {
  // Late night: 22:00 to 05:00 (next day = 29:00 in minutes)
  let start = parseTimeToMinutes(startStr);
  let end = parseTimeToMinutes(endStr);
  if (end <= start) end += 24 * 60;
  const lnStart = 22 * 60;
  const lnEnd = 29 * 60;
  const overlapStart = Math.max(start, lnStart);
  const overlapEnd = Math.min(end, lnEnd);
  return Math.max(0, overlapEnd - overlapStart);
}

function aggregateMonthlyHours(workRecords, regularHoursPerDay = 8.0) {
  let totalMinutes = 0, lateNightMinutes = 0, holidayMinutes = 0, workDays = 0;
  for (const r of workRecords) {
    if (r.actual_minutes == null) continue;
    if (r.work_type === 'holiday') holidayMinutes += r.actual_minutes;
    else totalMinutes += r.actual_minutes;
    lateNightMinutes += calculateLateNightMinutes(r.start_time, r.end_time);
    workDays++;
  }
  const regularLimit = regularHoursPerDay * 60;
  const overtimeMinutes = Math.max(0, totalMinutes - workDays * regularLimit);
  const regularMinutes = totalMinutes - overtimeMinutes;
  const round2 = v => Math.round(v * 100) / 100;
  return {
    regular_hours: round2(regularMinutes / 60),
    overtime_hours: round2(overtimeMinutes / 60),
    late_night_hours: round2(lateNightMinutes / 60),
    holiday_hours: round2(holidayMinutes / 60),
    total_hours: round2((totalMinutes + holidayMinutes) / 60),
    work_days: workDays,
  };
}

module.exports = { parseTimeToMinutes, calculateActualMinutes, calculateLateNightMinutes, aggregateMonthlyHours };
