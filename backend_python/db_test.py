import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime
from dateutil.relativedelta import relativedelta
import json

async def run():
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    db = client["finsight"]
    
    # 1. Check a raw expense record
    expense = await db.expenses.find_one()
    print("Raw Expense in DB:", expense)
    
    if not expense:
        print("No expenses found in DB.")
        return
        
    user_id = expense["user"]
    print("Using User ID:", user_id)
    
    # 2. Check the query logic used in Analytics
    now = datetime.utcnow()
    six_months_ago = now - relativedelta(months=5)
    six_months_ago_naive = datetime(six_months_ago.year, six_months_ago.month, 1)
    
    print("Naive start date:", six_months_ago_naive)
    
    # Query with Naive date
    docs_naive = await db.expenses.find({"user": user_id, "date": {"$gte": six_months_ago_naive}}).to_list(length=100)
    print("Docs found with naive date:", len(docs_naive))
    
    # Let's try aware date if naive fails or we want to compare
    import pytz
    six_months_ago_aware = six_months_ago_naive.replace(tzinfo=pytz.UTC)
    docs_aware = await db.expenses.find({"user": user_id, "date": {"$gte": six_months_ago_aware}}).to_list(length=100)
    print("Docs found with aware date:", len(docs_aware))
    
    # 3. What if it's stored as a string?
    docs_string = await db.expenses.find({"user": user_id, "date": {"$type": "string"}}).to_list(length=100)
    print("Docs stored as string:", len(docs_string))

if __name__ == "__main__":
    asyncio.run(run())
