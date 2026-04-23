import csv
import io
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy import extract
from sqlalchemy.orm import Session

from ..auth import get_current_admin_user
from ..database import get_db
from ..models import PayrollRecord, User, WorkRecord
from ..services.calculation import aggregate_monthly_hours

router = APIRouter()


def _parse_year_month(year_month: str):
    try:
        year, month = year_month.split("-")
        return int(year), int(month)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="year_month は YYYY-MM 形式で指定してください",
        )


@router.get("/work-records/{year_month}")
def export_work_records_csv(
    year_month: str,
    user_id: Optional[int] = Query(None, description="特定ユーザーのみ出力する場合"),
    db: Session = Depends(get_db),
    _admin=Depends(get_current_admin_user),
):
    """
    Export all work records for the given month as a CSV file.
    Optionally filter by user_id.
    """
    year, month = _parse_year_month(year_month)

    query = (
        db.query(WorkRecord)
        .join(User, WorkRecord.user_id == User.id)
        .filter(
            extract("year", WorkRecord.work_date) == year,
            extract("month", WorkRecord.work_date) == month,
        )
    )
    if user_id is not None:
        query = query.filter(WorkRecord.user_id == user_id)

    records = query.order_by(User.employee_id, WorkRecord.work_date).all()

    output = io.StringIO()
    writer = csv.writer(output)

    # Header row
    writer.writerow(
        [
            "社員番号",
            "氏名",
            "勤務日",
            "開始時刻",
            "終了時刻",
            "休憩(分)",
            "実働(分)",
            "実働(時間)",
            "勤務区分",
            "備考",
        ]
    )

    for r in records:
        actual_hours = round(r.actual_minutes / 60, 2) if r.actual_minutes else 0
        work_type_map = {
            "normal": "通常",
            "overtime": "残業",
            "holiday": "休日出勤",
            "training": "研修",
            "paid_leave": "有給",
        }
        writer.writerow(
            [
                r.user.employee_id,
                r.user.name,
                r.work_date.strftime("%Y-%m-%d"),
                r.start_time,
                r.end_time,
                r.break_minutes,
                r.actual_minutes or 0,
                actual_hours,
                work_type_map.get(r.work_type, r.work_type),
                r.notes or "",
            ]
        )

    output.seek(0)
    # Add BOM for Excel compatibility
    content = "﻿" + output.getvalue()

    filename = f"work_records_{year_month}.csv"
    return StreamingResponse(
        iter([content]),
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{filename}"
        },
    )


@router.get("/payroll/{year_month}")
def export_payroll_csv(
    year_month: str,
    db: Session = Depends(get_db),
    _admin=Depends(get_current_admin_user),
):
    """Export the payroll summary for the given month as a CSV file."""
    _parse_year_month(year_month)  # Validate format

    records = (
        db.query(PayrollRecord)
        .join(User, PayrollRecord.user_id == User.id)
        .filter(PayrollRecord.year_month == year_month)
        .order_by(User.employee_id)
        .all()
    )

    output = io.StringIO()
    writer = csv.writer(output)

    # Header row
    writer.writerow(
        [
            "社員番号",
            "氏名",
            "所属",
            "年月",
            "通常時間",
            "残業時間",
            "深夜時間",
            "休日時間",
            "合計時間",
            "基本給",
            "残業手当",
            "深夜手当",
            "休日手当",
            "交通費",
            "固定手当",
            "控除",
            "総支給額",
            "ステータス",
        ]
    )

    for r in records:
        status_map = {"calculated": "計算済", "confirmed": "確定"}
        writer.writerow(
            [
                r.user.employee_id,
                r.user.name,
                r.user.department or "",
                r.year_month,
                r.regular_hours,
                r.overtime_hours,
                r.late_night_hours,
                r.holiday_hours,
                r.total_hours,
                int(r.base_salary),
                int(r.overtime_pay),
                int(r.late_night_pay),
                int(r.holiday_pay),
                int(r.transportation),
                int(r.allowances),
                int(r.deductions),
                int(r.gross_pay),
                status_map.get(r.status, r.status),
            ]
        )

    output.seek(0)
    content = "﻿" + output.getvalue()

    filename = f"payroll_{year_month}.csv"
    return StreamingResponse(
        iter([content]),
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{filename}"
        },
    )
