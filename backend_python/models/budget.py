from typing import Optional
from beanie import Document, PydanticObjectId
from pydantic import Field
from pymongo import IndexModel, ASCENDING
from enum import Enum

class BudgetCategory(str, Enum):
    FOOD = "Food"
    HOUSING = "Housing"
    TRANSPORT = "Transport"
    UTILITIES = "Utilities"
    ENTERTAINMENT = "Entertainment"
    OTHER = "Other"

class Budget(Document):
    user: PydanticObjectId
    category: BudgetCategory
    amount: float = Field(ge=0)
    month: str = Field(pattern=r'^\d{4}-\d{2}$')
    household: Optional[PydanticObjectId] = None

    class Settings:
        name = "budgets"
        indexes = [
            IndexModel(
                [("user", ASCENDING), ("category", ASCENDING), ("month", ASCENDING), ("household", ASCENDING)],
                unique=True
            ),
            IndexModel(
                [("household", ASCENDING), ("category", ASCENDING), ("month", ASCENDING)],
                unique=True,
                partialFilterExpression={"household": {"$type": "objectId"}}
            )
        ]
