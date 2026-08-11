from fastapi import APIRouter, Depends, HTTPException, Request
from core.security import get_current_user
from core.audit_logger import log_audit
from models.user import User
from models.expense import Expense
from schemas.expense import ExpenseCreate, ExpenseUpdate
from typing import Optional
from datetime import datetime, timezone
import calendar
from beanie import PydanticObjectId

router = APIRouter()

@router.get("/")
async def get_expenses(
    category: Optional[str] = None,
    month: Optional[str] = None,
    paymentMode: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    query = {"user": current_user.id}
    
    if category:
        query["category"] = category
        
    if paymentMode:
        query["paymentMode"] = paymentMode
        
    if month:
        year_str, month_str = month.split('-')
        year_int = int(year_str)
        month_int = int(month_str)
        
        start_date = datetime(year_int, month_int, 1, tzinfo=timezone.utc)
        last_day = calendar.monthrange(year_int, month_int)[1]
        end_date = datetime(year_int, month_int, last_day, 23, 59, 59, 999999, tzinfo=timezone.utc)
        
        query["date"] = {"$gte": start_date, "$lte": end_date}
        
    expenses = await Expense.find(query).sort("-date").to_list()
    
    expenses_data = []
    for exp in expenses:
        exp_dict = exp.model_dump()
        exp_dict["_id"] = str(exp.id)
        if exp.recurringExpenseId:
            exp_dict["recurringExpenseId"] = str(exp.recurringExpenseId)
        expenses_data.append(exp_dict)
        
    return {
        "success": True,
        "count": len(expenses_data),
        "data": expenses_data
    }

@router.get("/payment-breakdown")
async def get_payment_breakdown(
    month: Optional[str] = None,
    scope: Optional[str] = "personal",
    current_user: User = Depends(get_current_user)
):
    query = {"user": current_user.id}
    
    if month:
        year_str, month_str = month.split('-')
        year_int = int(year_str)
        month_int = int(month_str)
        
        start_date = datetime(year_int, month_int, 1, tzinfo=timezone.utc)
        last_day = calendar.monthrange(year_int, month_int)[1]
        end_date = datetime(year_int, month_int, last_day, 23, 59, 59, 999999, tzinfo=timezone.utc)
        
        query["date"] = {"$gte": start_date, "$lte": end_date}
        
    expenses = await Expense.find(query).to_list()
    
    total_online = 0
    total_offline = 0
    method_totals = {}
    
    for e in expenses:
        if getattr(e, "paymentMode", "Offline") == "Online":
            total_online += e.amount
        else:
            total_offline += e.amount
            
        method = getattr(e, "paymentMethod", "Cash")
        if method not in method_totals:
            method_totals[method] = {"count": 0, "amount": 0}
        method_totals[method]["count"] += 1
        method_totals[method]["amount"] += e.amount
        
    method_breakdown = [{"method": k, "count": v["count"], "amount": v["amount"]} for k, v in method_totals.items()]
    method_breakdown.sort(key=lambda x: x["amount"], reverse=True)
    
    return {
        "success": True,
        "data": {
            "totalOnline": total_online,
            "totalOffline": total_offline,
            "methodBreakdown": method_breakdown
        }
    }

@router.post("/", status_code=201)
async def create_expense(request: Request, body: ExpenseCreate, current_user: User = Depends(get_current_user)):
    request.state.user = current_user
    
    payment_mode = "Online"
    if body.paymentMethod == "Cash":
        payment_mode = "Offline"
        
    expense = Expense(
        user=current_user.id,
        amount=body.amount,
        category=body.category,
        date=body.date,
        description=body.description,
        paymentMethod=body.paymentMethod,
        paymentMode=payment_mode
    )
    await expense.insert()
    
    await log_audit(request, "CREATE", "Expense", expense.id)
    
    exp_dict = expense.model_dump()
    exp_dict["_id"] = str(expense.id)
    
    return {
        "success": True,
        "data": exp_dict
    }

@router.put("/{id}")
async def update_expense(id: str, request: Request, body: ExpenseUpdate, current_user: User = Depends(get_current_user)):
    request.state.user = current_user
    
    try:
        obj_id = PydanticObjectId(id)
    except:
        raise HTTPException(status_code=400, detail={"success": False, "message": "Invalid expense ID format"})
        
    expense = await Expense.get(obj_id)
    if not expense:
        raise HTTPException(status_code=404, detail={"success": False, "message": "Expense not found"})
        
    if str(expense.user) != str(current_user.id):
        raise HTTPException(status_code=401, detail={"success": False, "message": "Not authorized to access this expense"})
        
    prev = expense.model_dump()
    
    if body.amount is not None:
        expense.amount = body.amount
    if body.category is not None:
        expense.category = body.category
    if body.date is not None:
        expense.date = body.date
    if body.description is not None:
        expense.description = body.description
    if body.paymentMethod is not None:
        expense.paymentMethod = body.paymentMethod
        if body.paymentMethod == "Cash":
            expense.paymentMode = "Offline"
        else:
            expense.paymentMode = "Online"
            
    await expense.save()
    
    await log_audit(request, "UPDATE", "Expense", expense.id, prev, expense.model_dump())
    
    exp_dict = expense.model_dump()
    exp_dict["_id"] = str(expense.id)
    
    return {
        "success": True,
        "data": exp_dict
    }

@router.delete("/{id}")
async def delete_expense(id: str, request: Request, current_user: User = Depends(get_current_user)):
    request.state.user = current_user
    
    try:
        obj_id = PydanticObjectId(id)
    except:
        raise HTTPException(status_code=400, detail={"success": False, "message": "Invalid expense ID format"})
        
    expense = await Expense.get(obj_id)
    if not expense:
        raise HTTPException(status_code=404, detail={"success": False, "message": "Expense not found"})
        
    if str(expense.user) != str(current_user.id):
        raise HTTPException(status_code=401, detail={"success": False, "message": "Not authorized to access this expense"})
        
    await expense.delete()
    
    await log_audit(request, "DELETE", "Expense", expense.id)
    
    return {
        "success": True,
        "data": {}
    }
