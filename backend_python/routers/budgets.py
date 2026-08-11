from fastapi import APIRouter, Depends, HTTPException, Request
from core.security import get_current_user
from core.audit_logger import log_audit
from models.user import User
from models.expense import Expense
from models.budget import Budget
from schemas.budget import BudgetUpsert
from typing import Optional
from datetime import datetime, timezone
import calendar

router = APIRouter()

@router.post("/", status_code=200)
async def set_budget(request: Request, body: BudgetUpsert, current_user: User = Depends(get_current_user)):
    request.state.user = current_user
    
    query = {"user": current_user.id, "category": body.category.value, "month": body.month}
    existing_budget = await Budget.find_one(query)
    
    prev = None
    if existing_budget:
        prev = existing_budget.model_dump()
        action = "UPDATE"
        existing_budget.amount = body.amount
        existing_budget.household = current_user.household if body.household and current_user.household else None
        await existing_budget.save()
        budget = existing_budget
    else:
        action = "CREATE"
        budget = Budget(
            user=current_user.id,
            category=body.category,
            amount=body.amount,
            month=body.month,
            household=current_user.household if body.household and current_user.household else None
        )
        await budget.insert()
        
    await log_audit(request, action, "Budget", budget.id, prev, budget.model_dump())
    
    budget_dict = budget.model_dump()
    budget_dict["_id"] = str(budget.id)
    
    return {
        "success": True,
        "data": budget_dict
    }

@router.get("/")
async def get_budgets(
    month: Optional[str] = None,
    scope: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    if not month:
        raise HTTPException(status_code=400, detail={"success": False, "message": "Please provide a month parameter (YYYY-MM)"})
        
    query = {"month": month}
    if scope == 'household' and current_user.household:
        query["household"] = current_user.household
    else:
        query["user"] = current_user.id
        query["household"] = None
        
    budgets = await Budget.find(query).to_list()
    
    budgets_data = []
    for b in budgets:
        b_dict = b.model_dump()
        b_dict["_id"] = str(b.id)
        if b.household:
            b_dict["household"] = str(b.household)
        budgets_data.append(b_dict)
        
    return {
        "success": True,
        "count": len(budgets_data),
        "data": budgets_data
    }

@router.get("/utilization")
async def get_budget_utilization(
    month: Optional[str] = None,
    scope: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    if not month:
        raise HTTPException(status_code=400, detail={"success": False, "message": "Please provide a month parameter (YYYY-MM)"})
        
    budget_query = {"month": month}
    is_household_scope = (scope == 'household' and current_user.household is not None)
    
    if is_household_scope:
        budget_query["household"] = current_user.household
    else:
        budget_query["user"] = current_user.id
        budget_query["household"] = None
        
    budgets = await Budget.find(budget_query).to_list()
    
    household_members = [current_user.id]
    if is_household_scope:
        users_in_hh = await User.find({"household": current_user.household}).to_list()
        household_members = [u.id for u in users_in_hh]
        
    try:
        year_str, month_str = month.split('-')
        year_int = int(year_str)
        month_int = int(month_str)
        start_date = datetime(year_int, month_int, 1, tzinfo=timezone.utc)
        last_day = calendar.monthrange(year_int, month_int)[1]
        end_date = datetime(year_int, month_int, last_day, 23, 59, 59, 999999, tzinfo=timezone.utc)
    except:
        raise HTTPException(status_code=400, detail={"success": False, "message": "Invalid month format. Use YYYY-MM"})
        
    expenses = await Expense.find(
        {"user": {"$in": household_members}, "date": {"$gte": start_date, "$lte": end_date}}
    ).to_list()
    
    categories = ['Food', 'Housing', 'Transport', 'Utilities', 'Entertainment', 'Other']
    utilization = []
    
    for cat in categories:
        budget_obj = next((b for b in budgets if b.category == cat), None)
        budget_amount = budget_obj.amount if budget_obj else 0
        
        relevant_expenses = []
        for e in expenses:
            if e.category != cat:
                continue
            if is_household_scope:
                relevant_expenses.append(e)
            else:
                if str(e.user) == str(current_user.id):
                    relevant_expenses.append(e)
                    
        total_spent = sum(e.amount for e in relevant_expenses)
        percentage = (total_spent / budget_amount) * 100 if budget_amount > 0 else 0
        
        util_obj = {
            "category": cat,
            "budget": budget_amount,
            "spent": total_spent,
            "percentage": round(percentage, 2),
            "isOverBudget": budget_amount > 0 and total_spent > budget_amount,
            "isNearLimit": budget_amount > 0 and (total_spent / budget_amount) >= 0.9,
            "household": str(budget_obj.household) if budget_obj and budget_obj.household else None
        }
        utilization.append(util_obj)
        
    return {
        "success": True,
        "data": utilization
    }
