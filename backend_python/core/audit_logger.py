from typing import Optional, Any
from fastapi import Request
from models.audit_log import AuditLog
from beanie import PydanticObjectId
import logging

logger = logging.getLogger(__name__)

async def log_audit(
    request: Request,
    action: str,
    resource_type: str,
    resource_id: PydanticObjectId,
    previous_value: Optional[Any] = None,
    new_value: Optional[Any] = None
):
    try:
        user = getattr(request.state, "user", None)
        if not user:
            return

        user_id = user.id
        household_id = getattr(user, "household", None)
        
        ip_address = None
        if request.client:
            ip_address = request.client.host
        x_forwarded_for = request.headers.get('x-forwarded-for')
        if x_forwarded_for:
            ip_address = x_forwarded_for.split(',')[0]

        audit_log = AuditLog(
            user=user_id,
            household=household_id,
            action=action,
            resourceType=resource_type,
            resourceId=resource_id,
            previousValue=previous_value,
            newValue=new_value,
            ipAddress=ip_address
        )
        await audit_log.insert()
    except Exception as e:
        logger.error(f"[AuditLogger] Failed to save audit log: {e}")
