from datetime import datetime, timezone
from dateutil.relativedelta import relativedelta
from models.expense import Expense
from models.budget import Budget
from models.investment import Investment
from models.goal import Goal
from models.user import User
from beanie import PydanticObjectId
import math
import calendar

def get_month_str(date_obj: datetime, month_offset: int = 0) -> str:
    d = date_obj + relativedelta(months=month_offset)
    return f"{d.year}-{str(d.month).zfill(2)}"

def sum_by_category(expenses) -> dict:
    acc = {}
    for e in expenses:
        acc[e.category] = acc.get(e.category, 0) + e.amount
    return acc

def filter_by_month(expenses, month_str: str):
    return [e for e in expenses if get_month_str(e.date) == month_str]

def format_inr(amount):
    return f"₹{amount:,.0f}"

async def get_spending_analysis(user_id: PydanticObjectId, month: str = None):
    now = datetime.now(timezone.utc)
    current_month = month or get_month_str(now)
    cm_year, cm_month = map(int, current_month.split('-'))
    cm_date = datetime(cm_year, cm_month, 1, tzinfo=timezone.utc)
    prev_month = get_month_str(cm_date, -1)

    six_months_ago = now - relativedelta(months=5)
    six_months_ago = datetime(six_months_ago.year, six_months_ago.month, 1, tzinfo=timezone.utc)

    all_expenses = await Expense.find({"user": user_id, "date": {"$gte": six_months_ago}}).to_list()
    current_budgets = await Budget.find({"user": user_id, "month": current_month}).to_list()
    user = await User.get(user_id)

    monthly_income = user.monthlyIncome if user else 0

    current_expenses = filter_by_month(all_expenses, current_month)
    prev_expenses = filter_by_month(all_expenses, prev_month)

    current_by_category = sum_by_category(current_expenses)
    prev_by_category = sum_by_category(prev_expenses)
    total_current_spend = sum(e.amount for e in current_expenses)

    CATEGORIES = ['Food', 'Housing', 'Transport', 'Utilities', 'Entertainment', 'Other']

    category_breakdown = []
    budget_categories = {b.category for b in current_budgets}
    for cat in CATEGORIES:
        current = current_by_category.get(cat, 0)
        prev = prev_by_category.get(cat, 0)
        pct_of_total = round((current / total_current_spend) * 100) if total_current_spend > 0 else 0
        change_vs_prev = round(((current - prev) / prev) * 100) if prev > 0 else (100 if current > 0 else 0)
        is_spike = prev > 0 and change_vs_prev > 15
        if current > 0 or cat in budget_categories:
            category_breakdown.append({
                "category": cat,
                "amount": current,
                "pctOfTotal": pct_of_total,
                "changeVsPrev": change_vs_prev,
                "isSpike": is_spike
            })

    month_names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    cash_flow_trend = []
    for i in range(6):
        d = now - relativedelta(months=5 - i)
        m_str = get_month_str(d)
        m_exp = sum(e.amount for e in filter_by_month(all_expenses, m_str))
        savings = max(0, monthly_income - m_exp)
        cash_flow_trend.append({
            "name": f"{month_names[d.month - 1]} '{str(d.year)[2:]}",
            "Income": monthly_income,
            "Expenses": round(m_exp),
            "Savings": round(savings)
        })

    last_3_months = []
    for i in range(3):
        d = now - relativedelta(months=i)
        m_str = get_month_str(d)
        m_exp = sum(e.amount for e in filter_by_month(all_expenses, m_str))
        last_3_months.append(m_exp)
    avg_monthly_expense = round(sum(last_3_months) / 3) if last_3_months else 0

    online_expenses = [e for e in current_expenses if getattr(e, "paymentMode", "Offline") == "Online"]
    offline_expenses = [e for e in current_expenses if getattr(e, "paymentMode", "Offline") == "Offline"]
    total_online = sum(e.amount for e in online_expenses)
    total_offline = sum(e.amount for e in offline_expenses)

    payment_split = {
        "onlineAmount": total_online,
        "offlineAmount": total_offline,
        "onlinePct": round((total_online / total_current_spend) * 100) if total_current_spend > 0 else 0,
        "offlinePct": round((total_offline / total_current_spend) * 100) if total_current_spend > 0 else 0,
    }

    return {
        "currentMonth": current_month,
        "totalCurrentSpend": total_current_spend,
        "avgMonthlyExpense": avg_monthly_expense,
        "categoryBreakdown": category_breakdown,
        "cashFlowTrend": cash_flow_trend,
        "spendingSpikes": [c for c in category_breakdown if c["isSpike"]],
        "paymentSplit": payment_split,
    }


