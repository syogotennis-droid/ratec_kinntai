from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import extract
from sqlalchemy.orm import Session

from ..auth import get_current_admin_user, get_current_user
from ..database import get_db
from ..models import MonthlyClosing, PayrollRecord, User, WorkRecord
from ..schemas import MonthlySummary, PayrollAdjustment, PayrollRecordResponse
from ..services.calculation import aggregate_monthly_hours
from ..services.payroll import calculate_payroll

router = APIRouter()


def _get_year_month_parts(year_month: str):
    """Split YYYY-MM into (int year, int month), raising 400 on bad format."""
    try:
        year, month = year_month.split("-")
        return int(year), int(month)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="year_month は YYYY-MM 形式で指定してください",
        )


@router.get("/{year_month}/summary", response_model=List[MonthlySummary])
def get_monthly_summary(
    year_month: str,
    db: Session = Depends(get_db),
    _admin=Depends(get_current_admin_user),
):
    """Return a monthly summary with hours per employee (admin only)."""
    year, month = _get_year_month_parts(year_month)

    users = db.query(User).filter(User.is_active == True).all()
    summaries = []

    for user in users:
        records = (
            db.query(WorkRecord)
            .filter(
                WorkRecord.user_id == user.id,
                extract("year", WorkRecord.work_date) == year,
                extract("month", WorkRecord.work_date) == month,
            )
            .all()
        )

        hours = aggregate_monthly_hours(records)

        closing = (
            db.query(MonthlyClosing)
            .filter(
                MonthlyClosing.user_id == user.id,
                MonthlyClosing.year_month == year_month,
            )
            .first()
        )
        closing_status = closing.status if closing else "open"

        summaries.append(
            MonthlySummary(
                user_id=user.id,
                user_name=user.name,
                year_month=year_month,
                total_hours=hours["total_hours"],
                regular_hours=hours["regular_hours"],
                overtime_hours=hours["overtime_hours"],
                late_night_hours=hours["late_night_hours"],
                holiday_hours=hours["holiday_hours"],
                work_days=hours["work_days"],
                closing_status=closing_status,
            )
        )

    return summaries


@router.get("/{year_month}", response_model=List[PayrollRecordResponse])
def list_payroll_records(
    year_month: str,
    db: Session = Depends(get_db),
    _admin=Depends(get_current_admin_user),
):
    """List all payroll records for a month (admin only)."""
    return (
        db.query(PayrollRecord)
        .filter(PayrollRecord.year_month == year_month)
        .all()
    )


@router.post("/{year_month}/calculate", response_model=List[PayrollRecordResponse])
def calculate_payroll_for_month(
    year_month: str,
    db: Session = Depends(get_db),
    _admin=Depends(get_current_admin_user),
):
    """
    Calculate (or recalculate) payroll for all active users for a given month.
    Upserts a PayrollRecord per user.
    """
    year, month = _get_year_month_parts(year_month)

    users = db.query(User).filter(User.is_active == True).all()
    results = []

    for user in users:
        records = (
            db.query(WorkRecord)
            .filter(
                WorkRecord.user_id == user.id,
                extract("year", WorkRecord.work_date) == year,
                extract("month", WorkRecord.work_date) == month,
            )
            .all()
        )

        hours = aggregate_monthly_hours(records)
        pay = calculate_payroll(user, hours)

        existing = (
            db.query(PayrollRecord)
            .filter(
                PayrollRecord.year_month == year_month,
                PayrollRecord.user_id == user.id,
            )
            .first()
        )

        if existing:
            # Preserve manual adjustments when recalculating
            existing.regular_hours = hours["regular_hours"]
            existing.overtime_hours = hours["overtime_hours"]
            existing.late_night_hours = hours["late_night_hours"]
            existing.holiday_hours = hours["holiday_hours"]
            existing.total_hours = hours["total_hours"]
            existing.base_salary = pay["base_salary"]
            existing.overtime_pay = pay["overtime_pay"]
            existing.late_night_pay = pay["late_night_pay"]
            existing.holiday_pay = pay["holiday_pay"]
            existing.transportation = pay["transportation"]
            existing.allowances = pay["allowances"]
            # Recalculate gross_pay including any existing deductions
            existing.gross_pay = (
                pay["base_salary"]
                + pay["overtime_pay"]
                + pay["late_night_pay"]
                + pay["holiday_pay"]
                + pay["transportation"]
                + pay["allowances"]
                - existing.deductions
            )
            existing.status = "calculated"
            existing.confirmed_at = None
            existing.confirmed_by = None
            db.flush()
            results.append(existing)
        else:
            pr = PayrollRecord(
                year_month=year_month,
                user_id=user.id,
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
                gross_pay=pay["base_salary"]
                + pay["overtime_pay"]
                + pay["late_night_pay"]
                + pay["holiday_pay"]
                + pay["transportation"]
                + pay["allowances"],
            )
            db.add(pr)
            db.flush()
            results.append(pr)

    db.commit()
    # Refresh all records so relationships are up-to-date
    for r in results:
        db.refresh(r)
    return results


@router.get("/{year_month}/{user_id}", response_model=PayrollRecordResponse)
def get_payroll_for_user(
    year_month: str,
    user_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Get payroll for a specific user. Employees can only view their own."""
    if not current_user.is_admin and current_user.id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="アクセス権限がありません"
        )

    record = (
        db.query(PayrollRecord)
        .filter(
            PayrollRecord.year_month == year_month,
            PayrollRecord.user_id == user_id,
        )
        .first()
    )
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="給与記録が見つかりません"
        )
    return record


@router.put("/{year_month}/{user_id}/adjust", response_model=PayrollRecordResponse)
def adjust_payroll(
    year_month: str,
    user_id: int,
    payload: PayrollAdjustment,
    db: Session = Depends(get_db),
    _admin=Depends(get_current_admin_user),
):
    """Update allowances / deductions for a payroll record (admin only)."""
    record = (
        db.query(PayrollRecord)
        .filter(
            PayrollRecord.year_month == year_month,
            PayrollRecord.user_id == user_id,
        )
        .first()
    )
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="給与記録が見つかりません"
        )

    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(record, key, value)

    # Recalculate gross_pay after adjustments
    record.gross_pay = (
        record.base_salary
        + record.overtime_pay
        + record.late_night_pay
        + record.holiday_pay
        + record.transportation
        + record.allowances
        - record.deductions
    )

    db.commit()
    db.refresh(record)
    return record


@router.post("/{year_month}/{user_id}/confirm", response_model=PayrollRecordResponse)
def confirm_payroll(
    year_month: str,
    user_id: int,
    db: Session = Depends(get_db),
    current_admin=Depends(get_current_admin_user),
):
    """Confirm (lock) a payroll record (admin only)."""
    record = (
        db.query(PayrollRecord)
        .filter(
            PayrollRecord.year_month == year_month,
            PayrollRecord.user_id == user_id,
        )
        .first()
    )
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="給与記録が見つかりません"
        )

    record.status = "confirmed"
    record.confirmed_at = datetime.utcnow()
    record.confirmed_by = current_admin.id

    db.commit()
    db.refresh(record)
    return record
