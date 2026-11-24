import os, secrets, datetime
from pathlib import Path
import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from database import SessionLocal, User

_SECRET_FILE = Path("./.saferoute_secret")


def _secret() -> str:
    s = os.environ.get("SAFEROUTE_SECRET")
    if s:
        return s
    if not _SECRET_FILE.exists():
        _SECRET_FILE.write_text(secrets.token_hex(32))
    return _SECRET_FILE.read_text().strip()


SECRET = _secret()
bearer = HTTPBearer(auto_error=False)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_token(user: User, hours: int = 12) -> str:
    exp = datetime.datetime.utcnow() + datetime.timedelta(hours=hours)
    return jwt.encode({"sub": str(user.id), "exp": exp}, SECRET, algorithm="HS256")


def get_current_user(cred: HTTPAuthorizationCredentials = Depends(bearer),
                     db: Session = Depends(get_db)) -> User:
    if not cred:
        raise HTTPException(401, "กรุณาเข้าสู่ระบบ")
    try:
        data = jwt.decode(cred.credentials, SECRET, algorithms=["HS256"])
        user = db.get(User, int(data["sub"]))
    except Exception:
        raise HTTPException(401, "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่")
    if not user:
        raise HTTPException(401, "ไม่พบผู้ใช้")
    return user


def require_admin(user: User = Depends(get_current_user)) -> User:
    if not user.is_admin:  # เช็คจาก DB ทุกครั้ง -> ถอนสิทธิ์แล้วมีผลทันที
        raise HTTPException(403, "ต้องเป็นผู้ดูแลระบบ")
    return user


def seed_first_admin():
    """สร้างแอดมินคนแรกจาก env ADMIN_EMAIL / ADMIN_PASSWORD (ถ้ามี)"""
    email, pw = os.environ.get("ADMIN_EMAIL"), os.environ.get("ADMIN_PASSWORD")
    if not email or not pw:
        return
    import bcrypt
    db = SessionLocal()
    try:
        u = db.query(User).filter(User.email == email).first()
        if u:
            if not u.is_admin:
                u.is_admin = True
        else:
            hashed = bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()
            db.add(User(name="Admin", email=email, hashed_password=hashed, is_admin=True))
        db.commit()
    finally:
        db.close()