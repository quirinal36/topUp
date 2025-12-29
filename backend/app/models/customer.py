"""
고객 모델
"""
from datetime import datetime
from pydantic import BaseModel, Field


class Customer(BaseModel):
    """고객 모델"""
    id: str = Field(..., description="고유 식별자 (UUID)")
    shop_id: str = Field(..., description="소속 상점 ID")
    name: str = Field(..., description="고객 성함")
    phone_suffix: str = Field(..., max_length=4, description="연락처 뒷자리 4자리")
    current_balance: int = Field(default=0, description="현재 보유 잔액")
    created_at: datetime = Field(default_factory=datetime.now, description="최초 등록일")

    class Config:
        from_attributes = True
