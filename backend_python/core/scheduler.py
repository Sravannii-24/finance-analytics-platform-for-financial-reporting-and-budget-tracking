from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
import pytz
from services.price_update_service import update_all_live_prices
from services.recurring_expense_check_service import run_recurring_expense_check

scheduler = AsyncIOScheduler()
tz = pytz.timezone('Asia/Kolkata')

def init_scheduler():
    scheduler.add_job(
        update_all_live_prices,
        CronTrigger(hour=21, minute=0, timezone=tz),
        id="price_updates",
        replace_existing=True
    )

    scheduler.add_job(
        run_recurring_expense_check,
        CronTrigger(hour=0, minute=0, timezone=tz),
        id="recurring_expenses",
        replace_existing=True
    )
    
    scheduler.start()
    print("Scheduled Cron Jobs Initialized.")
