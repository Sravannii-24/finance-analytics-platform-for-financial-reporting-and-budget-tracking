import os
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    MONGO_URI: str = "mongodb://127.0.0.1:27017/finsight"
    JWT_SECRET: str = "supersecretfinsighttoken123"
    JWT_EXPIRE: str = "30d"
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASS: str = ""
    SMTP_FROM: str = "noreply@finsight.com"
    
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()
