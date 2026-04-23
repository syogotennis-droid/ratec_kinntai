from datetime import datetime, date, time, timedelta
from typing import List


def parse_time(time_str: str) -> time:
    """Parse HH:MM string to time object"""
    h, m = map(int, time_str.split(':'))
    return time(h, m)


def calculate_actual_minutes(
    start_str: str, end_str: str, break_minutes: int, work_date: date
) -> int:
    """Calculate actual working minutes, handling overnight shifts"""
    start_dt = datetime.combine(work_date, parse_time(start_str))
    end_dt = datetime.combine(work_date, parse_time(end_str))
    if end_dt <= start_dt:  # overnight shift
        end_dt += timedelta(days=1)
    total_minutes = int((end_dt - start_dt).total_seconds() / 60)
    return max(0, total_minutes - break_minutes)


def calculate_late_night_minutes(
    start_str: str, end_str: str, work_date: date
) -> int:
    """Calculate minutes worked during late night hours (22:00-05:00)"""
    start_dt = datetime.combine(work_date, parse_time(start_str))
    end_dt = datetime.combine(work_date, parse_time(end_str))
    if end_dt <= start_dt:
        end_dt += timedelta(days=1)

    # Late night periods to check
    next_date = work_date + timedelta(days=1)
    late_night_periods = [
        (
            datetime.combine(work_date, time(22, 0)),
            datetime.combine(next_date, time(5, 0)),
        ),
    ]

    total_late_night = 0
    for ln_start, ln_end in late_night_periods:
        overlap_start = max(start_dt, ln_start)
        overlap_end = min(end_dt, ln_end)
        if overlap_end > overlap_start:
            total_late_night += int((overlap_end - overlap_start).total_seconds() / 60)

    return total_late_night


def aggregate_monthly_hours(
    work_records: list, regular_hours_per_day: float = 8.0
) -> dict:
    """
    Aggregate monthly work hours from records.
    Returns dict with regular_hours, overtime_hours, late_night_hours,
    holiday_hours, total_hours, work_days
    """
    total_minutes = 0
    late_night_minutes = 0
    holiday_minutes = 0
    work_days = 0

    for record in work_records:
        if record.actual_minutes is None:
            continue

        if record.work_type == "holiday":
            holiday_minutes += record.actual_minutes
        else:
            total_minutes += record.actual_minutes

        late_night_minutes += calculate_late_night_minutes(
            record.start_time, record.end_time, record.work_date
        )
        work_days += 1

    regular_minutes_limit = regular_hours_per_day * 60
    overtime_minutes = max(0, total_minutes - (work_days * regular_minutes_limit))
    regular_minutes = total_minutes - overtime_minutes

    return {
        "regular_hours": round(regular_minutes / 60, 2),
        "overtime_hours": round(overtime_minutes / 60, 2),
        "late_night_hours": round(late_night_minutes / 60, 2),
        "holiday_hours": round(holiday_minutes / 60, 2),
        "total_hours": round((total_minutes + holiday_minutes) / 60, 2),
        "work_days": work_days,
    }
