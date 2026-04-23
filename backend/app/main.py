from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from .database import engine, SessionLocal
from .models import Base, User
from .auth import get_password_hash
from .routers import auth, users, work_records, payroll, closing, export

STATIC_DIR = Path(__file__).parent.parent.parent / "frontend" / "dist"


@asynccontextmanager
async def lifespan(app: FastAPI):
    # --- Startup ---
    # Create all database tables
    Base.metadata.create_all(bind=engine)

    # Create default admin user if no users exist
    db = SessionLocal()
    try:
        if db.query(User).count() == 0:
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
            db.commit()
            print("デフォルト管理者ユーザーを作成しました (employee_id=admin, password=admin1234)")
    finally:
        db.close()

    yield
    # --- Shutdown (nothing to do) ---


app = FastAPI(
    title="勤怠・給与計算システム API",
    description="日本語勤怠・給与計算システムのバックエンド API",
    version="1.0.0",
    lifespan=lifespan,
)

# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------
app.include_router(auth.router, prefix="/api/auth", tags=["認証"])
app.include_router(users.router, prefix="/api/users", tags=["ユーザー管理"])
app.include_router(
    work_records.router, prefix="/api/work-records", tags=["勤怠記録"]
)
app.include_router(payroll.router, prefix="/api/payroll", tags=["給与計算"])
app.include_router(closing.router, prefix="/api/closing", tags=["月次締め"])
app.include_router(export.router, prefix="/api/export", tags=["エクスポート"])


@app.get("/health", tags=["ヘルスチェック"])
def health():
    return {"status": "ok"}


# Serve React frontend static files (must be last)
if STATIC_DIR.exists():
    app.mount("/assets", StaticFiles(directory=str(STATIC_DIR / "assets")), name="assets")

    @app.get("/", include_in_schema=False)
    @app.get("/{full_path:path}", include_in_schema=False)
    def serve_frontend(full_path: str = ""):
        # Let API routes take priority; serve index.html for everything else
        index = STATIC_DIR / "index.html"
        if index.exists():
            return FileResponse(str(index))
        return {"message": "勤怠・給与計算システム API", "status": "running"}
