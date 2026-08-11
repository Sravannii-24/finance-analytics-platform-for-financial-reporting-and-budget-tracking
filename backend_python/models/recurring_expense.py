from datetime import datetime
from typing import Optional
from beanie import Document, PydanticObjectId
from pydantic import Field
from enum import Enum

class RecurringFrequency(str, Enum):
    WEEKLY = 'Weekly'
    MONTHLY = 'Monthly'

class RecurringExpense(Document):
    user: PydanticObjectId
    amount: float = Field(ge=0)
    category: str = Field(..., description="Must match Expense categories")
    description: Optional[str] = None
    frequency: RecurringFrequency
    nextDueDate: datetime
    isActive: bool = True
    createdAt: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "recurringexpenses"
