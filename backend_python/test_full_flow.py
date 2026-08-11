import requests
from datetime import datetime

base_url = "http://127.0.0.1:8000/api"

def run():
    email = f"test_{int(datetime.now().timestamp())}@example.com"
    res = requests.post(f"{base_url}/auth/register", json={
        "name": "Test User", "email": email, "password": "password", "confirmPassword": "password", "monthlyIncome": 10000
    })
    
    if res.status_code != 200 and res.status_code != 201:
        print("Registration failed:", res.text)
        return
        
    token = res.json().get("token")
    if not token:
        print("No token in response:", res.text)
        return
        
    headers = {"Authorization": f"Bearer {token}"}
    now = datetime.now()
    month_str = f"{now.year}-{str(now.month).zfill(2)}"
    
    expenses = [450, 100, 4500]
    for amount in expenses:
        res = requests.post(f"{base_url}/expenses", headers=headers, json={
            "amount": amount,
            "category": "Food",
            "date": f"{month_str}-15T10:00:00.000Z",
            "paymentMode": "Online",
            "paymentMethod": "UPI"
        })
        if res.status_code not in (200, 201):
            print("Failed to add expense:", res.text)
    
    res = requests.get(f"{base_url}/analytics/spending-analysis?month={month_str}", headers=headers)
    print("Spending Analysis Status:", res.status_code)
    try:
        data = res.json()["data"]
        print("Total Current Spend:", data.get("totalCurrentSpend"))
    except:
        print("Spending Response:", res.text)
        
    res = requests.get(f"{base_url}/analytics/trends-predictions", headers=headers)
    print("Trends Status:", res.status_code)
    try:
        data = res.json()["data"]
        print("Spent So Far:", data.get("spentSoFar"))
        print("Projected:", data.get("projectedTotal"))
    except:
        print("Trends Response:", res.text)

if __name__ == "__main__":
    run()
