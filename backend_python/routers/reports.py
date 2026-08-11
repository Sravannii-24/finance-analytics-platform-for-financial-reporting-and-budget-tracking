from fastapi import APIRouter, Depends, Response
from typing import Optional
from core.security import get_current_user
from models.user import User
from services.report_service import ReportService

router = APIRouter()

@router.get("/monthly-summary")
async def get_monthly_summary(month: Optional[str] = None, current_user: User = Depends(get_current_user)):
    data = await ReportService.get_monthly_summary(current_user.id, month)
    return {"success": True, "data": data}

@router.get("/export/pdf")
async def export_pdf(month: Optional[str] = None, current_user: User = Depends(get_current_user)):
    pdf_bytes = await ReportService.generate_pdf(current_user.id, month)
    
    headers = {
        'Content-Disposition': f'attachment; filename="FinSight-Report-{month or "Current"}.pdf"'
    }
    return Response(content=pdf_bytes.getvalue(), media_type="application/pdf", headers=headers)

@router.get("/export/excel")
async def export_excel(month: Optional[str] = None, current_user: User = Depends(get_current_user)):
    excel_bytes = await ReportService.generate_excel(current_user.id, month)
    
    headers = {
        'Content-Disposition': f'attachment; filename="FinSight-Report-{month or "Current"}.xlsx"'
    }
    return Response(
        content=excel_bytes.getvalue(), 
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", 
        headers=headers
    )
