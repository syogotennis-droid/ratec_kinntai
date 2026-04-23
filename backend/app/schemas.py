from datetime import datetime, date
from typing import Optional
from pydantic import BaseModel, EmailStr


# ---------------------------------------------------------------------------
# Auth schemas
# ---------------------------------------------------------------------------

class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    user_id: Optional[int] = None
    is_admin: Optional[bool] = False


# ---------------------------------------------------------------------------
# User schemas
# ---------------------------------------------------------------------------

class UserBase(BaseModel):
    employee_id: str
    name: str
    name_kana: Optional[str] = None
    email: EmailStr
    department: Optional[str] = None
    employment_type: str = "hourly"
    hourly_wage: float = 0.0
    daily_wage: float = 0.0
    transportation: float = 0.0
    fixed_allowance: float = 0.0
    overtime_rate: float = 1.25
    late_night_rate: float = 1.25
    holiday_rate: float = 1.35
    is_admin: bool = False


class UserCreate(UserBase):
    password: str


class UserUpdate(BaseModel):
    employee_id: Optional[str] = None
    name: Optional[str] = None
    name_kana: Optional[str] = None
    email: Optional[EmailStr] = None
    department: Optional[str] = None
    employment_type: Optional[str] = None
    hourly_wage: Optional[float] = None
    daily_wage: Optional[float] = None
    transportation: Optional[float] = None
    fixed_allowance: Optional[float] = None
    overtime_rate: Optional[float] = None
    late_night_rate: Optional[float] = None
    holiday_rate: Optional[float] = None
    is_admin: Optional[bool] = None
    password: Optional[str] = None


class UserResponse(UserBase):
    id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# WorkRecord schemas
# ---------------------------------------------------------------------------

class WorkRecordBase(BaseModel):
    user_id: int
    work_date: date
    start_time: str
    end_time: str
    break_minutes: int = 0
    work_type: str = "normal"
    notes: Optional[str] = None


class WorkRecordCreate(WorkRecordBase):
    pass


class WorkRecordUpdate(BaseModel):
    user_id: Optional[int] = None
    work_date: Optional[date] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    break_minutes: Optional[int] = None
    work_type: Optional[str] = None
    notes: Optional[str] = None


class WorkRecordResponse(WorkRecordBase):
    id: int
    actual_minutes: Optional[int] = None
    created_by: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# MonthlyClosing schemas
# ---------------------------------------------------------------------------

class MonthlyClosingResponse(BaseModel):
    id: int
    year_month: str
    user_id: int
    status: str
    closed_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# PayrollRecord schemas
# ---------------------------------------------------------------------------

class PayrollRecordResponse(BaseModel):
    id: int
    year_month: str
    user_id: int
    regular_hours: float
    overtime_hours: float
    late_night_hours: float
    holiday_hours: float
    total_hours: float
    base_salary: float
    overtime_pay: float
    late_night_pay: float
    holiday_pay: float
    transportation: float
    allowances: float
    deductions: float
    gross_pay: float
    additional_notes: Optional[str] = None
    status: str
    confirmed_at: Optional[datetime] = None
    confirmed_by: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PayrollAdjustment(BaseModel):
    allowances: Optional[float] = None
    deductions: Optional[float] = None
    additional_notes: Optional[str] = None
    transportation: Optional[float] = None


# ---------------------------------------------------------------------------
# Summary schemas
# ---------------------------------------------------------------------------

class MonthlySummary(BaseModel):
    user_id: int
    user_name: str
    year_month: str
    total_hours: float
    regular_hours: float
    overtime_hours: float
    late_night_hours: float
    holiday_hours: float
    work_days: int
    closing_status: str
