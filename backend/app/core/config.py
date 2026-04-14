from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", case_sensitive=True)

    APP_NAME: str = "Smart Energy Meter Backend"
    ENVIRONMENT: str = "development"
    API_V1_PREFIX: str = "/api/v1"
    DEBUG: bool = False
    CORS_ALLOWED_ORIGINS: str = ""

    SECRET_KEY: str = "change-this-secret-key"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 120
    JWT_ALGORITHM: str = "HS256"

    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_DB: str = "smart_meter"
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "postgres"

    REDIS_URL: str = "redis://localhost:6379/0"
    CELERY_BROKER_URL: str = "redis://localhost:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/2"

    RAZORPAY_KEY_ID: str = ""
    RAZORPAY_KEY_SECRET: str = ""
    RAZORPAY_WEBHOOK_SECRET: str = ""

    PAIR_CODE_TTL_SECONDS: int = 600
    DEVICE_DATA_INTERVAL_SECONDS: int = 30
    PRICE_PER_UNIT: float = 7.0
    MIN_PAYMENT_AMOUNT: float = 1.0

    SMTP_ENABLED: bool = False
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USERNAME: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_EMAIL: str = ""
    SMTP_FROM_NAME: str = "Smart Energy Meter"
    SMTP_USE_TLS: bool = True
    SMTP_USE_SSL: bool = False
    SMTP_TIMEOUT_SECONDS: int = 20
    ALERT_EMAIL_TO: str = ""

    @property
    def cors_allowed_origins(self) -> list[str]:
        if not self.CORS_ALLOWED_ORIGINS.strip():
            return []
        return [origin.strip() for origin in self.CORS_ALLOWED_ORIGINS.split(",") if origin.strip()]

    @property
    def alert_email_recipients(self) -> list[str]:
        if not self.ALERT_EMAIL_TO.strip():
            return []
        return [email.strip() for email in self.ALERT_EMAIL_TO.split(",") if email.strip()]

    @property
    def SQLALCHEMY_DATABASE_URI(self) -> str:  # noqa: N802
        return (
            f"postgresql+psycopg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@"
            f"{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()
