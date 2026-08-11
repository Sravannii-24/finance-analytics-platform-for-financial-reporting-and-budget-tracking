from datetime import datetime, timedelta, timezone
from jose import JWTError, jwt
from fastapi import Depends, HTTPException, Request
from fastapi.security import OAuth2PasswordBearer
from core.config import settings
from typing import Optional
import bcrypt

# We don't strictly use FastAPI's OAuth2PasswordBearer to validate the login endpoint itself,
# because the frontend expects standard JSON responses, but we can use it to extract the token from headers.
# The frontend sends "Bearer <token>"
class CustomBearer(OAuth2PasswordBearer):
    def __init__(self, auto_error: bool = True):
        super().__init__(tokenUrl="api/auth/login", auto_error=auto_error)
        
    async def __call__(self, request: Request) -> Optional[str]:
        authorization = request.headers.get("Authorization")
        if not authorization or not authorization.startswith("Bearer "):
            if self.auto_error:
                # The node app returns { success: false, message: 'Not authorized, no token provided' }
                raise HTTPException(status_code=401, detail={"success": False, "message": "Not authorized, no token provided"})
            else:
                return None
        return authorization.split(" ")[1]

oauth2_scheme = CustomBearer()

def verify_password(plain_password, hashed_password):
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

def get_password_hash(password):
    salt = bcrypt.gensalt(10)
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed.decode('utf-8')

def create_access_token(data: dict):
    to_encode = data.copy()
    # Handle the '30d' expiry or default to 30 days
    expire = datetime.now(timezone.utc) + timedelta(days=30)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET, algorithm="HS256")
    return encoded_jwt

async def get_current_user(token: str = Depends(oauth2_scheme)):
    from models.user import User
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])
        user_id: str = payload.get("id")
        if user_id is None:
            raise HTTPException(status_code=401, detail={"success": False, "message": "Not authorized, token failed"})
    except JWTError:
        raise HTTPException(status_code=401, detail={"success": False, "message": "Not authorized, token failed"})
    
    user = await User.get(user_id)
    if user is None:
        raise HTTPException(status_code=401, detail={"success": False, "message": "Not authorized, user not found"})
    return user
