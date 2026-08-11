from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from models.recurring_expense import RecurringFrequency

class RecurringExpenseCreate(BaseModel):
    amount: float = Field(ge=0)
    category: str
    frequency: RecurringFrequency
    nextDueDate: datetime
    description: Optional[str] = None

class RecurringExpenseUpdate(BaseModel):
    amount: Optional[float] = Field(None, ge=0)
    category: Optional[str] = None
    frequency: Optional[RecurringFrequency] = None
    nextDueDate: Optional[datetime] = None
    description: Optional[str] = None
    isActive: Optional[bool] = None

class RecurringExpenseOut(RecurringExpenseCreate):
    id: str
    user: str
    isActive: bool
    createdAt: datetime

    class Config:
        from_attributes = True
