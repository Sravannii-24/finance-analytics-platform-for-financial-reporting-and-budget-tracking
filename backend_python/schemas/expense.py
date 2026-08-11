from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from models.expense import ExpenseCategory, PaymentMethod

class ExpenseCreate(BaseModel):
    amount: float = Field(ge=0)
    category: ExpenseCategory
    date: datetime
    description: Optional[str] = None
    paymentMethod: PaymentMethod = PaymentMethod.CASH

class ExpenseUpdate(BaseModel):
    amount: Optional[float] = Field(None, ge=0)
    category: Optional[ExpenseCategory] = None
    date: Optional[datetime] = None
    description: Optional[str] = None
    paymentMethod: Optional[PaymentMethod] = None
