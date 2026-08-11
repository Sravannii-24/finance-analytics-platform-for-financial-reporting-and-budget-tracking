from fastapi_mail import FastMail, MessageSchema, ConnectionConfig, MessageType
from core.config import settings
import logging

logger = logging.getLogger(__name__)

# Fallback config to avoid errors if env vars missing during dev
conf = ConnectionConfig(
    MAIL_USERNAME=settings.SMTP_USER or "user",
    MAIL_PASSWORD=settings.SMTP_PASS or "pass",
    MAIL_FROM=settings.SMTP_FROM or "noreply@finsight.com",
    MAIL_PORT=settings.SMTP_PORT or 587,
    MAIL_SERVER=settings.SMTP_HOST or "smtp.example.com",
    MAIL_STARTTLS=True,
    MAIL_SSL_TLS=False,
    USE_CREDENTIALS=bool(settings.SMTP_USER)
)

async def send_email(to_email: str, subject: str, body: str):
    try:
        # If SMTP_HOST is missing, simulate for dev
        if not settings.SMTP_HOST:
            logger.info(f"Simulating email to {to_email} subject: {subject}")
            logger.info(f"Body: {body}")
            return
            
        message = MessageSchema(
            subject=subject,
            recipients=[to_email],
            body=body,
            subtype=MessageType.html
        )
        fm = FastMail(conf)
        await fm.send_message(message)
    except Exception as e:
        logger.error(f"Failed to send email: {e}")
