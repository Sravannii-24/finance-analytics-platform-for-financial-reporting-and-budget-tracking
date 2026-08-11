from fastapi import APIRouter, Depends, HTTPException, Request
from core.security import get_current_user
from core.audit_logger import log_audit
from models.user import User
from models.goal import Goal, GoalStatus
from models.goal_contribution import GoalContribution
from schemas.goal import GoalCreate, GoalUpdate
from typing import Optional
from datetime import datetime, timezone
import math
from beanie import PydanticObjectId

router = APIRouter()

def compute_goal_status(goal: Goal) -> GoalStatus:
    now = datetime.utcnow().replace(tzinfo=timezone.utc)
    target = goal.targetDate.replace(tzinfo=timezone.utc) if goal.targetDate.tzinfo is None else goal.targetDate
    created = goal.id.generation_time if goal.id else now
    
    progress_percent = min((goal.currentAmount / goal.targetAmount) * 100, 100) if goal.targetAmount > 0 else 0
    if goal.currentAmount >= goal.targetAmount:
        return GoalStatus.COMPLETED
        
    total_duration = (target - created).total_seconds()
    elapsed = (now - created).total_seconds()
    time_elapsed_percent = (elapsed / total_duration) * 100 if total_duration > 0 else 100
    
    if progress_percent >= time_elapsed_percent - 10:
        return GoalStatus.ON_TRACK
    return GoalStatus.AT_RISK

@router.post("/", status_code=201)
async def create_goal(request: Request, body: GoalCreate, current_user: User = Depends(get_current_user)):
    request.state.user = current_user
    
    household_id = current_user.household if body.household and current_user.household else None
    
    goal = Goal(
        user=current_user.id,
        goalName=body.goalName,
        targetAmount=body.targetAmount,
        currentAmount=0,
        targetDate=body.targetDate,
        status=GoalStatus.ON_TRACK,
        household=household_id
    )
    
    await goal.insert()
    goal.status = compute_goal_status(goal)
    await goal.save()
    
    await log_audit(request, "CREATE", "Goal", goal.id)
    
    data = goal.model_dump()
    data["_id"] = str(goal.id)
    return {"success": True, "data": data}

@router.get("/")
async def get_goals(scope: Optional[str] = None, current_user: User = Depends(get_current_user)):
    query = {}
    household_id = getattr(current_user, "household", None)
    if scope == 'household' and household_id:
        query["household"] = household_id
    else:
        query["user"] = current_user.id
        query["household"] = None
        
    goals = await Goal.find(query).sort("-id").to_list()
    
    enriched = []
    now = datetime.utcnow().replace(tzinfo=timezone.utc)
    for goal in goals:
        target = goal.targetDate.replace(tzinfo=timezone.utc) if goal.targetDate.tzinfo is None else goal.targetDate
        days_remaining = math.ceil((target - now).total_seconds() / 86400)
        if days_remaining < 0: days_remaining = 0
        
        progress_percent = min(round((goal.currentAmount / goal.targetAmount) * 100, 1), 100) if goal.targetAmount > 0 else 0
        status = compute_goal_status(goal)
        
        months_remaining = max(days_remaining / 30, 0)
        amount_needed = max(goal.targetAmount - goal.currentAmount, 0)
        monthly_savings_needed = round(amount_needed / months_remaining, 2) if months_remaining > 0 else amount_needed
        
        goal_dict = goal.model_dump()
        goal_dict["_id"] = str(goal.id)
        goal_dict["progressPercent"] = progress_percent
        goal_dict["daysRemaining"] = days_remaining
        goal_dict["status"] = status
        goal_dict["monthlySavingsNeeded"] = monthly_savings_needed
        enriched.append(goal_dict)
        
    return {"success": True, "count": len(enriched), "data": enriched}

