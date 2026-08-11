from fastapi import APIRouter, Depends, HTTPException, Request
from core.security import get_current_user
from core.audit_logger import log_audit
from models.user import User
from models.investment import Investment, PriceSource, AssetType
from schemas.investment import InvestmentCreate, InvestmentUpdate
from services.price_update_service import fetch_mutual_fund_nav, fetch_stock_price, fetch_gold_price, update_all_live_prices
from typing import Optional
from datetime import datetime
from beanie import PydanticObjectId
import httpx
import os

router = APIRouter()

@router.post("/", status_code=201)
async def add_investment(request: Request, body: InvestmentCreate, current_user: User = Depends(get_current_user)):
    request.state.user = current_user
    
    is_live = bool(body.mfSchemeCode or body.stockTicker)
    current_price = body.currentPrice
    last_price_error = None
    last_price_update = None
    
    if is_live and (current_price is None or current_price == ''):
        try:
            if body.mfSchemeCode:
                info = await fetch_mutual_fund_nav(body.mfSchemeCode)
                current_price = info["price"]
                last_price_update = info["date"]
            elif body.stockTicker:
                info = await fetch_stock_price(body.stockTicker)
                current_price = info["price"]
                last_price_update = info["date"]
        except Exception as err:
            current_price = body.purchasePrice # fallback
            last_price_error = str(err)
            
    investment = Investment(
        user=current_user.id,
        assetType=body.assetType,
        assetName=body.assetName,
        quantity=body.quantity,
        purchasePrice=body.purchasePrice,
        currentPrice=current_price,
        purchaseDate=body.purchaseDate or datetime.utcnow(),
        mfSchemeCode=body.mfSchemeCode,
        stockTicker=body.stockTicker,
        lastPriceError=last_price_error,
        lastPriceUpdate=last_price_update,
        priceSource=PriceSource.LIVE if is_live else PriceSource.MANUAL
    )
    
    await investment.insert()
    await log_audit(request, "CREATE", "Investment", investment.id, None, investment.model_dump())
    
    data = investment.model_dump()
    data["_id"] = str(investment.id)
    return {"success": True, "data": data}

@router.get("/")
async def get_investments(current_user: User = Depends(get_current_user)):
    investments = await Investment.find({"user": current_user.id}).sort("-purchaseDate").to_list()
    data = [i.model_dump() for i in investments]
    for i, d in zip(investments, data):
        d["_id"] = str(i.id)
    return {"success": True, "count": len(data), "data": data}

@router.put("/{id}")
async def update_investment(id: str, request: Request, body: InvestmentUpdate, current_user: User = Depends(get_current_user)):
    request.state.user = current_user
    try:
        obj_id = PydanticObjectId(id)
    except:
        raise HTTPException(status_code=400, detail={"success": False, "message": "Invalid ID"})
        
    inv = await Investment.get(obj_id)
    if not inv:
        raise HTTPException(status_code=404, detail={"success": False, "message": "Investment not found"})
    if str(inv.user) != str(current_user.id):
        raise HTTPException(status_code=403, detail={"success": False, "message": "Not authorized"})
        
    prev = inv.model_dump()
    
    if body.assetType is not None: inv.assetType = body.assetType
    if body.assetName is not None: inv.assetName = body.assetName
    if body.quantity is not None: inv.quantity = body.quantity
    if body.purchasePrice is not None: inv.purchasePrice = body.purchasePrice
    if body.currentPrice is not None: inv.currentPrice = body.currentPrice
    if body.purchaseDate is not None: inv.purchaseDate = body.purchaseDate
    if body.mfSchemeCode is not None: inv.mfSchemeCode = body.mfSchemeCode
    if body.stockTicker is not None: inv.stockTicker = body.stockTicker
    
    is_live = bool(inv.mfSchemeCode or inv.stockTicker)
    inv.priceSource = PriceSource.LIVE if is_live else PriceSource.MANUAL
    
    if is_live and (body.currentPrice is None or body.currentPrice == ''):
        try:
            if inv.mfSchemeCode:
                info = await fetch_mutual_fund_nav(inv.mfSchemeCode)
                inv.currentPrice = info["price"]
            elif inv.stockTicker:
                info = await fetch_stock_price(inv.stockTicker)
                inv.currentPrice = info["price"]
        except Exception as e:
            pass
            
    await inv.save()
    await log_audit(request, "UPDATE", "Investment", inv.id, prev, inv.model_dump())
    
    data = inv.model_dump()
    data["_id"] = str(inv.id)
    return {"success": True, "data": data}

@router.delete("/{id}")
async def delete_investment(id: str, request: Request, current_user: User = Depends(get_current_user)):
    request.state.user = current_user
    try:
        obj_id = PydanticObjectId(id)
    except:
        raise HTTPException(status_code=400, detail={"success": False, "message": "Invalid ID"})
        
    inv = await Investment.get(obj_id)
    if not inv:
        raise HTTPException(status_code=404, detail={"success": False, "message": "Investment not found"})
    if str(inv.user) != str(current_user.id):
        raise HTTPException(status_code=403, detail={"success": False, "message": "Not authorized"})
        
    prev = inv.model_dump()
    await inv.delete()
    await log_audit(request, "DELETE", "Investment", inv.id, prev, None)
    
    return {"success": True, "message": "Investment removed"}

