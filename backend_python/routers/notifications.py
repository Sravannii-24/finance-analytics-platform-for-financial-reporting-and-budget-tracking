from fastapi import APIRouter, Depends, HTTPException
from core.security import get_current_user
from models.user import User
from models.notification import Notification
from services.notification_service import generate_alerts, generate_monthly_summary
from beanie import PydanticObjectId

router = APIRouter()

@router.get("/")
async def get_notifications(current_user: User = Depends(get_current_user)):
    await generate_alerts(current_user.id)
    notifications = await Notification.find({"user": current_user.id}).sort("-createdAt").limit(100).to_list()
    unread_count = await Notification.find({"user": current_user.id, "isRead": False}).count()
    
    data = []
    for n in notifications:
        n_dict = n.model_dump()
        n_dict["_id"] = str(n.id)
        data.append(n_dict)
        
    return {"success": True, "data": data, "unreadCount": unread_count}

@router.put("/read-all")
async def mark_all_as_read(current_user: User = Depends(get_current_user)):
    await Notification.find({"user": current_user.id, "isRead": False}).update({"$set": {"isRead": True}})
    return {"success": True, "message": "All notifications marked as read"}

@router.put("/{id}/read")
async def mark_as_read(id: str, current_user: User = Depends(get_current_user)):
    try:
        obj_id = PydanticObjectId(id)
    except:
        raise HTTPException(status_code=400, detail={"success": False, "message": "Invalid notification ID"})
        
    notif = await Notification.get(obj_id)
    if not notif:
        raise HTTPException(status_code=404, detail={"success": False, "message": "Notification not found"})
    if str(notif.user) != str(current_user.id):
        raise HTTPException(status_code=403, detail={"success": False, "message": "Not authorized"})
        
    notif.isRead = True
    await notif.save()
    
    data = notif.model_dump()
    data["_id"] = str(notif.id)
    return {"success": True, "data": data}

@router.delete("/{id}")
async def delete_notification(id: str, current_user: User = Depends(get_current_user)):
    try:
        obj_id = PydanticObjectId(id)
    except:
        raise HTTPException(status_code=400, detail={"success": False, "message": "Invalid notification ID"})
        
    notif = await Notification.get(obj_id)
    if not notif:
        raise HTTPException(status_code=404, detail={"success": False, "message": "Notification not found"})
    if str(notif.user) != str(current_user.id):
        raise HTTPException(status_code=403, detail={"success": False, "message": "Not authorized"})
        
    await notif.delete()
    return {"success": True, "message": "Notification dismissed"}

@router.post("/generate-summary")
async def generate_summary(current_user: User = Depends(get_current_user)):
    notif = await generate_monthly_summary(current_user.id)
    data = notif.model_dump()
    data["_id"] = str(notif.id)
    return {"success": True, "data": data}
