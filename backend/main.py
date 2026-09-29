import os

from fastapi import Depends, FastAPI, HTTPException
from fastapi.security import OAuth2PasswordBearer
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session, joinedload

from backend.auth import (
    create_access_token,
    decode_token,
    hash_password,
    verify_password,
)
from backend.database import Base, SessionLocal, engine, get_db
from backend.models import BuyerProfile, SellerProfile, User
from backend.schemas import (
    StatsResponse,
    UserLogin,
    UserRegister,
    UserResponse,
)

app = FastAPI(title="Marketplace API")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/login")


@app.on_event("startup")
def on_startup() -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@marketplace.com")
    if not db.query(User).filter(User.email == admin_email).first():
        db.add(
            User(
                full_name="Administrateur",
                email=admin_email,
                phone="0000000000",
                password_hash=hash_password(
                    os.environ.get("ADMIN_PASSWORD", "admin123")
                ),
                business_name="Administration",
                user_type="seller",
                address="Siège",
                is_admin=True,
            )
        )
        db.commit()
    db.close()


def get_current_user(
    token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)
) -> User:
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Token invalide")
    user = db.query(User).filter(User.id == int(payload["sub"])).first()
    if not user:
        raise HTTPException(status_code=401, detail="Utilisateur introuvable")
    return user


def require_admin(user: User = Depends(get_current_user)) -> User:
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Accès administrateur requis")
    return user


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/api/register", response_model=UserResponse, status_code=201)
def register(data: UserRegister, db: Session = Depends(get_db)) -> User:
    if db.query(User).filter(User.email == data.email).first():
        raise HTTPException(status_code=400, detail="Cet email est déjà utilisé")
    if db.query(User).filter(User.business_name == data.business_name).first():
        raise HTTPException(
            status_code=400, detail="Ce nom de commerce est déjà utilisé"
        )
    user = User(
        full_name=data.full_name,
        email=data.email,
        phone=data.phone,
        password_hash=hash_password(data.password),
        business_name=data.business_name,
        user_type=data.user_type,
        address=data.address,
    )
    db.add(user)
    db.flush()

    if data.user_type == "seller":
        profile = SellerProfile(
            user_id=user.id,
            category=data.category,
            business_description=data.business_description,
            city=data.city,
        )
    else:
        profile = BuyerProfile(
            user_id=user.id,
            delivery_address=data.delivery_address or data.address,
            city=data.city,
        )
    db.add(profile)
    db.commit()
    db.refresh(user)
    return user


@app.post("/api/login")
def login(data: UserLogin, db: Session = Depends(get_db)) -> dict:
    user = db.query(User).filter(User.email == data.email).first()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Email ou mot de passe incorrect")
    token = create_access_token({"sub": str(user.id), "is_admin": user.is_admin})
    return {
        "access_token": token,
        "token_type": "bearer",
        "is_admin": user.is_admin,
        "user_type": user.user_type,
    }


@app.get("/api/admin/stats", response_model=StatsResponse)
def admin_stats(admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    base = db.query(User).filter(User.is_admin == False)
    return StatsResponse(
        total_users=base.count(),
        sellers=base.filter(User.user_type == "seller").count(),
        buyers=base.filter(User.user_type == "buyer").count(),
    )


@app.get("/api/admin/users", response_model=list[UserResponse])
def admin_users(admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    return (
        db.query(User)
        .filter(User.is_admin == False)
        .options(joinedload(User.seller_profile), joinedload(User.buyer_profile))
        .order_by(User.created_at.desc())
        .all()
    )


# Static frontend (mounted last so /api routes take priority)
app.mount("/", StaticFiles(directory="frontend", html=True), name="frontend")
