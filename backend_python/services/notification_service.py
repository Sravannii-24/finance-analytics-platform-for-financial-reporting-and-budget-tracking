from datetime import datetime
from dateutil.relativedelta import relativedelta
from models.expense import Expense
from models.budget import Budget
from models.goal import Goal
from models.user import User
from models.notification import Notification, NotificationType
from beanie import PydanticObjectId

def get_month_str(date_obj: datetime, month_offset: int = 0) -> str:
    d = date_obj + relativedelta(months=month_offset)
    return f"{d.year}-{str(d.month).zfill(2)}"

def format_inr(amount):
    return f"₹{amount:,.0f}"

async def generate_alerts(user_id: PydanticObjectId):
    try:
        now = datetime.utcnow()
        current_month_str = get_month_str(now)
        cm_year, cm_month = map(int, current_month_str.split('-'))
        start_date = datetime(cm_year, cm_month, 1)
        end_date = start_date + relativedelta(months=1, seconds=-1)

        budgets = await Budget.find({"user": user_id, "month": current_month_str}).to_list()
        expenses = await Expense.find({
            "user": user_id,
            "date": {"$gte": start_date, "$lte": end_date}
        }).to_list()
        goals = await Goal.find({"user": user_id}).to_list()

        for budget in budgets:
            spent = sum(e.amount for e in expenses if e.category == budget.category)
            utilization = spent / budget.amount if budget.amount > 0 else 0

            if utilization >= 1.0:
                exists = await Notification.find_one({"user": user_id, "title": {"$regex": f"Over budget.*{budget.category}"}})
                if not exists:
                    notif = Notification(
                        user=user_id,
                        type=NotificationType.BUDGET_ALERT,
                        title=f"Over budget: {budget.category}",
                        message=f"You've exceeded your {budget.category} budget! Spent {format_inr(spent)} of {format_inr(budget.amount)} ({round(utilization * 100)}%)."
                    )
                    await notif.insert()
            elif utilization >= 0.9:
                exists = await Notification.find_one({"user": user_id, "title": {"$regex": f"Near limit.*{budget.category}"}})
                if not exists:
                    notif = Notification(
                        user=user_id,
                        type=NotificationType.BUDGET_ALERT,
                        title=f"Near limit: {budget.category}",
                        message=f"{budget.category} budget is at {round(utilization * 100)}%. Spent {format_inr(spent)} of {format_inr(budget.amount)}."
                    )
                    await notif.insert()

        for goal in goals:
            progress_pct = (goal.currentAmount / goal.targetAmount) * 100 if goal.targetAmount > 0 else 0
            milestones = [25, 50, 75, 100]
            
            for milestone in milestones:
                if progress_pct >= milestone:
                    exists = await Notification.find_one({"user": user_id, "title": {"$regex": f"{goal.goalName}.*{milestone}%"}})
                    if not exists:
                        notif = Notification(
                            user=user_id,
                            type=NotificationType.GOAL_REMINDER,
                            title=f"{goal.goalName} reached {milestone}%!",
                            message=f"You've reached {milestone}% of your goal \"{goal.goalName}\". {format_inr(goal.currentAmount)} of {format_inr(goal.targetAmount)} saved!"
                        )
                        await notif.insert()
            
            if getattr(goal.status, 'value', goal.status) == 'At Risk':
                exists = await Notification.find_one({"user": user_id, "title": {"$regex": f"At risk.*{goal.goalName}"}})
                if not exists:
                    notif = Notification(
                        user=user_id,
                        type=NotificationType.GOAL_REMINDER,
                        title=f"At risk: {goal.goalName}",
                        message=f"Your goal \"{goal.goalName}\" is behind pace. You have {format_inr(goal.currentAmount)} of {format_inr(goal.targetAmount)} saved."
                    )
                    await notif.insert()
    except Exception as err:
        print(f"Alert generation error: {err}")

async def generate_monthly_summary(user_id: PydanticObjectId):
    now = datetime.utcnow()
    current_month_str = get_month_str(now)
    cm_year, cm_month = map(int, current_month_str.split('-'))
    cm_date = datetime(cm_year, cm_month, 1)
    prev_month_str = get_month_str(cm_date, -1)

    user = await User.get(user_id)
    all_expenses = await Expense.find({"user": user_id}).to_list()
    monthly_income = user.monthlyIncome if user else 0

    current_exp = sum(e.amount for e in all_expenses if get_month_str(e.date) == current_month_str)
    prev_exp = sum(e.amount for e in all_expenses if get_month_str(e.date) == prev_month_str)
    savings = monthly_income - current_exp
    exp_change_percent = round(((current_exp - prev_exp) / prev_exp) * 100) if prev_exp > 0 else 0

    month_names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    month_label = f"{month_names[now.month - 1]} {now.year}"

    change_text = (f"expenses up {exp_change_percent}% vs last month" if exp_change_percent > 0
                   else f"expenses down {abs(exp_change_percent)}% vs last month" if exp_change_percent < 0
                   else "expenses unchanged vs last month")

    notification = Notification(
        user=user_id,
        type=NotificationType.MONTHLY_SUMMARY,
        title=f"{month_label} Summary",
        message=f"Total spent: {format_inr(current_exp)} | Saved: {format_inr(max(0, savings))} | {change_text}."
    )
    await notification.insert()
    return notification
