"""
인증 관련 스키마
"""
import re
from typing import Optional
from pydantic import BaseModel, Field, field_validator


class TokenResponse(BaseModel):
    """토큰 응답"""
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    shop_id: Optional[str] = None


class LoginRequest(BaseModel):
    """로그인 요청"""
    email: str = Field(..., description="이메일")
    password: str = Field(..., min_length=8, description="비밀번호")

    @field_validator('email')
    @classmethod
    def validate_email(cls, v: str) -> str:
        email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        if not re.match(email_pattern, v):
            raise ValueError('올바른 이메일 형식이 아닙니다')
        return v.lower()


class RegisterRequest(BaseModel):
    """회원가입 요청"""
    email: str = Field(..., description="이메일")
    password: str = Field(..., min_length=8, description="비밀번호 (8자 이상)")
    shop_name: str = Field(..., min_length=1, max_length=100, description="상점명")

    @field_validator('email')
    @classmethod
    def validate_email(cls, v: str) -> str:
        email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        if not re.match(email_pattern, v):
            raise ValueError('올바른 이메일 형식이 아닙니다')
        return v.lower()

    @field_validator('password')
    @classmethod
    def validate_password(cls, v: str) -> str:
        if not any(c.isalpha() for c in v):
            raise ValueError('비밀번호는 영문을 포함해야 합니다')
        if not any(c.isdigit() for c in v):
            raise ValueError('비밀번호는 숫자를 포함해야 합니다')
        return v


class ShopResponse(BaseModel):
    """상점 응답"""
    id: str
    name: str
    email: Optional[str] = None
    created_at: str


class PinVerifyRequest(BaseModel):
    """PIN 검증 요청"""
    pin: str = Field(..., min_length=4, max_length=4, pattern=r"^\d{4}$")


class PinVerifyResponse(BaseModel):
    """PIN 검증 응답"""
    verified: bool
    remaining_attempts: Optional[int] = None
    locked_until: Optional[str] = None


class PinChangeRequest(BaseModel):
    """PIN 변경 요청"""
    current_pin: str = Field(..., min_length=4, max_length=4, pattern=r"^\d{4}$")
    new_pin: str = Field(..., min_length=4, max_length=4, pattern=r"^\d{4}$")
