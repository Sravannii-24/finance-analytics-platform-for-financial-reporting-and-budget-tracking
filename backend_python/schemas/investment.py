from pydantic import BaseModel, Field, model_validator
from typing import Optional
from datetime import datetime
from models.investment import AssetType
import os

class InvestmentBase(BaseModel):
    assetType: AssetType
    assetName: str
    quantity: float = Field(ge=0)
    purchasePrice: float = Field(ge=0)
    currentPrice: Optional[float] = Field(default=None, ge=0)
    purchaseDate: Optional[datetime] = None
    mfSchemeCode: Optional[str] = None
    stockTicker: Optional[str] = None

    @model_validator(mode='after')
    def validate_current_price(self):
        is_live_gold = self.assetType == AssetType.GOLD and os.getenv("GOLD_API_KEY")
        if not self.mfSchemeCode and not self.stockTicker and not is_live_gold:
            if self.currentPrice is None:
                raise ValueError('Please enter current price per unit')
        return self

class InvestmentCreate(InvestmentBase):
    pass

class InvestmentUpdate(BaseModel):
    assetType: Optional[AssetType] = None
    assetName: Optional[str] = None
    quantity: Optional[float] = Field(default=None, ge=0)
    purchasePrice: Optional[float] = Field(default=None, ge=0)
    currentPrice: Optional[float] = Field(default=None, ge=0)
    purchaseDate: Optional[datetime] = None
    mfSchemeCode: Optional[str] = None
    stockTicker: Optional[str] = None
