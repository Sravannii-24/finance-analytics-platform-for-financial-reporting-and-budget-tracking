from fastapi import APIRouter, Depends
from core.security import get_current_user
from models.user import User
from models.audit_log import AuditLog

router = APIRouter()

@router.get("/")
async def get_audit_logs(current_user: User = Depends(get_current_user)):
    logs = await AuditLog.find({"user": current_user.id}).sort("-timestamp").to_list(length=50)
    
    logs_data = []
    for log in logs:
        log_dict = log.model_dump()
        log_dict["_id"] = str(log.id)
        if log.resourceId:
            log_dict["resourceId"] = str(log.resourceId)
        logs_data.append(log_dict)
        
    return {
        "success": True,
        "count": len(logs_data),
        "data": logs_data
    }
