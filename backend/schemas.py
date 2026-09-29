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