async def get_recommendations(user_id: PydanticObjectId):
    now = datetime.now(timezone.utc)
    recommendations = []
    months = [get_month_str(now - relativedelta(months=i)) for i in range(3)]

    all_expenses = await Expense.find({"user": user_id}).to_list()
    all_budgets = await Budget.find({"user": user_id, "month": {"$in": months}}).to_list()
    investments = await Investment.find({"user": user_id}).to_list()
    user = await User.get(user_id)

    monthly_income = user.monthlyIncome if user else 0
    CATEGORIES = ['Food', 'Housing', 'Transport', 'Utilities', 'Entertainment', 'Other']

    for cat in CATEGORIES:
        overrun_count = 0
        avg_overrun_pct = 0
        cat_months = []
        for m in months:
            budget = next((b for b in all_budgets if b.category == cat and b.month == m), None)
            if not budget: continue
            spent = sum(e.amount for e in filter_by_month(all_expenses, m) if e.category == cat)
            utilization = spent / budget.amount if budget.amount > 0 else 0
            if utilization >= 0.9:
                overrun_count += 1
                avg_overrun_pct += utilization
            cat_months.append((m, budget, spent))

        if overrun_count >= 2:
            overage = round(((avg_overrun_pct / overrun_count) - 1) * 100)
            potential_savings = 0
            for m, b, spent in cat_months:
                potential_savings += max(0, spent - b.amount)
            potential_savings = round(potential_savings / max(1, overrun_count))

            recommendations.append({
                "id": f"budget-overrun-{cat}",
                "title": f"Reduce {cat} spending",
                "description": f"Your {cat} budget has been at 90%+ for {overrun_count} consecutive months. Consider cutting spend by ~{max(10, overage)}% or increasing the budget.",
                "potentialSavings": potential_savings,
                "category": cat,
                "type": 'warning',
            })

    current_month_str = get_month_str(now)
    current_expenses = filter_by_month(all_expenses, current_month_str)
    total_expenses = sum(e.amount for e in current_expenses)
    savings_rate = (monthly_income - total_expenses) / monthly_income if monthly_income > 0 else 0
    total_invested = sum(inv.quantity * inv.purchasePrice for inv in investments)
    investment_rate = total_invested / (monthly_income * 12) if monthly_income > 0 else 0

    if savings_rate > 0.2 and investment_rate < 0.15:
        extra = round((savings_rate - 0.2) * monthly_income)
        recommendations.append({
            "id": 'increase-investments',
            "title": 'Boost your investment contributions',
            "description": f"Your savings rate is {round(savings_rate * 100)}%, which is above the 20% benchmark. Consider channelling an extra {format_inr(extra)}/month into SIPs or investments to grow your wealth.",
            "potentialSavings": extra * 12,
            "category": 'Investments',
            "type": 'opportunity',
        })

    ent_expenses = [e for e in all_expenses if e.category == 'Entertainment']
    small_recurring = [e for e in ent_expenses if e.amount < 1000 and getattr(e, "description", "") and 'subscription' in getattr(e, "description", "").lower()]
    if len(small_recurring) >= 3:
        monthly_total = sum(e.amount for e in small_recurring) / max(1, len(months))
        recommendations.append({
            "id": 'subscription-review',
            "title": 'Review recurring subscriptions',
            "description": f"You have {len(small_recurring)} small subscription charges in Entertainment. A subscription audit could save you significantly each month.",
            "potentialSavings": round(monthly_total * 0.4),
            "category": 'Entertainment',
            "type": 'opportunity',
        })

    if len(all_budgets) == 0:
        recommendations.append({
            "id": 'set-budgets',
            "title": 'Set monthly budgets',
            "description": 'You have no budgets configured. Setting category budgets helps track spending and prevents overruns. Start with your top 3 expense categories.',
            "potentialSavings": 0,
            "category": 'General',
            "type": 'info',
        })

    if len(investments) == 0 and monthly_income > 0:
        suggested_sip = round(monthly_income * 0.1)
        recommendations.append({
            "id": 'start-investing',
            "title": 'Start investing today',
            "description": f"You have no investments yet. Even a small monthly SIP of {format_inr(suggested_sip)} (10% of income) can compound significantly over time.",
            "potentialSavings": suggested_sip * 12,
            "category": 'Investments',
            "type": 'opportunity',
        })

    offline_spend = sum(e.amount for e in current_expenses if getattr(e, "paymentMode", "Offline") == "Offline")
    current_total_spend = sum(e.amount for e in current_expenses)
    offline_share = offline_spend / current_total_spend if current_total_spend > 0 else 0

    if offline_share > 0.4:
        recommendations.append({
            "id": 'high-cash-spending',
            "title": 'High cash spending detected',
            "description": f"Your cash/offline spending makes up {round(offline_share * 100)}% of your total expenses this month. Since cash is harder to trace, consider switching more purchases to traceable digital modes (like UPI or Cards) or auditing cash receipts to keep tracking accurate.",
            "potentialSavings": 0,
            "category": 'General',
            "type": 'warning',
        })

    return recommendations

