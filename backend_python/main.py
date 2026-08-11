from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from routers import auth, expenses, budgets, investments, goals, analytics, notifications, recurring_expenses, households, reports, audit_logs
from core.database import init_db
from core.scheduler import init_scheduler
import uvicorn
from contextlib import asynccontextmanager
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing database...")
    await init_db()
    logger.info("Database initialized.")
    init_scheduler()
    yield

app = FastAPI(title="FinSight API", lifespan=lifespan)

app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "http://localhost:5175",
    "http://127.0.0.1:5175",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(expenses.router, prefix="/api/expenses", tags=["expenses"])
app.include_router(budgets.router, prefix="/api/budgets", tags=["budgets"])
app.include_router(investments.router, prefix="/api/investments", tags=["investments"])
app.include_router(goals.router, prefix="/api/goals", tags=["goals"])
app.include_router(analytics.router, prefix="/api/analytics", tags=["analytics"])
app.include_router(notifications.router, prefix="/api/notifications", tags=["notifications"])
app.include_router(recurring_expenses.router, prefix="/api/recurring-expenses", tags=["recurring-expenses"])
app.include_router(households.router, prefix="/api/households", tags=["households"])
app.include_router(reports.router, prefix="/api/reports", tags=["reports"])
app.include_router(audit_logs.router, prefix="/api/audit-logs", tags=["audit-logs"])

@app.get("/")
async def root():
    return {"message": "Welcome to FinSight API"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
