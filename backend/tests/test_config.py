from app.core.config import Settings


def test_cors_allowed_origins_parses_csv() -> None:
    settings = Settings(CORS_ALLOWED_ORIGINS="https://a.com, https://b.com ,, ")

    assert settings.cors_allowed_origins == ["https://a.com", "https://b.com"]


def test_alert_email_recipients_parses_csv() -> None:
    settings = Settings(ALERT_EMAIL_TO="one@example.com, two@example.com")

    assert settings.alert_email_recipients == ["one@example.com", "two@example.com"]


def test_sqlalchemy_database_uri_is_assembled_from_parts() -> None:
    settings = Settings(
        POSTGRES_HOST="db.local",
        POSTGRES_PORT=5433,
        POSTGRES_DB="metering",
        POSTGRES_USER="smart_user",
        POSTGRES_PASSWORD="secret",
    )

    assert settings.SQLALCHEMY_DATABASE_URI == "postgresql+psycopg://smart_user:secret@db.local:5433/metering"
