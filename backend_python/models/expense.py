from datetime import datetime
from typing import Optional
from beanie import Document, PydanticObjectId
from pydantic import Field
from enum import Enum

class ExpenseCategory(str, Enum):
    FOOD = "Food"
    HOUSING = "Housing"
    TRANSPORT = "Transport"
    UTILITIES = "Utilities"
    ENTERTAINMENT = "Entertainment"
    OTHER = "Other"

class PaymentMode(str, Enum):
    ONLINE = "Online"
    OFFLINE = "Offline"

class PaymentMethod(str, Enum):
    UPI = "UPI"
    CREDIT_CARD = "Credit Card"
    DEBIT_CARD = "Debit Card"
    NET_BANKING = "Net Banking"
    BANK_TRANSFER = "Bank Transfer"
    CASH = "Cash"
    OTHER = "Other"

class Expense(Document):
    user: PydanticObjectId
    amount: float = Field(ge=0)
    category: ExpenseCategory
    date: datetime = Field(default_factory=datetime.utcnow)
    description: Optional[str] = None
    paymentMode: PaymentMode = PaymentMode.OFFLINE
    paymentMethod: PaymentMethod = PaymentMethod.CASH
    recurringExpenseId: Optional[PydanticObjectId] = None

    class Settings:
        name = "expenses"
