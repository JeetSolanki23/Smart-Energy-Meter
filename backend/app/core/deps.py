from collections.abc import Generator

from fastapi import Depends, Header, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.db.session import get_db
from app.models.admin import Admin
from app.models.device import Device
from app.models.user import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


def get_db_session() -> Generator[Session, None, None]:
    yield from get_db()


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db_session)) -> User:
    payload = decode_access_token(token)
    if payload.get("role") != "user":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User role required")
    user = db.query(User).filter(User.id == payload.get("sub")).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    return user


def get_current_admin(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db_session)) -> Admin:
    payload = decode_access_token(token)
    if payload.get("role") != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin role required")
    admin = db.query(Admin).filter(Admin.id == payload.get("sub")).first()
    if not admin:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    return admin


def get_authenticated_device(
    authorization: str = Header(default=""),
    db: Session = Depends(get_db_session),
) -> Device:
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")

    token = authorization.replace("Bearer ", "", 1).strip()
    device = db.query(Device).filter(Device.device_secret == token).first()
    if not device:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid device secret")

    return device
