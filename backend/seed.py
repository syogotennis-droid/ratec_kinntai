"""
seed.py - Populate the database with sample data for development/testing.

Usage:
    cd /home/user/ratec_kinntai/backend
    python seed.py
"""

import sys
import os
from datetime import date, timedelta
import random

# Make sure the app package is importable from this script's directory
sys.path.insert(0, os.path.dirname(__file__))

from app.database import engine, SessionLocal, Base
from app.models import User, WorkRecord, MonthlyClosing, PayrollRecord, SystemSetting
from app.auth import get_password_hash
from app.services.calculation import calculate_actual_minutes, aggregate_monthly_hours
from app.services.payroll import calculate_payroll


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def today() -> date:
    return date.today()


def current_year_month() -> str:
    t = today()
    return t.strftime("%Y-%m")


def previous_year_month() -> str:
    t = today().replace(day=1) - timedelta(days=1)
    return t.strftime("%Y-%m")


def working_days_in_month(year: int, month: int):
    """Return all Mon-Fri dates in the given month."""
    import calendar
    _, num_days = calendar.monthrange(year, month)
    days = []
    for day in range(1, num_days + 1):
        d = date(year, month, day)
        if d.weekday() < 5:  # Mon-Fri
            days.append(d)
    return days


def random_work_record(user_id: int, work_date: date, admin_id: int):
    """Generate a realistic-ish work record for the given date."""
    work_types_weights = [
        ("normal", 80),
        ("overtime", 15),
        ("paid_leave", 5),
    ]
    types, weights = zip(*work_types_weights)
    work_type = random.choices(types, weights=weights, k=1)[0]

    if work_type == "paid_leave":
        # Minimal time for paid leave marker
        start = "09:00"
        end = "18:00"
        break_minutes = 60
    elif work_type == "overtime":
        start = "09:00"
        end_hour = random.randint(19, 22)
        end = f"{end_hour:02d}:00"
        break_minutes = 60
    else:
        start_minute = random.choice([0, 0, 0, 30])
        start = f"09:{start_minute:02d}"
        end_hour = random.randint(17, 19)
        end_minute = random.choice([0, 0, 30])
        end = f"{end_hour:02d}:{end_minute:02d}"
        break_minutes = 60

    actual = calculate_actual_minutes(start, end, break_minutes, work_date)
    return WorkRecord(
        user_id=user_id,
        work_date=work_date,
        start_time=start,
        end_time=end,
        break_minutes=break_minutes,
        actual_minutes=actual,
        work_type=work_type,
        notes=None,
        created_by=admin_id,
    )


# ---------------------------------------------------------------------------
# Main seed logic
# ---------------------------------------------------------------------------

