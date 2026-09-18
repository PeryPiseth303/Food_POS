from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.session import get_db
from app.models.user import AdminUser
from app.schemas.user import UserLogin, TokenResponse, UserOut
from app.core.security import verify_password, get_password_hash, create_access_token
from app.core.config import settings
from app.api.deps import get_current_user

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/login", response_model=TokenResponse)
async def login_for_access_token(
    login_data: UserLogin,
    db: AsyncSession = Depends(get_db)
):
    clean_email = login_data.email.strip().lower()
    allowed_email = (settings.ADMIN_EMAIL or "").strip().lower()

    # 1. Enforce single authorized Gmail rule
    if not allowed_email or clean_email != allowed_email:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access denied. Only the authorized administrator Gmail configured in .env ({allowed_email}) is permitted to log in."
        )

    # 2. Retrieve or create/sync AdminUser in DB
    result = await db.execute(select(AdminUser).where(AdminUser.email == clean_email))
    user = result.scalar_one_or_none()

    if not user:
        user = AdminUser(
            email=clean_email,
            hashed_password=get_password_hash(settings.ADMIN_PASSWORD),
            full_name=settings.ADMIN_NAME or "Restaurant Admin",
            role="admin",
            is_active=True
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

    # 3. Verify password against .env password and DB hash
    password_valid = (
        login_data.password == settings.ADMIN_PASSWORD
        or verify_password(login_data.password, user.hashed_password)
    )

    if not password_valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect password. Please verify the admin credentials in server .env",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        user.is_active = True
        await db.commit()

    # 4. Sync password hash in DB if .env was changed
    if login_data.password == settings.ADMIN_PASSWORD and not verify_password(settings.ADMIN_PASSWORD, user.hashed_password):
        user.hashed_password = get_password_hash(settings.ADMIN_PASSWORD)
        await db.commit()

    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        subject=user.id,
        role="admin",
        expires_delta=access_token_expires
    )

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        role="admin",
        user_name=user.full_name or user.email,
        email=user.email
    )


@router.get("/me", response_model=UserOut)
async def read_users_me(current_user: AdminUser = Depends(get_current_user)):
    return current_user
