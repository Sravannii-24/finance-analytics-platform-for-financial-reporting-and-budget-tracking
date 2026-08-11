import logging
import motor.motor_asyncio
from beanie import init_beanie
from core.config import settings

logger = logging.getLogger(__name__)

# Module-level flag indicating whether DB was initialized successfully
DB_AVAILABLE = False


async def init_db():
    try:
        client = motor.motor_asyncio.AsyncIOMotorClient(
            settings.MONGO_URI,
            serverSelectionTimeoutMS=3000,
        )
        db = client.get_database()

        # Import models here to avoid circular imports
        from models.user import User
        from models.expense import Expense
        from models.budget import Budget
        from models.audit_log import AuditLog
        from models.investment import Investment
        from models.goal import Goal
        from models.goal_contribution import GoalContribution
        from models.notification import Notification
        from models.recurring_expense import RecurringExpense
        from models.household import Household

        await init_beanie(
            database=db,
            document_models=[
                User,
                Expense,
                Budget,
                AuditLog,
                Investment,
                Goal,
                GoalContribution,
                Notification,
                RecurringExpense,
                Household,
            ],
        )
        logger.info("Database initialized successfully.")
        global DB_AVAILABLE
        DB_AVAILABLE = True
    except Exception as exc:  # pragma: no cover - runtime fallback for missing MongoDB
        logger.warning("Database unavailable during startup: %s", exc)
        logger.warning("Continuing without MongoDB persistence until a database is available.")


def is_db_available():
    return DB_AVAILABLE
