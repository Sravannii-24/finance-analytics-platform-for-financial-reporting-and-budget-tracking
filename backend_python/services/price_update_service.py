import httpx
import yfinance as yf
import os
import asyncio
from datetime import datetime
from typing import Dict, Any, Optional
from models.investment import Investment, PriceSource, AssetType
from beanie import PydanticObjectId
import logging

logger = logging.getLogger(__name__)

async def fetch_mutual_fund_nav(scheme_code: str) -> Dict[str, Any]:
    url = f"https://api.mfapi.in/mf/{scheme_code}/latest"
    async with httpx.AsyncClient() as client:
        response = await client.get(url)
        
    if response.status_code != 200:
        raise Exception(f"MF API returned status {response.status_code}")
        
    json_data = response.json()
    if json_data.get('status') != 'SUCCESS' or not json_data.get('data') or not json_data['data'][0]:
        raise Exception(f"MF API returned unsuccessful payload")
        
    nav_str = json_data['data'][0].get('nav')
    try:
        nav = float(nav_str)
    except (ValueError, TypeError):
        raise Exception(f"API returned invalid NAV for {scheme_code}")
        
    date_str = json_data['data'][0].get('date')
    try:
        dd, mm, yyyy = date_str.split('-')
        update_date = datetime(int(yyyy), int(mm), int(dd))
    except (ValueError, AttributeError):
        update_date = datetime.utcnow()
        
    return {"price": nav, "date": update_date}

async def fetch_stock_price(ticker: str) -> Dict[str, Any]:
    def _fetch():
        t = yf.Ticker(ticker)
        try:
            price = t.fast_info.last_price
            if price is None:
                raise ValueError("No price returned")
            return float(price)
        except Exception:
            raise Exception(f"Yahoo Finance did not return price for {ticker}")
            
    loop = asyncio.get_running_loop()
    try:
        price = await loop.run_in_executor(None, _fetch)
    except Exception as e:
        raise Exception(str(e))
        
    return {"price": price, "date": datetime.utcnow()}

async def fetch_gold_price() -> Dict[str, Any]:
    api_key = os.getenv("GOLD_API_KEY")
    if not api_key:
        raise Exception("Live gold pricing requires GOLD_API_KEY environment variable")
        
    url = "https://www.goldapi.io/api/XAU/INR"
    async with httpx.AsyncClient() as client:
        response = await client.get(url, headers={
            'x-access-token': api_key,
            'Content-Type': 'application/json'
        })
        
    if response.status_code != 200:
        raise Exception(f"Gold API returned status {response.status_code}")
        
    json_data = response.json()
    if json_data.get('error') or not json_data.get('price'):
        raise Exception(json_data.get('error') or "Invalid Gold API payload")
        
    price_per_gram = float(json_data['price']) / 31.1034768
    return {"price": round(price_per_gram, 2), "date": datetime.utcnow()}

async def _update_single_investment(inv: Investment) -> Dict[str, Any]:
    try:
        price_info = None
        if inv.assetType == AssetType.MUTUAL_FUND and inv.mfSchemeCode:
            price_info = await fetch_mutual_fund_nav(inv.mfSchemeCode)
        elif inv.assetType in (AssetType.STOCK, AssetType.ETF) and inv.stockTicker:
            price_info = await fetch_stock_price(inv.stockTicker)
        elif inv.assetType == AssetType.GOLD:
            price_info = await fetch_gold_price()
        else:
            return None
            
        inv.currentPrice = price_info["price"]
        inv.lastPriceUpdate = price_info["date"]
        inv.lastPriceError = None
        await inv.save()
        
        logger.info(f"[PriceUpdateService] Updated {inv.assetName} ({inv.assetType}) to ₹{price_info['price']}")
        return {"id": str(inv.id), "assetName": inv.assetName, "status": "success", "price": price_info["price"]}
    except Exception as err:
        inv.lastPriceError = str(err)
        await inv.save()
        logger.error(f"[PriceUpdateService] Failed to update price for {inv.assetName} ({inv.id}): {err}")
        return {"id": str(inv.id), "assetName": inv.assetName, "status": "failed", "error": inv.lastPriceError}

async def update_all_live_prices(user_id: Optional[PydanticObjectId] = None) -> Dict[str, Any]:
    query = {"priceSource": PriceSource.LIVE.value}
    if user_id:
        query["user"] = user_id
        
    investments = await Investment.find(query).to_list()
    logger.info(f"[PriceUpdateService] Found {len(investments)} live investments to refresh.")
    
    tasks = [_update_single_investment(inv) for inv in investments]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    successes = 0
    failures = 0
    details = []
    
    for res in results:
        if isinstance(res, Exception):
            failures += 1
        elif res is not None:
            if res.get("status") == "success":
                successes += 1
            else:
                failures += 1
            details.append(res)
            
    return {
        "total": len(investments),
        "successes": successes,
        "failures": failures,
        "details": details
    }