async def get_health_score(user_id: PydanticObjectId):
    now = datetime.now(timezone.utc)
    months = [get_month_str(now - relativedelta(months=i)) for i in range(3)]

    all_expenses = await Expense.find({"user": user_id}).to_list()
    all_budgets = await Budget.find({"user": user_id, "month": {"$in": months}}).to_list()
    investments = await Investment.find({"user": user_id}).to_list()
    user = await User.get(user_id)

    monthly_income = user.monthlyIncome if user else 0
    CATEGORIES = ['Food', 'Housing', 'Transport', 'Utilities', 'Entertainment', 'Other']

    spending_score = 50
    if all_budgets:
        under_budget_count = 0
        total_checks = 0
        for m in months:
            for cat in CATEGORIES:
                budget = next((b for b in all_budgets if b.category == cat and b.month == m), None)
                if not budget: continue
                spent = sum(e.amount for e in filter_by_month(all_expenses, m) if e.category == cat)
                total_checks += 1
                if spent <= budget.amount: under_budget_count += 1
        spending_score = round((under_budget_count / total_checks) * 100) if total_checks > 0 else 50

    savings_score = 30
    if monthly_income > 0:
        current_expenses = filter_by_month(all_expenses, get_month_str(now))
        total_spent = sum(e.amount for e in current_expenses)
        savings_rate = (monthly_income - total_spent) / monthly_income
        savings_score = min(100, max(0, round((savings_rate / 0.2) * 100)))

    investment_score = 0
    if investments and monthly_income > 0:
        total_invested = sum(inv.quantity * inv.purchasePrice for inv in investments)
        annual_invest_rate = total_invested / (monthly_income * 12)
        rate_score = min(60, round(annual_invest_rate * 100))
        unique_types = len(set(i.assetType for i in investments))
        diversification_score = min(40, unique_types * 10)
        investment_score = rate_score + diversification_score

    debt_score = 50
    if all_budgets:
        never_exceeded = 0
        total_months = 0
        for m in months:
            month_ok = True
            had_budget = False
            for cat in CATEGORIES:
                budget = next((b for b in all_budgets if b.category == cat and b.month == m), None)
                if not budget: continue
                had_budget = True
                spent = sum(e.amount for e in filter_by_month(all_expenses, m) if e.category == cat)
                if spent > budget.amount: month_ok = False
            if had_budget:
                total_months += 1
                if month_ok: never_exceeded += 1
        debt_score = round((never_exceeded / total_months) * 100) if total_months > 0 else 50

    overall = round(
        spending_score * 0.25 +
        savings_score * 0.30 +
        investment_score * 0.25 +
        debt_score * 0.20
    )

    label = 'Excellent' if overall >= 71 else 'Good' if overall >= 41 else 'Needs Attention'
    color = '#10b981' if overall >= 71 else '#f59e0b' if overall >= 41 else '#ef4444'

    return {
        "overall": overall,
        "label": label,
        "color": color,
        "factors": [
            {"name": 'Spending Control', "score": spending_score, "weight": 25, "description": 'Budget adherence across all categories'},
            {"name": 'Savings Rate', "score": savings_score, "weight": 30, "description": 'Monthly savings vs 20% income benchmark'},
            {"name": 'Investments', "score": investment_score, "weight": 25, "description": 'Investment rate & portfolio diversification'},
            {"name": 'Budget Consistency', "score": debt_score, "weight": 20, "description": 'Consistency of staying within budgets over time'},
        ]
    }

