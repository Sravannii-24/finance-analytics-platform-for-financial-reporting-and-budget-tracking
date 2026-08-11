from datetime import datetime
from typing import List, Optional
from beanie import Document, PydanticObjectId
from pydantic import Field
from enum import Enum
from pymongo import IndexModel, ASCENDING

from pydantic import BaseModel, Field

class Role(str, Enum):
    OWNER = 'Owner'
    MEMBER = 'Member'

class HouseholdMember(BaseModel):
    user: PydanticObjectId
    role: Role = Role.MEMBER
    joinedAt: datetime = Field(default_factory=datetime.utcnow)

class Household(Document):
    name: str = Field(..., min_length=1)
    owner: PydanticObjectId
    members: List[HouseholdMember]
    inviteCode: str
    createdAt: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "households"
        indexes = [
            IndexModel([("inviteCode", ASCENDING)], unique=True)
        ]
