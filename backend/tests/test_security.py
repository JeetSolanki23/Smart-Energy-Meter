from app.core.security import (
    create_access_token,
    decode_access_token,
    get_password_hash,
    verify_password,
)


def test_password_hash_roundtrip() -> None:
    password = "StrongPass123"
    hashed = get_password_hash(password)

    assert hashed != password
    assert verify_password(password, hashed)


def test_jwt_create_and_decode() -> None:
    token = create_access_token(subject="abc-user", role="user")
    payload = decode_access_token(token)

    assert payload["sub"] == "abc-user"
    assert payload["role"] == "user"
