from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_db_session
from app.core.security import create_access_token, get_password_hash, verify_password
from app.models.admin import Admin
from app.models.user import User
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse)
def register_user(payload: RegisterRequest, db: Session = Depends(get_db_session)) -> TokenResponse:
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already exists")

    user = User(email=payload.email, password_hash=get_password_hash(payload.password))
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(str(user.id), role="user")
    return TokenResponse(access_token=token)


@router.post("/admin/register", response_model=TokenResponse)
def register_admin(payload: RegisterRequest, db: Session = Depends(get_db_session)) -> TokenResponse:
    existing = db.query(Admin).filter(Admin.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already exists")

    admin = Admin(email=payload.email, password_hash=get_password_hash(payload.password))
    db.add(admin)
    db.commit()
    db.refresh(admin)

    token = create_access_token(str(admin.id), role="admin")
    return TokenResponse(access_token=token)


@router.post("/login", response_model=TokenResponse)
def login_user(payload: LoginRequest, db: Session = Depends(get_db_session)) -> TokenResponse:
    user = db.query(User).filter(User.email == payload.email).first()
    if not user:
        admin = db.query(Admin).filter(Admin.email == payload.email).first()
        if admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This is an admin account. Please use Admin Login.",
            )
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    if not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    token = create_access_token(str(user.id), role="user")
    return TokenResponse(access_token=token)


@router.post("/admin/login", response_model=TokenResponse)
def login_admin(payload: LoginRequest, db: Session = Depends(get_db_session)) -> TokenResponse:
    admin = db.query(Admin).filter(Admin.email == payload.email).first()
    if not admin:
        user = db.query(User).filter(User.email == payload.email).first()
        if user:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This is a user account. Please use User Login.",
            )
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    if not verify_password(payload.password, admin.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    token = create_access_token(str(admin.id), role="admin")
    return TokenResponse(access_token=token)
