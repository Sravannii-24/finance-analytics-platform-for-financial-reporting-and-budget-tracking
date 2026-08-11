from datetime import datetime
from typing import Optional
from beanie import Document, PydanticObjectId
from pydantic import Field

class GoalContribution(Document):
    goal: PydanticObjectId
    amount: float = Field(gt=0)
    date: datetime = Field(default_factory=datetime.utcnow)
    note: Optional[str] = None

    class Settings:
        name = "goalcontributions"
