import asyncio
import requests
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime
import json

base_url = "http://127.0.0.1:8000/api"

async def run():
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    db = client["finsight"]

    # We don't have their plain password to login, so let's just make a new one to test full flow
    email = f"test_{int(datetime.now().timestamp())}@example.com"
    res = requests.post(f"{base_url}/auth/register", json={
        "name": "Test User", "email": email, "password": "password", "confirmPassword": "password", "monthlyIncome": 10000
    })
    token = res.json().get("token")
    headers = {"Authorization": f"Bearer {token}"}
    
    # Bug 1: Household Creation and Fetch
    print("--- BUG 1: Household ---")
    create_res = requests.post(f"{base_url}/households", headers=headers, json={"name": "My Family"})
    print("Create Household Status:", create_res.status_code)
    
    fetch_res = requests.get(f"{base_url}/households/me", headers=headers)
    print("Fetch Household Status:", fetch_res.status_code)
    try:
        print("Fetch Household JSON:", json.dumps(fetch_res.json(), indent=2))
    except:
        print("Fetch Household Raw Text:", fetch_res.text)
        
    # Bug 2: Audit Logs
    print("\n--- BUG 2: Audit Logs ---")
    # I did create a household, which should log an action (if wired). Let's check API.
    logs_res = requests.get(f"{base_url}/audit-logs", headers=headers)
    print("Audit Logs Status:", logs_res.status_code)
    try:
        print("Audit Logs JSON:", json.dumps(logs_res.json(), indent=2))
    except:
        print("Audit Logs Raw Text:", logs_res.text)
        
    # Check MongoDB directly for this user
    user_doc = await db.users.find_one({"email": email})
    user_id = user_doc["_id"]

    # Profile Update Test
    print("\n--- TEST: Profile Update and Audit Logs ---")
    update_res = requests.put(f"{base_url}/auth/profile", headers=headers, json={"name": "Updated Test User", "monthlyIncome": 12000})
    print("Update Profile Status:", update_res.status_code)
    try:
        print("Update Profile JSON:", json.dumps(update_res.json(), indent=2))
    except:
        print("Update Profile Raw:", update_res.text)

    # Now get audit logs again
    logs_res = requests.get(f"{base_url}/audit-logs", headers=headers)
    print("Audit Logs Status after update:", logs_res.status_code)
    try:
        print("Audit Logs JSON:", json.dumps(logs_res.json(), indent=2))
    except:
        print("Audit Logs Raw:", logs_res.text)
    
    logs_in_db = await db.auditlogs.find({"user": user_id}).to_list(length=10)
    print(f"\nAudit logs in DB for this user: {len(logs_in_db)}")
    for log in logs_in_db:
        print(" - Action:", log.get("action"), "Resource:", log.get("resourceType"))

if __name__ == "__main__":
    asyncio.run(run())
