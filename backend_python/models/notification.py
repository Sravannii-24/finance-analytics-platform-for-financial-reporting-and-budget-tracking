from datetime import datetime
from beanie import Document, PydanticObjectId
from pydantic import Field
from enum import Enum
import pymongo

class NotificationType(str, Enum):
    BUDGET_ALERT = 'Budget Alert'
    INVESTMENT_UPDATE = 'Investment Update'
    GOAL_REMINDER = 'Goal Reminder'
    MONTHLY_SUMMARY = 'Monthly Summary'
    SYSTEM = 'System'

class Notification(Document):
    user: PydanticObjectId
    type: NotificationType
    title: str = Field(..., min_length=1)
    message: str = Field(..., min_length=1)
    isRead: bool = False
    createdAt: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "notifications"
        indexes = [
            [("user", pymongo.ASCENDING), ("createdAt", pymongo.DESCENDING)]
        ]
