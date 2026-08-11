from pydantic import BaseModel, Field
from models.budget import BudgetCategory
from typing import Optional

class BudgetUpsert(BaseModel):
    category: BudgetCategory
    amount: float = Field(..., ge=0)
    month: str = Field(..., pattern=r'^\d{4}-\d{2}$')
    household: Optional[bool] = False
