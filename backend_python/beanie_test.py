import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie
from models.expense import Expense
from models.user import User
from services.analytics_engine import filter_by_month, get_month_str
from datetime import datetime
from dateutil.relativedelta import relativedelta

async def run():
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    db = client["finsight"]
    await init_beanie(database=db, document_models=[User, Expense])
    user = await User.find_one()
    
    now = datetime.utcnow()
    six_months_ago = now - relativedelta(months=5)
    six_months_ago = datetime(six_months_ago.year, six_months_ago.month, 1)
    all_expenses = await Expense.find({"user": user.id, "date": {"$gte": six_months_ago}}).to_list()
    print("Found expenses since 6 months:", len(all_expenses))
    
    current_month = "2026-07"
    for e in all_expenses:
        print("Expense date:", e.date, type(e.date), "Month str:", get_month_str(e.date))
        
    filtered = filter_by_month(all_expenses, current_month)
    print(f"Filtered for {current_month}:", len(filtered))
    print("Spent so far:", sum(e.amount for e in filtered))

if __name__ == "__main__":
    asyncio.run(run())
