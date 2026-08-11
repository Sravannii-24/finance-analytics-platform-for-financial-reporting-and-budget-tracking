from fastapi import APIRouter, Depends, Request
from core.security import get_current_user
from models.user import User
from schemas.household import HouseholdCreate, HouseholdJoin
from services.household_service import HouseholdService
from core.audit_logger import log_audit

router = APIRouter()

@router.post("/", status_code=201)
async def create_household(request: Request, body: HouseholdCreate, current_user: User = Depends(get_current_user)):
    request.state.user = current_user
    household = await HouseholdService.create_household(current_user.id, body.name)
    await log_audit(request, "CREATE", "Household", household.id)
    return {"success": True, "data": household.model_dump()}

@router.post("/join")
async def join_household(request: Request, body: HouseholdJoin, current_user: User = Depends(get_current_user)):
    request.state.user = current_user
    household = await HouseholdService.join_household(current_user.id, body.inviteCode)
    await log_audit(request, "UPDATE", "Household", household.id, None, {"action": "User Joined"})
    return {"success": True, "data": household.model_dump()}

@router.get("/me")
async def get_household(current_user: User = Depends(get_current_user)):
    data = await HouseholdService.get_household(current_user.id)
    return {"success": True, "data": data}

@router.put("/{id}/budget")
async def mark_budget_shared(id: str, request: Request, current_user: User = Depends(get_current_user)):
    request.state.user = current_user
    budget = await HouseholdService.mark_budget_shared(current_user.id, id)
    await log_audit(request, "UPDATE", "Budget", budget.id, None, budget.model_dump())
    return {"success": True, "data": budget.model_dump()}

@router.delete("/{id}/leave")
async def leave_household(id: str, request: Request, current_user: User = Depends(get_current_user)):
    request.state.user = current_user
    msg = await HouseholdService.leave_household(current_user.id)
    # the exact household id might be dissolved
    return {"success": True, "message": msg}

@router.delete("/{id}/members/{user_id}")
async def remove_member(id: str, user_id: str, request: Request, current_user: User = Depends(get_current_user)):
    request.state.user = current_user
    msg = await HouseholdService.remove_member(current_user.id, id, user_id)
    return {"success": True, "message": msg}
