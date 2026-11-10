# Finance Analytics Platform for Financial Reporting and Budget Tracking

## 1. Project Overview
FinSight is a comprehensive personal finance and investment tracking application designed to give you a 360-degree view of your financial health. Built on a modern tech stack featuring a **React 19 + Vite** frontend and a **Python FastAPI + MongoDB (Beanie ODM)** backend, it delivers a fast and robust experience. The core features include robust User Authentication, tracking daily Expenses, setting monthly Budgets, and managing Investments with live pricing updates. It also includes tracking savings Goals, intelligent Analytics (including health scores and predictions), email Notifications, Recurring Expenses management, Household sharing for family finances, full Audit Logs for security tracking, and PDF/Excel Report exports.

## 2. Prerequisites
Before setting up the project, ensure you have the following installed:
*   **Node.js (LTS Version - v20 or v22)**: Used to run the React frontend. Check if installed by running `node -v` in your terminal.
*   **Python (3.10, 3.11, or 3.12)**: Used to run the FastAPI backend. Check if installed by running `python --version` or `python3 --version`.
*   **MongoDB (v6.0+)**: You can either install MongoDB Community Server locally or create a free cloud cluster using MongoDB Atlas.

## 3. Project Structure
```text
DSR/
├── backend_python/       # The Python FastAPI backend application
│   ├── core/             # Core configurations (database, security, email, scheduler)
│   ├── models/           # MongoDB document models (Beanie ODM)
│   ├── routers/          # API endpoints (Auth, Expenses, Budgets, etc.)
│   ├── schemas/          # Pydantic schemas for request/response validation
│   └── services/         # Business logic and external API integrations
├── frontend/             # The React + Vite frontend application
│   ├── public/           # Static assets
│   └── src/              # React components, pages, hooks, and API services
└── README.md             # This documentation file
```

## 4. Setup Instructions

### a. Clone or Download the Repository
First, get the codebase onto your local machine:
```bash
git clone <repository-url>
cd DSR
```

### b. Backend Setup
Navigate into the backend directory and set up an isolated Python virtual environment:
```bash
cd backend_python
```
**For Windows:**
```bash
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
```
**For Mac/Linux:**
```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### c. Environment Variables
Create a `.env` file inside the `backend_python/` directory based on the following template.
```env
# MongoDB Connection String (Required)
MONGO_URI=mongodb://localhost:27017/finsight

# JWT Secret Key for authenticating users (Required - generate a random string)
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production

# Email SMTP Settings for Notifications (Required for emails to work)
# If using Gmail, generate an App Password at: myaccount.google.com/apppasswords
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_16_character_app_password
SMTP_FROM=your_email@gmail.com

# Optional APIs (Leave blank if you don't have one)
# Required for live Gold pricing fallback
GOLD_API_KEY=your_metalpriceapi_key
```

### d. MongoDB Setup
*   **Local Install**: If you installed MongoDB locally, ensure the MongoDB service is running on your machine. Your `MONGO_URI` will be `mongodb://localhost:27017/finsight`.
*   **MongoDB Atlas**: If you prefer the cloud, go to [mongodb.com/atlas](https://www.mongodb.com/atlas), create a free tier cluster, click "Connect", choose "Connect your application", and copy the connection string. Replace `<password>` with your database user password and update the `MONGO_URI` in your `.env`.

### e. Frontend Setup
Open a new terminal window, navigate to the frontend directory, and install the Node dependencies:
```bash
cd frontend
npm install
```
By default, Vite proxies requests to `http://localhost:8000` via its configuration, so no frontend `.env` is strictly required for local development. However, if your backend runs elsewhere, create a `.env` in `frontend/` with:
```env
VITE_API_URL=http://localhost:8000/api
```

### f. How to Run Both Servers
You will need two terminal windows open to run both servers simultaneously.

**Terminal 1 (Backend):**
Ensure your virtual environment is activated.
```bash
cd backend_python
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```
*(The backend runs on port 8000)*

**Terminal 2 (Frontend):**
```bash
cd frontend
npm run dev
```
*(The frontend usually runs on port 5173)*

## 5. Verifying It Works
To confirm everything is running perfectly, follow these steps:
1. Open your browser and navigate to `http://localhost:5173`.
2. Register a new user account.
3. Go to the "Expenses" tab and add a new expense.
4. Go to the "Budgets" tab and set a budget for a category.
5. Visit the "Dashboard" and "Analytics" pages to ensure your data is showing up correctly.

## 6. Known Limitations
*   **Live Pricing Supported Assets**: The live pricing engine currently only supports Mutual Funds, Stocks, and ETFs. Bonds and Cash assets are manually tracked.
*   **Gold Pricing**: Live Gold pricing requires an optional API key from a provider like MetalPriceAPI. Without it, gold prices must be updated manually.
*   **Investment Search Quirks**: The application integrates with Yahoo Finance (`yfinance`) for stock/ETF tickers. The search engine works best when providing exact ticker symbols or exact fund names rather than generic terms.

## 7. Troubleshooting
*   **SSL Certificate Errors / API Fetch Failures**: If you are on a restrictive network, corporate proxy, or have aggressive antivirus software that intercepts SSL traffic, Python's `yfinance` or `requests` library might throw SSL certificate verification errors resulting in failed live price updates.
*   **Port Conflicts**: If the backend fails to start because port 8000 is in use, or the frontend switches to 5174 instead of 5173, ensure you don't have other instances of the app running in the background. You can kill them or change the ports.
*   **Connection Refused (MongoDB)**: If the backend crashes with a `ServerSelectionTimeoutError` or `ConnectionRefusedError`, it means your local MongoDB server is not running or your Atlas connection string is incorrect/IP-restricted.

## 8. Tech Credits
This project makes use of excellent free-tier APIs to power live pricing:
*   [mfapi.in](https://www.mfapi.in/) - For Indian Mutual Fund NAVs.
*   **Yahoo Finance** (via `yfinance` Python library) - For global Stock and ETF pricing.
Because these are unofficial/free-tier endpoints, occasional downtime, rate limiting, or temporary outages are possible.
