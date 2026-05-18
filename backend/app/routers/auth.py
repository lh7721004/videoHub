import uuid
import os
import secrets
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..email import send_verification_email
from ..models import EmailVerification, User
from ..schemas import EmailVerificationRequest, UserCreate, UserLogin, UserResponse, Token
from ..auth import hash_password, verify_password, create_access_token, get_current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])

CODE_TTL_MINUTES = 10
RESEND_COOLDOWN_SECONDS = 60
MAX_SENDS_PER_EMAIL = 5
MAX_VERIFY_ATTEMPTS = 5
MAX_VERIFICATION_EMAILS_PER_HOUR = int(os.getenv("MAX_VERIFICATION_EMAILS_PER_HOUR", "100"))


def normalize_email(email: str) -> str:
    return email.strip().lower()


def validate_password(password: str, password_confirm: str) -> None:
    if password != password_confirm:
        raise HTTPException(status_code=400, detail="Passwords do not match")
    if len(password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")


@router.post("/email-verification")
def request_email_verification(data: EmailVerificationRequest, db: Session = Depends(get_db)):
    email = normalize_email(data.email)
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    now = datetime.utcnow()
    verification = db.query(EmailVerification).filter(EmailVerification.email == email).first()
    if verification:
        cooldown_until = verification.last_sent_at + timedelta(seconds=RESEND_COOLDOWN_SECONDS)
        if now < cooldown_until:
            raise HTTPException(status_code=429, detail="Please wait before requesting another code")
        if verification.sent_count >= MAX_SENDS_PER_EMAIL:
            raise HTTPException(status_code=429, detail="Too many verification emails requested")
    hourly_sent_count = (
        db.query(EmailVerification)
        .filter(EmailVerification.last_sent_at >= now - timedelta(hours=1))
        .count()
    )
    if hourly_sent_count >= MAX_VERIFICATION_EMAILS_PER_HOUR:
        raise HTTPException(status_code=429, detail="Email verification is temporarily rate limited")

    code = f"{secrets.randbelow(1_000_000):06d}"
    try:
        send_verification_email(email, code)
    except RuntimeError:
        raise HTTPException(status_code=503, detail="Email verification is not configured")

    if verification:
        verification.code_hash = hash_password(code)
        verification.attempts = 0
        verification.sent_count += 1
        verification.expires_at = now + timedelta(minutes=CODE_TTL_MINUTES)
        verification.last_sent_at = now
    else:
        db.add(
            EmailVerification(
                email=email,
                code_hash=hash_password(code),
                expires_at=now + timedelta(minutes=CODE_TTL_MINUTES),
                last_sent_at=now,
            )
        )

    db.commit()
    return {"message": "Verification code sent"}


@router.post("/signup", response_model=Token, status_code=status.HTTP_201_CREATED)
def signup(data: UserCreate, db: Session = Depends(get_db)):
    email = normalize_email(data.email)
    validate_password(data.password, data.password_confirm)

    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    if db.query(User).filter(User.username == data.username).first():
        raise HTTPException(status_code=400, detail="Username already taken")

    verification = db.query(EmailVerification).filter(EmailVerification.email == email).first()
    if not verification:
        raise HTTPException(status_code=400, detail="Please verify your email first")
    if verification.expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Verification code expired")
    if verification.attempts >= MAX_VERIFY_ATTEMPTS:
        raise HTTPException(status_code=429, detail="Too many verification attempts")
    if not verify_password(data.verification_code.strip(), verification.code_hash):
        verification.attempts += 1
        db.commit()
        raise HTTPException(status_code=400, detail="Invalid verification code")

    user = User(
        email=email,
        username=data.username,
        password_hash=hash_password(data.password),
        stream_key=uuid.uuid4().hex[:16],
        email_verified=True,
    )
    db.add(user)
    db.delete(verification)
    db.commit()
    db.refresh(user)
    return Token(access_token=create_access_token(user.id))


@router.post("/login", response_model=Token)
def login(data: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email).first()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return Token(access_token=create_access_token(user.id))


@router.get("/me", response_model=UserResponse)
def get_me(user: User = Depends(get_current_user)):
    return user
