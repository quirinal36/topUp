"""
인증 관련 스키마
"""
from typing import Optional
from pydantic import BaseModel, Field


class TokenResponse(BaseModel):
    """토큰 응답"""
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class ShopCreate(BaseModel):
    """상점 생성 요청"""
    name: str = Field(..., min_length=1, max_length=100, description="상점명")
    pin: str = Field(..., min_length=4, max_length=4, pattern=r"^\d{4}$", description="4자리 PIN")


class ShopResponse(BaseModel):
    """상점 응답"""
    id: str
    name: str
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


class SocialLoginRequest(BaseModel):
    """소셜 로그인 요청"""
    code: str = Field(..., description="OAuth 인증 코드")
    state: Optional[str] = Field(None, description="CSRF 방지용 state")


class SocialAccountLink(BaseModel):
    """소셜 계정 연동 정보"""
    provider: str
    email: Optional[str]
    is_primary: bool
    linked_at: str
