"""
상점 및 소셜 계정 모델
"""
from enum import Enum
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class SocialProvider(str, Enum):
    """소셜 로그인 제공자"""
    NAVER = "NAVER"
    KAKAO = "KAKAO"


class Shop(BaseModel):
    """상점 모델"""
    id: str = Field(..., description="상점 고유 식별자 (UUID)")
    name: str = Field(..., description="상점명")
    pin_hash: str = Field(..., description="4자리 PIN 해시값")
    pin_failed_count: int = Field(default=0, description="PIN 연속 실패 횟수")
    pin_locked_until: Optional[datetime] = Field(None, description="PIN 잠금 해제 시간")
    created_at: datetime = Field(default_factory=datetime.now, description="상점 등록일")
    updated_at: datetime = Field(default_factory=datetime.now, description="최종 수정일")

    class Config:
        from_attributes = True


class SocialAccount(BaseModel):
    """소셜 계정 연동 모델"""
    id: str = Field(..., description="고유 식별자 (UUID)")
    shop_id: str = Field(..., description="연결된 상점 ID")
    provider: SocialProvider = Field(..., description="소셜 플랫폼")
    provider_user_id: str = Field(..., description="소셜 플랫폼 사용자 ID")
    email: Optional[str] = Field(None, description="소셜 계정 이메일")
    is_primary: bool = Field(default=False, description="주 계정 여부")
    created_at: datetime = Field(default_factory=datetime.now, description="연동일")

    class Config:
        from_attributes = True
