from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from ..auth import get_current_admin_user, get_current_user
from ..database import get_db
from ..models import MonthlyClosing, WorkRecord
from ..schemas import WorkRecordCreate, WorkRecordResponse, WorkRecordUpdate
from ..services.calculation import calculate_actual_minutes

router = APIRouter()


def _assert_month_open(db: Session, user_id: int, year_month: str, is_admin: bool):
    """Raise 403 if the month is closed and the caller is not admin."""
    if is_admin:
        return
    closing = (
        db.query(MonthlyClosing)
        .filter(
            MonthlyClosing.user_id == user_id,
            MonthlyClosing.year_month == year_month,
        )
        .first()
    )
    if closing and closing.status == "closed":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="この月はすでに締め処理済みです",
        )


@router.get("", response_model=List[WorkRecordResponse])
def list_work_records(
    year_month: Optional[str] = Query(None, description="YYYY-MM"),
    user_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    List work records.
    - Admins can filter by any user_id (or see all).
    - Employees only see their own records.
    """
    query = db.query(WorkRecord)

    if not current_user.is_admin:
        query = query.filter(WorkRecord.user_id == current_user.id)
    elif user_id is not None:
        query = query.filter(WorkRecord.user_id == user_id)

    if year_month:
        # Filter by YYYY-MM prefix using work_date
        year, month = year_month.split("-")
        from sqlalchemy import extract
        query = query.filter(
            extract("year", WorkRecord.work_date) == int(year),
            extract("month", WorkRecord.work_date) == int(month),
        )

    return query.order_by(WorkRecord.work_date).all()


@router.post("", response_model=WorkRecordResponse, status_code=status.HTTP_201_CREATED)
def create_work_record(
    payload: WorkRecordCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Create a work record. Calculates actual_minutes automatically."""
    # Non-admins can only create records for themselves
    if not current_user.is_admin and payload.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="他のユーザーの記録は作成できません")

    year_month = payload.work_date.strftime("%Y-%m")
    _assert_month_open(db, payload.user_id, year_month, current_user.is_admin)

    actual = calculate_actual_minutes(
        payload.start_time, payload.end_time, payload.break_minutes, payload.work_date
    )

    record = WorkRecord(
        **payload.model_dump(),
        actual_minutes=actual,
        created_by=current_user.id,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.get("/calendar/{user_id}/{year_month}", response_model=List[WorkRecordResponse])
def get_calendar_records(
    user_id: int,
    year_month: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Return work records for a given user/month formatted for calendar display."""
    if not current_user.is_admin and current_user.id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="アクセス権限がありません")

    year, month = year_month.split("-")
    from sqlalchemy import extract

    records = (
        db.query(WorkRecord)
        .filter(
            WorkRecord.user_id == user_id,
            extract("year", WorkRecord.work_date) == int(year),
            extract("month", WorkRecord.work_date) == int(month),
        )
        .order_by(WorkRecord.work_date)
        .all()
    )
    return records


@router.get("/{record_id}", response_model=WorkRecordResponse)
def get_work_record(
    record_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    record = db.query(WorkRecord).filter(WorkRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="記録が見つかりません")
    if not current_user.is_admin and record.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="アクセス権限がありません")
    return record


@router.put("/{record_id}", response_model=WorkRecordResponse)
def update_work_record(
    record_id: int,
    payload: WorkRecordUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    record = db.query(WorkRecord).filter(WorkRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="記録が見つかりません")
    if not current_user.is_admin and record.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="アクセス権限がありません")

    year_month = record.work_date.strftime("%Y-%m")
    _assert_month_open(db, record.user_id, year_month, current_user.is_admin)

    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(record, key, value)

    # Recalculate actual_minutes
    record.actual_minutes = calculate_actual_minutes(
        record.start_time, record.end_time, record.break_minutes, record.work_date
    )

    db.commit()
    db.refresh(record)
    return record


@router.delete("/{record_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_work_record(
    record_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    record = db.query(WorkRecord).filter(WorkRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="記録が見つかりません")
    if not current_user.is_admin and record.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="アクセス権限がありません")

    year_month = record.work_date.strftime("%Y-%m")
    _assert_month_open(db, record.user_id, year_month, current_user.is_admin)

    db.delete(record)
    db.commit()