@router.put("/{id}")
async def update_goal(id: str, request: Request, current_user: User = Depends(get_current_user)):
    request.state.user = current_user
    
    try:
        obj_id = PydanticObjectId(id)
    except:
        raise HTTPException(status_code=400, detail={"success": False, "message": "Invalid goal ID"})
        
    goal = await Goal.get(obj_id)
    if not goal:
        raise HTTPException(status_code=404, detail={"success": False, "message": "Goal not found"})
        
    prev = goal.model_dump()
    
    body = await request.json()
    if "goalName" in body: goal.goalName = body["goalName"]
    if "targetAmount" in body: goal.targetAmount = float(body["targetAmount"])
    if "targetDate" in body: 
        goal.targetDate = datetime.fromisoformat(body["targetDate"].replace('Z', '+00:00'))
    if "household" in body and body["household"] is not None:
        if body["household"] and current_user.household:
            goal.household = current_user.household
        else:
            goal.household = None
        
    if "contributionAmount" in body and float(body["contributionAmount"]) > 0:
        contrib_amt = float(body["contributionAmount"])
        goal.currentAmount = round(goal.currentAmount + contrib_amt, 2)
        contrib = GoalContribution(
            goal=goal.id,
            amount=contrib_amt,
            date=datetime.utcnow(),
            note=body.get("contributionNote", "")
        )
        await contrib.insert()
        
    goal.status = compute_goal_status(goal)
    await goal.save()
    
    await log_audit(request, "UPDATE", "Goal", goal.id, prev, goal.model_dump())
    
    data = goal.model_dump()
    data["_id"] = str(goal.id)
    return {"success": True, "data": data}

@router.delete("/{id}")
async def delete_goal(id: str, request: Request, current_user: User = Depends(get_current_user)):
    request.state.user = current_user
    try:
        obj_id = PydanticObjectId(id)
    except:
        raise HTTPException(status_code=400, detail={"success": False, "message": "Invalid goal ID"})
        
    goal = await Goal.get(obj_id)
    if not goal:
        raise HTTPException(status_code=404, detail={"success": False, "message": "Goal not found"})
        
    prev = goal.model_dump()
    
    await GoalContribution.find({"goal": goal.id}).delete()
    await goal.delete()
    
    await log_audit(request, "DELETE", "Goal", goal.id, prev, None)
    return {"success": True, "message": "Goal removed"}

@router.get("/{id}/progress")
async def get_goal_progress(id: str, current_user: User = Depends(get_current_user)):
    try:
        obj_id = PydanticObjectId(id)
    except:
        raise HTTPException(status_code=400, detail={"success": False, "message": "Invalid goal ID"})
        
    goal = await Goal.get(obj_id)
    if not goal:
        raise HTTPException(status_code=404, detail={"success": False, "message": "Goal not found"})
        
    now = datetime.utcnow().replace(tzinfo=timezone.utc)
    target = goal.targetDate.replace(tzinfo=timezone.utc) if goal.targetDate.tzinfo is None else goal.targetDate
    
    days_remaining = math.ceil((target - now).total_seconds() / 86400)
    if days_remaining < 0: days_remaining = 0
    months_remaining = max(days_remaining / 30, 0)
    progress_percent = min(round((goal.currentAmount / goal.targetAmount) * 100, 2), 100) if goal.targetAmount > 0 else 0
    amount_needed = max(goal.targetAmount - goal.currentAmount, 0)
    monthly_savings_needed = round(amount_needed / months_remaining, 2) if months_remaining > 0 else amount_needed
    status = compute_goal_status(goal)
    
    contribs = await GoalContribution.find({"goal": goal.id}).sort("-date").to_list()
    contribs_data = []
    for c in contribs:
        c_dict = c.model_dump()
        c_dict["_id"] = str(c.id)
        c_dict["goal"] = str(c.goal)
        contribs_data.append(c_dict)
        
    goal_dict = goal.model_dump()
    goal_dict["_id"] = str(goal.id)
    
    return {
        "success": True,
        "data": {
            "goal": goal_dict,
            "progressPercent": progress_percent,
            "daysRemaining": days_remaining,
            "monthsRemaining": round(months_remaining, 1),
            "amountNeeded": round(amount_needed, 2),
            "monthlySavingsNeeded": monthly_savings_needed,
            "status": status,
            "contributions": contribs_data
        }
    }
