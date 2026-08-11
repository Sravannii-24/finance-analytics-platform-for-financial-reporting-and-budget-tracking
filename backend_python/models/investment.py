from datetime import datetime
from typing import Optional
from beanie import Document, PydanticObjectId
from pydantic import Field
from enum import Enum

class AssetType(str, Enum):
    STOCK = 'Stock'
    MUTUAL_FUND = 'Mutual Fund'
    ETF = 'ETF'
    BOND = 'Bond'
    GOLD = 'Gold'
    CASH = 'Cash'
    OTHER = 'Other'

class PriceSource(str, Enum):
    LIVE = 'Live'
    MANUAL = 'Manual'

class Investment(Document):
    user: PydanticObjectId
    assetType: AssetType
    assetName: str
    quantity: float = Field(ge=0)
    purchasePrice: float = Field(ge=0)
    currentPrice: Optional[float] = Field(default=None, ge=0)
    purchaseDate: datetime = Field(default_factory=datetime.utcnow)
    mfSchemeCode: Optional[str] = None
    stockTicker: Optional[str] = None
    lastPriceUpdate: Optional[datetime] = None
    lastPriceError: Optional[str] = None
    priceSource: PriceSource = PriceSource.MANUAL
    
    class Settings:
        name = "investments"
