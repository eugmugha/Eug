from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, EmailStr


class SellerProfileData(BaseModel):
    category: Optional[str] = None
    business_description: Optional[str] = None
    city: Optional[str] = None


class BuyerProfileData(BaseModel):
    delivery_address: Optional[str] = None
    city: Optional[str] = None


class UserRegister(BaseModel):
    full_name: str
    email: EmailStr
    phone: str
    password: str
    business_name: str
    user_type: Literal["seller", "buyer"]
    address: str
    # Profile-specific (optional, depends on user_type)
    category: Optional[str] = None
    business_description: Optional[str] = None
    delivery_address: Optional[str] = None
    city: Optional[str] = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: int
    full_name: str
    email: str
    phone: str
    business_name: str
    user_type: str
    address: str
    is_admin: bool
    created_at: datetime
    seller_profile: Optional[SellerProfileData] = None
    buyer_profile: Optional[BuyerProfileData] = None

    class Config:
        from_attributes = True


class StatsResponse(BaseModel):
    total_users: int
    sellers: int
    buyers: int


# ---- Products ----
class ProductCreate(BaseModel):
    name: str
    description: Optional[str] = None
    price: float
    stock: int = 0
    category: Optional[str] = None
    image_emoji: Optional[str] = None


class ProductResponse(BaseModel):
    id: int
    seller_id: int
    seller_name: str
    name: str
    description: Optional[str]
    price: float
    stock: int
    category: Optional[str]
    image_emoji: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


# ---- Orders ----
class CartItemIn(BaseModel):
    product_id: int
    quantity: int


class CheckoutRequest(BaseModel):
    items: list[CartItemIn]
    delivery_address: Optional[str] = None


class OrderItemResponse(BaseModel):
    product_name: str
    unit_price: float
    quantity: int

    class Config:
        from_attributes = True


class OrderResponse(BaseModel):
    id: int
    total: float
    status: str
    delivery_address: Optional[str]
    created_at: datetime
    items: list[OrderItemResponse]

    class Config:
        from_attributes = True
