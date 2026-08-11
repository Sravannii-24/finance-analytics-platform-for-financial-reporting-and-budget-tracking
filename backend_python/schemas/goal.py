from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from models.goal import GoalStatus

class GoalBase(BaseModel):
    goalName: str
    targetAmount: float = Field(..., ge=0)
    targetDate: datetime
    household: Optional[bool] = False

class GoalCreate(GoalBase):
    pass

class GoalUpdate(BaseModel):
    goalName: Optional[str] = None
    targetAmount: Optional[float] = Field(None, ge=0)
    targetDate: Optional[datetime] = None
    contributionAmount: Optional[float] = Field(None, ge=0)
    contributionNote: Optional[str] = None
    household: Optional[bool] = None
    status: Optional[GoalStatus] = None

class GoalContributionCreate(BaseModel):
    amount: float = Field(gt=0)
    date: Optional[datetime] = None
    note: Optional[str] = None
