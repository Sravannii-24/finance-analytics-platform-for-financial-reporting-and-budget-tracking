from pydantic import BaseModel, Field

class HouseholdCreate(BaseModel):
    name: str = Field(..., min_length=1)

class HouseholdJoin(BaseModel):
    inviteCode: str = Field(..., min_length=1)