@router.get("/allocation")
async def get_allocation(current_user: User = Depends(get_current_user)):
    investments = await Investment.find({"user": current_user.id}).to_list()
    total_value = sum((i.quantity * (i.currentPrice or 0)) for i in investments)
    
    grouped = {}
    for inv in investments:
        val = inv.quantity * (inv.currentPrice or 0)
        grouped[inv.assetType] = grouped.get(inv.assetType, 0) + val
        
    allocation = []
    for type_, value in grouped.items():
        allocation.append({
            "assetType": type_,
            "currentValue": round(value, 2),
            "percentage": round((value / total_value) * 100, 2) if total_value > 0 else 0
        })
        
    return {"success": True, "data": allocation, "totalValue": round(total_value, 2)}

@router.get("/performance")
async def get_performance(current_user: User = Depends(get_current_user)):
    investments = await Investment.find({"user": current_user.id}).to_list()
    
    total_invested = 0
    total_current_value = 0
    holdings = []
    
    for inv in investments:
        curr_price = inv.currentPrice or 0
        invested = inv.quantity * inv.purchasePrice
        current_value = inv.quantity * curr_price
        abs_return = current_value - invested
        pct_return = (abs_return / invested) * 100 if invested > 0 else 0
        
        total_invested += invested
        total_current_value += current_value
        
        holdings.append({
            "_id": str(inv.id),
            "assetName": inv.assetName,
            "assetType": inv.assetType,
            "quantity": inv.quantity,
            "purchasePrice": inv.purchasePrice,
            "currentPrice": curr_price,
            "purchaseDate": inv.purchaseDate,
            "invested": round(invested, 2),
            "currentValue": round(current_value, 2),
            "absoluteReturn": round(abs_return, 2),
            "percentReturn": round(pct_return, 2),
            "priceSource": inv.priceSource,
            "mfSchemeCode": inv.mfSchemeCode,
            "stockTicker": inv.stockTicker,
            "lastPriceError": inv.lastPriceError,
            "lastPriceUpdate": inv.lastPriceUpdate
        })
        
    overall_abs = total_current_value - total_invested
    overall_pct = (overall_abs / total_invested) * 100 if total_invested > 0 else 0
    
    return {
        "success": True,
        "data": {
            "holdings": holdings,
            "summary": {
                "totalInvested": round(total_invested, 2),
                "totalCurrentValue": round(total_current_value, 2),
                "overallAbsoluteReturn": round(overall_abs, 2),
                "overallPercentReturn": round(overall_pct, 2)
            }
        }
    }

@router.post("/refresh-prices")
async def refresh_prices(current_user: User = Depends(get_current_user)):
    summary = await update_all_live_prices(current_user.id)
    return {"success": True, "message": "Live prices refreshed successfully", "data": summary}

@router.get("/mf-search")
async def mf_search(query: str):
    if not query:
        raise HTTPException(status_code=400, detail="Search query is required")
    url = f"https://api.mfapi.in/mf/search?q={query}"
    async with httpx.AsyncClient() as client:
        res = await client.get(url)
    if res.status_code != 200:
        raise HTTPException(status_code=res.status_code, detail="Mutual Fund API error")
    return {"success": True, "data": res.json()}

@router.get("/stock-search")
async def stock_search(query: str, assetType: Optional[str] = None):
    if not query:
        raise HTTPException(status_code=400, detail="Search query is required")
    url = f"https://query2.finance.yahoo.com/v1/finance/search?q={query}&quotesCount=15"
    headers = {'User-Agent': 'Mozilla/5.0'}
    async with httpx.AsyncClient() as client:
        res = await client.get(url, headers=headers)
    if res.status_code != 200:
        raise HTTPException(status_code=res.status_code, detail="Yahoo Finance API error")
        
    quotes = res.json().get("quotes", [])
    filtered = []
    for q in quotes:
        sym = q.get("symbol", "")
        if sym.endswith(".NS") or sym.endswith(".BO"):
            qtype = q.get("quoteType", "")
            if assetType == "ETF":
                if qtype == "ETF":
                    filtered.append(q)
                elif qtype == "EQUITY":
                    name = (q.get("longname", "") or q.get("shortname", "")).upper()
                    if "ETF" in name or "BEES" in name or "INDEX" in name or not q.get("sector"):
                        filtered.append(q)
            elif assetType == "Stock":
                if qtype == "EQUITY":
                    filtered.append(q)
            else:
                filtered.append(q)
                
    formatted = [{"ticker": q["symbol"], "name": q.get("shortname", q.get("longname", q["symbol"]))} for q in filtered]
    return {"success": True, "data": formatted}

@router.get("/live-price")
async def live_price(assetType: str, ticker: str, current_user: User = Depends(get_current_user)):
    if not assetType or not ticker:
        raise HTTPException(status_code=400, detail="Asset type and ticker are required")
        
    if assetType == 'Mutual Fund':
        info = await fetch_mutual_fund_nav(ticker)
    elif assetType in ('Stock', 'ETF'):
        info = await fetch_stock_price(ticker)
    else:
        raise HTTPException(status_code=400, detail="Invalid asset type")
        
    return {"success": True, "data": info}

@router.get("/config")
async def config(current_user: User = Depends(get_current_user)):
    has_gold = bool(os.getenv("GOLD_API_KEY"))
    return {"success": True, "data": {"hasGoldApiKey": has_gold}}
