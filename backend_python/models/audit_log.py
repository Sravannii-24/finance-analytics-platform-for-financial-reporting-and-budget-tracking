from datetime import datetime
from typing import Optional, Any
from beanie import Document, PydanticObjectId
from pydantic import Field

class AuditLog(Document):
    user: PydanticObjectId
    household: Optional[PydanticObjectId] = None
    action: str
    resourceType: str
    resourceId: Optional[PydanticObjectId] = None
    previousValue: Optional[Any] = None
    newValue: Optional[Any] = None
    ipAddress: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "auditlogs"
