"""
상점 모델
"""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class Shop(BaseModel):
    """상점 모델"""
    id: str = Field(..., description="상점 고유 식별자 (UUID)")
    username: str = Field(..., description="로그인 아이디 (영문 소문자 + 숫자, 4~20자)")
    email: Optional[str] = Field(None, description="비밀번호 재설정용 이메일 (선택)")
    name: str = Field(..., description="상점명")
    ci: Optional[str] = Field(None, description="NICE 본인인증 CI 값 (중복가입 방지용)")
    pin_hash: str = Field(..., description="4자리 PIN 해시값")
    pin_failed_count: int = Field(default=0, description="PIN 연속 실패 횟수")
    pin_locked_until: Optional[datetime] = Field(None, description="PIN 잠금 해제 시간")
    created_at: datetime = Field(default_factory=datetime.now, description="상점 등록일")
    updated_at: datetime = Field(default_factory=datetime.now, description="최종 수정일")

    class Config:
        from_attributes = True
