def calculate_payroll(user, hours_summary: dict) -> dict:
    """Calculate payroll from user settings and hours summary"""
    hourly_wage = user.hourly_wage

    base_salary = round(hours_summary["regular_hours"] * hourly_wage)
    overtime_pay = round(
        hours_summary["overtime_hours"] * hourly_wage * user.overtime_rate
    )
    late_night_pay = round(
        hours_summary["late_night_hours"] * hourly_wage * (user.late_night_rate - 1.0)
    )
    holiday_pay = round(
        hours_summary["holiday_hours"] * hourly_wage * user.holiday_rate
    )

    gross_pay = (
        base_salary
        + overtime_pay
        + late_night_pay
        + holiday_pay
        + user.transportation
        + user.fixed_allowance
    )

    return {
        "base_salary": base_salary,
        "overtime_pay": overtime_pay,
        "late_night_pay": late_night_pay,
        "holiday_pay": holiday_pay,
        "transportation": user.transportation,
        "allowances": user.fixed_allowance,
        "deductions": 0.0,
        "gross_pay": gross_pay,
    }
