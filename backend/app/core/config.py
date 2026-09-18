import os
from typing import List, Union
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import AnyHttpUrl, field_validator


class Settings(BaseSettings):
    PROJECT_NAME: str = "Modern Food Ordering API"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"

    # Database
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "sqlite+aiosqlite:///./foodservice.db"
    )

    # Redis
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")

    # Security
    SECRET_KEY: str = os.getenv("SECRET_KEY", "super-secret-modern-food-service-key-2026-secure-jwt")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    TABLE_TOKEN_EXPIRE_HOURS: int = 6

    # Admin Dashboard Authentication (Only this single Gmail is permitted to log in)
    ADMIN_EMAIL: str = os.getenv("ADMIN_EMAIL", "admin@restaurant.com")
    ADMIN_PASSWORD: str = os.getenv("ADMIN_PASSWORD", "admin12345")
    ADMIN_NAME: str = os.getenv("ADMIN_NAME", "Restaurant Admin")

    # Telegram Bot
    TELEGRAM_BOT_TOKEN: str = os.getenv("TELEGRAM_BOT_TOKEN", "")
    TELEGRAM_ADMIN_CHAT_ID: str = os.getenv("TELEGRAM_ADMIN_CHAT_ID", "")

    # Email / SMTP Settings (for customer account OTP verification)
    SMTP_HOST: str = os.getenv("SMTP_HOST", "")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USER: str = os.getenv("SMTP_USER", "")
    SMTP_PASSWORD: str = os.getenv("SMTP_PASSWORD", "")
    SMTP_FROM_EMAIL: str = os.getenv("SMTP_FROM_EMAIL", "")
    SMTP_FROM_NAME: str = os.getenv("SMTP_FROM_NAME", "Bistro Moderne")
    SMTP_TLS: bool = os.getenv("SMTP_TLS", "true").lower() in ("true", "1", "yes")
    OTP_EXPIRE_MINUTES: int = int(os.getenv("OTP_EXPIRE_MINUTES", "10"))

    # Restaurant Details
    RESTAURANT_NAME: str = "Bistro Moderne"
    CURRENCY_SYMBOL: str = "$"
    TAX_RATE: float = 0.08
    ESTIMATED_PREP_MINUTES: int = 20
    EXCHANGE_RATE_USD_KHR: int = int(os.getenv("EXCHANGE_RATE_USD_KHR", "4100"))

    # Payment Gateway Provider
    PAYMENT_GATEWAY_PROVIDER: str = os.getenv("PAYMENT_GATEWAY_PROVIDER", "payway")  # payway, khqrcc, mock

    # ABA Pay Direct Mobile P2P (From Official ABA QR Link)
    ABA_PAY_ACCOUNT_ID: str = os.getenv("ABA_PAY_ACCOUNT_ID", "")
    ABA_PAY_KEY_ID: str = os.getenv("ABA_PAY_KEY_ID", "")
    ABA_PAY_CODE: str = os.getenv("ABA_PAY_CODE", "")
    ABA_PAY_USD_ACC: str = os.getenv("ABA_PAY_USD_ACC", "")
    ABA_PAY_KHR_ACC: str = os.getenv("ABA_PAY_KHR_ACC", "")

    # ABA PayWay Payment Gateway (Official Method A)
    ABA_PAYWAY_BASE_URL: str = os.getenv("ABA_PAYWAY_BASE_URL", "https://checkout-sandbox.payway.com.kh")
    ABA_PAYWAY_MERCHANT_ID: str = os.getenv("ABA_PAYWAY_MERCHANT_ID", "")
    ABA_PAYWAY_API_KEY: str = os.getenv("ABA_PAYWAY_API_KEY", "")
    ABA_PAYWAY_MERCHANT_NAME: str = os.getenv("ABA_PAYWAY_MERCHANT_NAME", "Bistro Moderne")
    ABA_PAYWAY_MERCHANT_CITY: str = os.getenv("ABA_PAYWAY_MERCHANT_CITY", "Phnom Penh")


    # KHQR.cc Gateway (Alternative Provider - Method C)
    KHQRCC_BASE_URL: str = os.getenv("KHQRCC_BASE_URL", "https://khqr.cc")
    KHQRCC_PROFILE_ID: str = os.getenv("KHQRCC_PROFILE_ID", "")
    KHQRCC_API_SECRET: str = os.getenv("KHQRCC_API_SECRET", "")

    # Payment auto-confirmation (0 = disabled, real bank verification only)
    AUTO_CONFIRM_PAYMENT_SECONDS: int = int(os.getenv("AUTO_CONFIRM_PAYMENT_SECONDS", "0"))

    # Geofence validation (optional hint)
    RESTAURANT_LATITUDE: float = 11.5564
    RESTAURANT_LONGITUDE: float = 104.9282
    MAX_DISTANCE_METERS: float = 300.0  # within 300m of restaurant

    # CORS
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:3000")
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "https://yourshop.com"
    ]

    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=True,
        extra="allow"
    )


settings = Settings()
