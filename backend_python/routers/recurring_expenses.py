from fastapi import APIRouter, Depends, HTTPException, Request
from core.security import get_current_user
from core.audit_logger import log_audit
from models.user import User
from models.recurring_expense import RecurringExpense
from schemas.recurring_expense import RecurringExpenseCreate, RecurringExpenseUpdate
from services.recurring_expense_check_service import run_recurring_expense_check
from beanie import PydanticObjectId

router = APIRouter()

@router.post("/run-check")
async def trigger_check_manual(current_user: User = Depends(get_current_user)):
    await run_recurring_expense_check()
    return {"success": True, "message": "Recurring check run successfully"}

@router.post("/", status_code=201)
async def create_recurring_expense(request: Request, body: RecurringExpenseCreate, current_user: User = Depends(get_current_user)):
    request.state.user = current_user
    
    rule = RecurringExpense(
        user=current_user.id,
        amount=body.amount,
        category=body.category,
        description=body.description,
        frequency=body.frequency,
        nextDueDate=body.nextDueDate
    )
    await rule.insert()
    await log_audit(request, "CREATE", "RecurringExpense", rule.id, None, rule.model_dump())
    
    data = rule.model_dump()
    data["_id"] = str(rule.id)
    return {"success": True, "data": data}

@router.get("/")
async def get_recurring_expenses(current_user: User = Depends(get_current_user)):
    rules = await RecurringExpense.find({"user": current_user.id}).sort("-createdAt").to_list()
    data = []
    for r in rules:
        r_dict = r.model_dump()
        r_dict["_id"] = str(r.id)
        data.append(r_dict)
    return {"success": True, "count": len(data), "data": data}

@router.put("/{id}")
async def update_recurring_expense(id: str, request: Request, body: RecurringExpenseUpdate, current_user: User = Depends(get_current_user)):
    request.state.user = current_user
    try:
        obj_id = PydanticObjectId(id)
    except:
        raise HTTPException(status_code=400, detail={"success": False, "message": "Invalid rule ID"})
        
    rule = await RecurringExpense.get(obj_id)
    if not rule:
        raise HTTPException(status_code=404, detail={"success": False, "message": "Rule not found"})
    if str(rule.user) != str(current_user.id):
        raise HTTPException(status_code=403, detail={"success": False, "message": "Not authorized"})
        
    prev = rule.model_dump()
    
    if body.amount is not None: rule.amount = body.amount
    if body.category is not None: rule.category = body.category
    if body.frequency is not None: rule.frequency = body.frequency
    if body.nextDueDate is not None: rule.nextDueDate = body.nextDueDate
    if body.description is not None: rule.description = body.description
    if body.isActive is not None: rule.isActive = body.isActive
    
    await rule.save()
    await log_audit(request, "UPDATE", "RecurringExpense", rule.id, prev, rule.model_dump())
    
    data = rule.model_dump()
    data["_id"] = str(rule.id)
    return {"success": True, "data": data}

@router.delete("/{id}")
async def delete_recurring_expense(id: str, request: Request, current_user: User = Depends(get_current_user)):
    request.state.user = current_user
    try:
        obj_id = PydanticObjectId(id)
    except:
        raise HTTPException(status_code=400, detail={"success": False, "message": "Invalid rule ID"})
        
    rule = await RecurringExpense.get(obj_id)
    if not rule:
        raise HTTPException(status_code=404, detail={"success": False, "message": "Rule not found"})
    if str(rule.user) != str(current_user.id):
        raise HTTPException(status_code=403, detail={"success": False, "message": "Not authorized"})
        
    prev = rule.model_dump()
    await rule.delete()
    await log_audit(request, "DELETE", "RecurringExpense", rule.id, prev, None)
    
    return {"success": True, "message": "Rule removed"}
