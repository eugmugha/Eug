from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr


class UserRegister(BaseModel):
    full_name: str
    email: EmailStr
    phone: str
    password: str
    business_name: str
    user_type: Literal["seller", "buyer"]
    address: str


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

    class Config:
        from_attributes = True


class StatsResponse(BaseModel):
    total_users: int
    sellers: int
    buyers: int
