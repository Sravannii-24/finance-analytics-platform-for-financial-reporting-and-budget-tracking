from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from models.notification import NotificationType

class NotificationReadUpdate(BaseModel):
    isRead: bool

class NotificationOut(BaseModel):
    id: str
    user: str
    type: NotificationType
    title: str
    message: str
    isRead: bool
    createdAt: datetime

    class Config:
        from_attributes = True
