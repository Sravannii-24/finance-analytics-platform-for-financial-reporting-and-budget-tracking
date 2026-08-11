from datetime import datetime
from typing import Optional
from beanie import Document, PydanticObjectId
from pymongo import IndexModel, ASCENDING
from pydantic import EmailStr

class User(Document):
    name: str
    email: EmailStr
    password: str
    monthlyIncome: float = 0.0
    resetPasswordToken: Optional[str] = None
    resetPasswordExpire: Optional[datetime] = None
    household: Optional[PydanticObjectId] = None
    
    class Settings:
        name = "users"
        indexes = [
            IndexModel([("email", ASCENDING)], unique=True)
        ]