def seed():
    print("データベーステーブルを作成中...")
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        # ------------------------------------------------------------------
        # 1. Admin user (skip if already exists)
        # ------------------------------------------------------------------
        admin = db.query(User).filter(User.employee_id == "admin").first()
        if not admin:
            admin = User(
                employee_id="admin",
                name="管理者",
                name_kana="カンリシャ",
                email="admin@example.com",
                hashed_password=get_password_hash("admin1234"),
                department="管理部",
                employment_type="monthly",
                hourly_wage=0.0,
                daily_wage=0.0,
                transportation=0.0,
                fixed_allowance=0.0,
                overtime_rate=1.25,
                late_night_rate=1.25,
                holiday_rate=1.35,
                is_admin=True,
                is_active=True,
            )
            db.add(admin)
            db.flush()
            print(f"  管理者ユーザーを作成: {admin.employee_id}")
        else:
            print(f"  管理者ユーザーはすでに存在します: {admin.employee_id}")

        # ------------------------------------------------------------------
        # 2. Sample employees
        # ------------------------------------------------------------------
        sample_employees = [
            {
                "employee_id": "EMP001",
                "name": "田中 太郎",
                "name_kana": "タナカ タロウ",
                "email": "tanaka.taro@example.com",
                "password": "password123",
                "department": "営業部",
                "employment_type": "hourly",
                "hourly_wage": 1500.0,
                "transportation": 15000.0,
                "fixed_allowance": 5000.0,
            },
            {
                "employee_id": "EMP002",
                "name": "佐藤 花子",
                "name_kana": "サトウ ハナコ",
                "email": "sato.hanako@example.com",
                "password": "password123",
                "department": "経理部",
                "employment_type": "hourly",
                "hourly_wage": 1800.0,
                "transportation": 12000.0,
                "fixed_allowance": 8000.0,
            },
            {
                "employee_id": "EMP003",
                "name": "鈴木 次郎",
                "name_kana": "スズキ ジロウ",
                "email": "suzuki.jiro@example.com",
                "password": "password123",
                "department": "システム部",
                "employment_type": "hourly",
                "hourly_wage": 2000.0,
                "transportation": 20000.0,
                "fixed_allowance": 10000.0,
            },
            {
                "employee_id": "EMP004",
                "name": "山田 美咲",
                "name_kana": "ヤマダ ミサキ",
                "email": "yamada.misaki@example.com",
                "password": "password123",
                "department": "人事部",
                "employment_type": "hourly",
                "hourly_wage": 1650.0,
                "transportation": 10000.0,
                "fixed_allowance": 3000.0,
            },
            {
                "employee_id": "EMP005",
                "name": "伊藤 健二",
                "name_kana": "イトウ ケンジ",
                "email": "ito.kenji@example.com",
                "password": "password123",
                "department": "営業部",
                "employment_type": "hourly",
                "hourly_wage": 1750.0,
                "transportation": 18000.0,
                "fixed_allowance": 5000.0,
            },
        ]

        employees = []
        for emp_data in sample_employees:
            existing = db.query(User).filter(User.employee_id == emp_data["employee_id"]).first()
            if existing:
                print(f"  スキップ (既存): {emp_data['employee_id']} {emp_data['name']}")
                employees.append(existing)
                continue

            emp = User(
                employee_id=emp_data["employee_id"],
                name=emp_data["name"],
                name_kana=emp_data["name_kana"],
                email=emp_data["email"],
                hashed_password=get_password_hash(emp_data["password"]),
                department=emp_data["department"],
                employment_type=emp_data["employment_type"],
                hourly_wage=emp_data["hourly_wage"],
                daily_wage=0.0,
                transportation=emp_data["transportation"],
                fixed_allowance=emp_data["fixed_allowance"],
                overtime_rate=1.25,
                late_night_rate=1.25,
                holiday_rate=1.35,
                is_admin=False,
                is_active=True,
            )
            db.add(emp)
            db.flush()
            employees.append(emp)
            print(f"  従業員を作成: {emp.employee_id} {emp.name}")

        db.commit()

        # ------------------------------------------------------------------
        # 3. Work records for previous month and current month
        # ------------------------------------------------------------------
        prev_ym = previous_year_month()
        curr_ym = current_year_month()

        prev_year, prev_month = map(int, prev_ym.split("-"))
        curr_year, curr_month = map(int, curr_ym.split("-"))

        prev_days = working_days_in_month(prev_year, prev_month)
        # For current month, only up to yesterday
        curr_days = [
            d for d in working_days_in_month(curr_year, curr_month)
            if d < today()
        ]

        random.seed(42)  # Reproducible data

        for emp in employees:
            # Previous month: full month of records
            existing_prev = (
                db.query(WorkRecord)
                .filter(
                    WorkRecord.user_id == emp.id,
                    WorkRecord.work_date >= date(prev_year, prev_month, 1),
                    WorkRecord.work_date <= date(prev_year, prev_month, 28),
                )
                .count()
            )
            if existing_prev == 0:
                for work_date in prev_days:
                    # ~90% attendance rate
                    if random.random() < 0.90:
                        rec = random_work_record(emp.id, work_date, admin.id)
                        db.add(rec)
                print(f"  {emp.name}: {prev_ym} 勤怠記録を追加")
            else:
                print(f"  {emp.name}: {prev_ym} 勤怠記録はすでに存在します")

            # Current month: partial records
            existing_curr = (
                db.query(WorkRecord)
                .filter(
                    WorkRecord.user_id == emp.id,
                    WorkRecord.work_date >= date(curr_year, curr_month, 1),
                    WorkRecord.work_date < today(),
                )
                .count()
            )
            if existing_curr == 0 and curr_days:
                for work_date in curr_days:
                    if random.random() < 0.88:
                        rec = random_work_record(emp.id, work_date, admin.id)
                        db.add(rec)
                print(f"  {emp.name}: {curr_ym} 勤怠記録を追加")
            else:
                print(f"  {emp.name}: {curr_ym} 勤怠記録はすでに存在します (または日付なし)")

        db.commit()

        # ------------------------------------------------------------------
        # 4. Close previous month for all employees
        # ------------------------------------------------------------------
        for emp in employees:
            existing_closing = (
                db.query(MonthlyClosing)
                .filter(
                    MonthlyClosing.user_id == emp.id,
                    MonthlyClosing.year_month == prev_ym,
                )
                .first()
            )
            if not existing_closing:
                from datetime import datetime
                closing = MonthlyClosing(
                    year_month=prev_ym,
                    user_id=emp.id,
                    status="closed",
                    closed_at=datetime.utcnow(),
                    closed_by=admin.id,
                )
                db.add(closing)
        db.commit()
        print(f"  {prev_ym} の月次締めを設定しました")

        # ------------------------------------------------------------------
        # 5. Calculate payroll for previous month
        # ------------------------------------------------------------------
        from sqlalchemy import extract as sa_extract

        for emp in employees:
            existing_pr = (
                db.query(PayrollRecord)
                .filter(
                    PayrollRecord.user_id == emp.id,
                    PayrollRecord.year_month == prev_ym,
                )
                .first()
            )
            if existing_pr:
                continue

            records = (
                db.query(WorkRecord)
                .filter(
                    WorkRecord.user_id == emp.id,
                    sa_extract("year", WorkRecord.work_date) == prev_year,
                    sa_extract("month", WorkRecord.work_date) == prev_month,
                )
                .all()
            )

            hours = aggregate_monthly_hours(records)
            pay = calculate_payroll(emp, hours)

            pr = PayrollRecord(
                year_month=prev_ym,
                user_id=emp.id,
                regular_hours=hours["regular_hours"],
                overtime_hours=hours["overtime_hours"],
                late_night_hours=hours["late_night_hours"],
                holiday_hours=hours["holiday_hours"],
                total_hours=hours["total_hours"],
                base_salary=pay["base_salary"],
                overtime_pay=pay["overtime_pay"],
                late_night_pay=pay["late_night_pay"],
                holiday_pay=pay["holiday_pay"],
                transportation=pay["transportation"],
                allowances=pay["allowances"],
                deductions=0.0,
                gross_pay=pay["gross_pay"],
                status="confirmed",
            )
            db.add(pr)

        db.commit()
        print(f"  {prev_ym} の給与計算データを作成しました")

        # ------------------------------------------------------------------
        # 6. System settings
        # ------------------------------------------------------------------
        default_settings = [
            ("regular_hours_per_day", "8.0", "1日の所定労働時間"),
            ("overtime_threshold_monthly", "160.0", "月間残業基準時間"),
            ("late_night_start", "22:00", "深夜時間帯開始"),
            ("late_night_end", "05:00", "深夜時間帯終了"),
            ("company_name", "株式会社サンプル", "会社名"),
        ]
        for key, value, description in default_settings:
            existing = db.query(SystemSetting).filter(SystemSetting.key == key).first()
            if not existing:
                db.add(SystemSetting(key=key, value=value, description=description))
        db.commit()
        print("  システム設定を作成しました")

        # ------------------------------------------------------------------
        # Summary
        # ------------------------------------------------------------------
        total_users = db.query(User).count()
        total_records = db.query(WorkRecord).count()
        total_payroll = db.query(PayrollRecord).count()

        print("\n=== シードデータ完了 ===")
        print(f"  ユーザー総数     : {total_users}")
        print(f"  勤怠記録総数     : {total_records}")
        print(f"  給与記録総数     : {total_payroll}")
        print("\nデフォルトログイン情報:")
        print("  管理者  : employee_id=admin      / password=admin1234")
        print("  従業員例: employee_id=EMP001     / password=password123")

    finally:
        db.close()


if __name__ == "__main__":
    seed()
