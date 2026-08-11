from fastapi import APIRouter, Depends, HTTPException, Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from core.security import get_current_user, get_password_hash, verify_password, create_access_token
from core.audit_logger import log_audit
from models.user import User
from schemas.auth import RegisterRequest, LoginRequest, ForgotPasswordRequest, ResetPasswordRequest, ProfileUpdateRequest
import secrets
import hashlib
from datetime import datetime, timedelta, timezone
from services.email_service import send_email
from core.database import is_db_available

limiter = Limiter(key_func=get_remote_address)
router = APIRouter()

@router.post("/register", status_code=201)
async def register_user(request: Request, body: RegisterRequest):
    if not is_db_available():
        raise HTTPException(status_code=503, detail={"success": False, "message": "Database unavailable. Try again later."})
    if body.password != body.confirmPassword:
        raise HTTPException(status_code=400, detail={"success": False, "message": "Passwords do not match"})
    
    user_exists = await User.find_one(User.email == body.email)
    if user_exists:
        raise HTTPException(status_code=400, detail={"success": False, "message": "User already exists"})
    
    hashed_pw = get_password_hash(body.password)
    user = User(
        name=body.name,
        email=body.email,
        password=hashed_pw
    )
    await user.insert()
    
    request.state.user = user
    await log_audit(request, "CREATE", "Auth", user.id)
    
    token = create_access_token({"id": str(user.id)})
    
    return {
        "success": True,
        "_id": str(user.id),
        "name": user.name,
        "email": user.email,
        "monthlyIncome": user.monthlyIncome,
        "token": token
    }

@router.post("/login")
@limiter.limit("5/15minute")
async def login_user(request: Request, body: LoginRequest):
    if not is_db_available():
        raise HTTPException(status_code=503, detail={"success": False, "message": "Database unavailable. Try again later."})
    user = await User.find_one(User.email == body.email)
    if not user:
        raise HTTPException(status_code=401, detail={"success": False, "message": "Invalid credentials"})
        
    if not verify_password(body.password, user.password):
        raise HTTPException(status_code=401, detail={"success": False, "message": "Invalid credentials"})
        
    request.state.user = user
    await log_audit(request, "UPDATE", "Auth", user.id)
    
    token = create_access_token({"id": str(user.id)})
    
    return {
        "success": True,
        "_id": str(user.id),
        "name": user.name,
        "email": user.email,
        "monthlyIncome": user.monthlyIncome,
        "token": token
    }

@router.get("/profile")
async def get_profile(current_user: User = Depends(get_current_user)):
    return {
        "success": True,
        "data": {
            "_id": str(current_user.id),
            "name": current_user.name,
            "email": current_user.email,
            "monthlyIncome": current_user.monthlyIncome,
            "household": str(current_user.household) if current_user.household else None
        }
    }

@router.put("/profile")
async def update_profile(request: Request, body: ProfileUpdateRequest, current_user: User = Depends(get_current_user)):
    if not is_db_available():
        raise HTTPException(status_code=503, detail={"success": False, "message": "Database unavailable. Try again later."})
    request.state.user = current_user
    prev = current_user.model_dump()
    
    if body.name is not None:
        current_user.name = body.name
    if body.email is not None:
        current_user.email = body.email
    if body.monthlyIncome is not None:
        current_user.monthlyIncome = body.monthlyIncome
        
    await current_user.save()
    
    # We must ensure PydanticObjectId is converted for auditing or it may fail
    await log_audit(request, "UPDATE", "Auth", current_user.id, prev, current_user.model_dump())
    
    return {
        "success": True,
        "data": {
            "_id": str(current_user.id),
            "name": current_user.name,
            "email": current_user.email,
            "monthlyIncome": current_user.monthlyIncome,
            "household": str(current_user.household) if current_user.household else None
        }
    }

@router.post("/forgot-password")
@limiter.limit("5/15minute")
async def forgot_password(request: Request, body: ForgotPasswordRequest):
    user = await User.find_one(User.email == body.email)
    if not user:
        raise HTTPException(status_code=404, detail={"success": False, "message": "There is no user with that email"})
        
    reset_token = secrets.token_hex(20)
    reset_token_hash = hashlib.sha256(reset_token.encode()).hexdigest()
    
    user.resetPasswordToken = reset_token_hash
    user.resetPasswordExpire = datetime.now(timezone.utc) + timedelta(minutes=10)
    await user.save()
    
    request.state.user = user
    await log_audit(request, "UPDATE", "Auth", user.id)
    
    reset_url = f"{request.headers.get('origin', 'http://localhost:5173')}/reset-password/{reset_token}"
    message = f"You are receiving this email because you (or someone else) has requested the reset of a password. Please make a PUT request to: \n\n {reset_url}"
    
    try:
        await send_email(user.email, "Password Reset Token", message)
        return {"success": True, "data": "Email sent"}
    except Exception as e:
        user.resetPasswordToken = None
        user.resetPasswordExpire = None
        await user.save()
        raise HTTPException(status_code=500, detail={"success": False, "message": "Email could not be sent"})

@router.post("/reset-password/{token}")
async def reset_password(token: str, request: Request, body: ResetPasswordRequest):
    reset_password_token = hashlib.sha256(token.encode()).hexdigest()
    
    user = await User.find_one(
        User.resetPasswordToken == reset_password_token,
        User.resetPasswordExpire > datetime.now(timezone.utc)
    )
    
    if not user:
        raise HTTPException(status_code=400, detail={"success": False, "message": "Invalid token"})
        
    user.password = get_password_hash(body.password)
    user.resetPasswordToken = None
    user.resetPasswordExpire = None
    await user.save()
    
    request.state.user = user
    await log_audit(request, "UPDATE", "Auth", user.id)
    
    jwt_token = create_access_token({"id": str(user.id)})
    
    return {
        "success": True,
        "_id": str(user.id),
        "name": user.name,
        "email": user.email,
        "monthlyIncome": user.monthlyIncome,
        "token": jwt_token
    }