async def get_trends_predictions(user_id: PydanticObjectId, month: str = None):
    now = datetime.now(timezone.utc)
    current_month_str = month or get_month_str(now)
    cm_year, cm_month = map(int, current_month_str.split('-'))
    days_in_month = calendar.monthrange(cm_year, cm_month)[1]
    
    if current_month_str == get_month_str(now):
        days_elapsed = now.day
    else:
        days_elapsed = days_in_month
        
    days_remaining = days_in_month - days_elapsed

    all_expenses = await Expense.find({"user": user_id}).to_list()
    user = await User.get(user_id)

    monthly_income = user.monthlyIncome if user else 0
    current_expenses = filter_by_month(all_expenses, current_month_str)
    spent_so_far = sum(e.amount for e in current_expenses)

    daily_rate = spent_so_far / days_elapsed if days_elapsed > 0 else 0
    projected_total = round(spent_so_far + daily_rate * days_remaining)
    projected_savings = monthly_income - projected_total

    month_names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    
    spend_by_day = {}
    for e in current_expenses:
        day = e.date.day
        spend_by_day[day] = spend_by_day.get(day, 0) + e.amount

    trend_data = []
    cumulative = 0
    for i in range(days_in_month):
        day = i + 1
        day_label = f"{day} {month_names[cm_month - 1]}"
        if day <= days_elapsed:
            cumulative += spend_by_day.get(day, 0)
            trend_data.append({"day": day_label, "actual": round(cumulative), "projected": None})
        else:
            proj = round(spent_so_far + daily_rate * (day - days_elapsed))
            trend_data.append({"day": day_label, "actual": None, "projected": proj})

    insight = ''
    if projected_total > monthly_income:
        excess = projected_total - monthly_income
        insight = f"⚠️ At your current pace, you'll exceed your income by {format_inr(excess)} this month. Consider cutting back on discretionary spending."
    elif projected_savings > monthly_income * 0.3:
        insight = f"✅ Excellent! You're on track to save {format_inr(projected_savings)} this month ({round((projected_savings / monthly_income) * 100)}% of income). Consider putting the surplus into investments."
    else:
        insight = f"📊 You're projected to spend {format_inr(projected_total)} this month, saving {format_inr(max(0, projected_savings))} ({round((max(0, projected_savings) / max(1, monthly_income)) * 100)}% of income)."

    return {
        "spentSoFar": spent_so_far,
        "projectedTotal": projected_total,
        "projectedSavings": projected_savings,
        "dailyRate": round(daily_rate),
        "daysElapsed": days_elapsed,
        "daysRemaining": days_remaining,
        "daysInMonth": days_in_month,
        "insight": insight,
        "trendData": trend_data
    }
