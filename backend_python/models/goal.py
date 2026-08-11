from datetime import datetime
from typing import Optional
from beanie import Document, PydanticObjectId
from pydantic import Field
from enum import Enum

class GoalStatus(str, Enum):
    ON_TRACK = 'On Track'
    AT_RISK = 'At Risk'
    COMPLETED = 'Completed'

class Goal(Document):
    user: PydanticObjectId
    goalName: str
    targetAmount: float = Field(ge=0)
    currentAmount: float = Field(default=0, ge=0)
    targetDate: datetime
    status: GoalStatus = GoalStatus.ON_TRACK
    household: Optional[PydanticObjectId] = None

    class Settings:
        name = "goals"
