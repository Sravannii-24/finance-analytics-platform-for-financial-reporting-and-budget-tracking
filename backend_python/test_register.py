import requests

url='http://127.0.0.1:8000/api/auth/register'
payload={'name':'Test User','email':'testuser@example.com','password':'password123','confirmPassword':'password123'}
try:
    r=requests.post(url,json=payload,timeout=10)
    print(r.status_code)
    print(r.text)
except Exception as e:
    print('ERR',e)
