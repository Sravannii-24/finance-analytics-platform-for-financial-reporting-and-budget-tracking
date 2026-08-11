from fastapi import APIRouter, Depends
from typing import Optional
from core.security import get_current_user
from models.user import User
from services.analytics_engine import (
    get_spending_analysis,
    get_recommendations,
    get_health_score,
    get_trends_predictions
)

router = APIRouter()

@router.get("/spending-analysis")
async def spending_analysis(month: Optional[str] = None, current_user: User = Depends(get_current_user)):
    data = await get_spending_analysis(current_user.id, month)
    return {"success": True, "data": data}

@router.get("/recommendations")
async def recommendations(current_user: User = Depends(get_current_user)):
    data = await get_recommendations(current_user.id)
    return {"success": True, "data": data}

@router.get("/health-score")
async def health_score(current_user: User = Depends(get_current_user)):
    data = await get_health_score(current_user.id)
    return {"success": True, "data": data}

@router.get("/trends-predictions")
async def trends_predictions(month: Optional[str] = None, current_user: User = Depends(get_current_user)):
    data = await get_trends_predictions(current_user.id, month)
    return {"success": True, "data": data}
