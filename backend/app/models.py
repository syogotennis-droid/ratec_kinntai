from datetime import datetime
from sqlalchemy import (
    Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Date,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship
from .database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(String, unique=True, index=True, nullable=False)  # 社員番号
    name = Column(String, nullable=False)  # 氏名
    name_kana = Column(String, nullable=True)  # フリガナ
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    department = Column(String, nullable=True)  # 所属
    employment_type = Column(String, default="hourly")  # hourly/daily/monthly
    hourly_wage = Column(Float, default=0.0)  # 時給
    daily_wage = Column(Float, default=0.0)  # 日給
    transportation = Column(Float, default=0.0)  # 交通費/月
    fixed_allowance = Column(Float, default=0.0)  # 固定手当
    overtime_rate = Column(Float, default=1.25)  # 残業割増率
    late_night_rate = Column(Float, default=1.25)  # 深夜割増率
    holiday_rate = Column(Float, default=1.35)  # 休日割増率
    is_admin = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    work_records = relationship("WorkRecord", back_populates="user")
    monthly_closings = relationship("MonthlyClosing", back_populates="user")
    payroll_records = relationship("PayrollRecord", back_populates="user")


class WorkRecord(Base):
    __tablename__ = "work_records"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    work_date = Column(Date, nullable=False)  # 勤務日
    start_time = Column(String, nullable=False)  # HH:MM format
    end_time = Column(String, nullable=False)  # HH:MM format
    break_minutes = Column(Integer, default=0)  # 休憩時間/分
    actual_minutes = Column(Integer, nullable=True)  # 実働時間/分 (calculated)
    work_type = Column(String, default="normal")  # normal/overtime/holiday/training/paid_leave
    notes = Column(String, nullable=True)  # 備考
    created_by = Column(Integer, nullable=True)  # 登録者ID
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="work_records")


class MonthlyClosing(Base):
    __tablename__ = "monthly_closings"

    id = Column(Integer, primary_key=True, index=True)
    year_month = Column(String, nullable=False)  # YYYY-MM
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    status = Column(String, default="open")  # open/closed
    closed_at = Column(DateTime, nullable=True)
    closed_by = Column(Integer, nullable=True)

    user = relationship("User", back_populates="monthly_closings")

    __table_args__ = (UniqueConstraint("year_month", "user_id", name="uq_closing_month_user"),)


class PayrollRecord(Base):
    __tablename__ = "payroll_records"

    id = Column(Integer, primary_key=True, index=True)
    year_month = Column(String, nullable=False)  # YYYY-MM
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    regular_hours = Column(Float, default=0.0)
    overtime_hours = Column(Float, default=0.0)
    late_night_hours = Column(Float, default=0.0)
    holiday_hours = Column(Float, default=0.0)
    total_hours = Column(Float, default=0.0)
    base_salary = Column(Float, default=0.0)
    overtime_pay = Column(Float, default=0.0)
    late_night_pay = Column(Float, default=0.0)
    holiday_pay = Column(Float, default=0.0)
    transportation = Column(Float, default=0.0)
    allowances = Column(Float, default=0.0)
    deductions = Column(Float, default=0.0)
    gross_pay = Column(Float, default=0.0)
    additional_notes = Column(String, nullable=True)
    status = Column(String, default="calculated")  # calculated/confirmed
    confirmed_at = Column(DateTime, nullable=True)
    confirmed_by = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="payroll_records")

    __table_args__ = (UniqueConstraint("year_month", "user_id", name="uq_payroll_month_user"),)


class SystemSetting(Base):
    __tablename__ = "system_settings"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String, unique=True, nullable=False)
    value = Column(String, nullable=False)
    description = Column(String, nullable=True)
