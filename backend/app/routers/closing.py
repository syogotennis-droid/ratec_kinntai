from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..auth import get_current_admin_user, get_current_user
from ..database import get_db
from ..models import MonthlyClosing, User
from ..schemas import MonthlyClosingResponse

router = APIRouter()


def _get_or_create_closing(
    db: Session, year_month: str, user_id: int
) -> MonthlyClosing:
    """Return existing MonthlyClosing or create a new open one."""
    closing = (
        db.query(MonthlyClosing)
        .filter(
            MonthlyClosing.year_month == year_month,
            MonthlyClosing.user_id == user_id,
        )
        .first()
    )
    if not closing:
        closing = MonthlyClosing(
            year_month=year_month,
            user_id=user_id,
            status="open",
        )
        db.add(closing)
        db.flush()
    return closing


@router.get("/{year_month}", response_model=List[MonthlyClosingResponse])
def get_closing_status(
    year_month: str,
    db: Session = Depends(get_db),
    _admin=Depends(get_current_admin_user),
):
    """Return the closing status for all active users for a given month (admin only)."""
    users = db.query(User).filter(User.is_active == True).all()
    result = []

    for user in users:
        closing = (
            db.query(MonthlyClosing)
            .filter(
                MonthlyClosing.year_month == year_month,
                MonthlyClosing.user_id == user.id,
            )
            .first()
        )
        if closing:
            result.append(closing)
        else:
            # Return a virtual open record without persisting
            result.append(
                MonthlyClosingResponse(
                    id=0,
                    year_month=year_month,
                    user_id=user.id,
                    status="open",
                    closed_at=None,
                )
            )

    return result


@router.post(
    "/{year_month}/{user_id}/close", response_model=MonthlyClosingResponse
)
def close_month_for_user(
    year_month: str,
    user_id: int,
    db: Session = Depends(get_db),
    current_admin=Depends(get_current_admin_user),
):
    """Close the month for a specific user (admin only)."""
    # Verify user exists
    user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="ユーザーが見つかりません"
        )

    closing = _get_or_create_closing(db, year_month, user_id)
    if closing.status == "closed":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="この月はすでに締め処理済みです",
        )

    closing.status = "closed"
    closing.closed_at = datetime.utcnow()
    closing.closed_by = current_admin.id

    db.commit()
    db.refresh(closing)
    return closing


@router.post(
    "/{year_month}/{user_id}/reopen", response_model=MonthlyClosingResponse
)
def reopen_month_for_user(
    year_month: str,
    user_id: int,
    db: Session = Depends(get_db),
    current_admin=Depends(get_current_admin_user),
):
    """Re-open a closed month for a specific user (admin only)."""
    closing = (
        db.query(MonthlyClosing)
        .filter(
            MonthlyClosing.year_month == year_month,
            MonthlyClosing.user_id == user_id,
        )
        .first()
    )
    if not closing or closing.status != "closed":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="この月は締め処理されていません",
        )

    closing.status = "open"
    closing.closed_at = None
    closing.closed_by = None

    db.commit()
    db.refresh(closing)
    return closing


@router.post("/{year_month}/close-all", response_model=List[MonthlyClosingResponse])
def close_all_users(
    year_month: str,
    db: Session = Depends(get_db),
    current_admin=Depends(get_current_admin_user),
):
    """Close the month for all active users at once (admin only)."""
    users = db.query(User).filter(User.is_active == True).all()
    closings = []

    for user in users:
        closing = _get_or_create_closing(db, year_month, user.id)
        if closing.status != "closed":
            closing.status = "closed"
            closing.closed_at = datetime.utcnow()
            closing.closed_by = current_admin.id
        closings.append(closing)

    db.commit()
    for c in closings:
        db.refresh(c)
    return closings
