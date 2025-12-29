"""
거래 모델
"""
from enum import Enum
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class TransactionType(str, Enum):
    """거래 유형"""
    CHARGE = "CHARGE"    # 충전
    DEDUCT = "DEDUCT"    # 차감
    CANCEL = "CANCEL"    # 취소


class PaymentMethod(str, Enum):
    """결제 수단"""
    CARD = "CARD"        # 카드
    CASH = "CASH"        # 현금
    TRANSFER = "TRANSFER"  # 계좌이체


class Transaction(BaseModel):
    """거래 모델"""
    id: str = Field(..., description="거래 고유 ID (UUID)")
    customer_id: str = Field(..., description="관련 고객 ID")
    type: TransactionType = Field(..., description="거래 유형")
    amount: int = Field(..., description="거래 총액")
    actual_payment: Optional[int] = Field(None, description="실제 수납액 (충전 시)")
    service_amount: Optional[int] = Field(None, description="서비스 증정액 (충전 시)")
    payment_method: Optional[PaymentMethod] = Field(None, description="결제 수단")
    note: Optional[str] = Field(None, description="비고 (주문 메뉴 등)")
    created_at: datetime = Field(default_factory=datetime.now, description="거래 일시")

    class Config:
        from_attributes = True
