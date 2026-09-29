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
from backend.models import BuyerProfile, Order, OrderItem, Product, SellerProfile, User
from backend.schemas import (
    CheckoutRequest,
    OrderResponse,
    ProductCreate,
    ProductResponse,
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

    # Seed demo products if none exist
    if db.query(Product).count() == 0:
        admin = db.query(User).filter(User.is_admin == True).first()
        if admin:
            demo = [
                Product(seller_id=admin.id, name="Smartphone Galaxy", price=150000, stock=10, category="Électronique", image_emoji="📱"),
                Product(seller_id=admin.id, name="Casque Bluetooth", price=35000, stock=20, category="Électronique", image_emoji="🎧"),
                Product(seller_id=admin.id, name="T-shirt Coton", price=12000, stock=50, category="Mode & Vêtements", image_emoji="👕"),
                Product(seller_id=admin.id, name="Sac à Main Cuir", price=45000, stock=8, category="Mode & Vêtements", image_emoji="👜"),
                Product(seller_id=admin.id, name="Sac de Riz 25kg", price=28000, stock=30, category="Alimentation", image_emoji="🍚"),
                Product(seller_id=admin.id, name="Lampe LED Solaire", price=18000, stock=25, category="Maison & Jardin", image_emoji="💡"),
            ]
            db.add_all(demo)
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


# ---- Products ----
@app.get("/api/products", response_model=list[ProductResponse])
def list_products(db: Session = Depends(get_db)):
    products = db.query(Product).order_by(Product.created_at.desc()).all()
    result = []
    for p in products:
        result.append(
            ProductResponse(
                id=p.id,
                seller_id=p.seller_id,
                seller_name=p.seller.business_name if p.seller else "Inconnu",
                name=p.name,
                description=p.description,
                price=p.price,
                stock=p.stock,
                category=p.category,
                image_emoji=p.image_emoji,
                created_at=p.created_at,
            )
        )
    return result


@app.post("/api/products", response_model=ProductResponse, status_code=201)
def create_product(
    data: ProductCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if user.user_type != "seller":
        raise HTTPException(status_code=403, detail="Seuls les vendeurs peuvent ajouter des produits")
    product = Product(
        seller_id=user.id,
        name=data.name,
        description=data.description,
        price=data.price,
        stock=data.stock,
        category=data.category,
        image_emoji=data.image_emoji,
    )
    db.add(product)
    db.commit()
    db.refresh(product)
    return ProductResponse(
        id=product.id,
        seller_id=product.seller_id,
        seller_name=user.business_name,
        name=product.name,
        description=product.description,
        price=product.price,
        stock=product.stock,
        category=product.category,
        image_emoji=product.image_emoji,
        created_at=product.created_at,
    )


# ---- Orders (checkout + history) ----
@app.post("/api/orders", response_model=OrderResponse, status_code=201)
def checkout(
    data: CheckoutRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if user.user_type != "buyer":
        raise HTTPException(status_code=403, detail="Seuls les acheteurs peuvent commander")
    if not data.items:
        raise HTTPException(status_code=400, detail="Le panier est vide")

    # Validate items and compute total
    total = 0.0
    order_items = []
    for item in data.items:
        product = db.query(Product).filter(Product.id == item.product_id).first()
        if not product:
            raise HTTPException(status_code=400, detail=f"Produit {item.product_id} introuvable")
        if product.stock < item.quantity:
            raise HTTPException(
                status_code=400,
                detail=f"Stock insuffisant pour « {product.name} » (disponible: {product.stock})",
            )
        line_total = product.price * item.quantity
        total += line_total
        order_items.append(
            OrderItem(
                product_id=product.id,
                product_name=product.name,
                unit_price=product.price,
                quantity=item.quantity,
            )
        )
        # Decrement stock
        product.stock -= item.quantity

    order = Order(
        buyer_id=user.id,
        total=total,
        status="confirmed",
        delivery_address=data.delivery_address or user.address,
    )
    db.add(order)
    db.flush()
    for oi in order_items:
        oi.order_id = order.id
        db.add(oi)
    db.commit()
    db.refresh(order)
    return order


@app.get("/api/orders", response_model=list[OrderResponse])
def my_orders(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.user_type != "buyer":
        raise HTTPException(status_code=403, detail="Réservé aux acheteurs")
    return (
        db.query(Order)
        .filter(Order.buyer_id == user.id)
        .order_by(Order.created_at.desc())
        .all()
    )


# Static frontend (mounted last so /api routes take priority)
app.mount("/", StaticFiles(directory="frontend", html=True), name="frontend")
