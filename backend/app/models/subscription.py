"""
구독 관련 모델
"""
from enum import Enum
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class SubscriptionStatus(str, Enum):
    """구독 상태"""
    TRIAL = "TRIAL"          # 무료 체험 중 (14일)
    ACTIVE = "ACTIVE"        # 정상 구독 중
    GRACE = "GRACE"          # 결제 실패 유예 기간 (7일)
    SUSPENDED = "SUSPENDED"  # 구독 정지 (읽기전용)
    CANCELLED = "CANCELLED"  # 구독 취소 (다음 결제일까지 사용)


class PaymentStatus(str, Enum):
    """결제 상태"""
    PENDING = "PENDING"
    SUCCESS = "SUCCESS"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"


class Subscription(BaseModel):
    """구독 모델"""
    id: str = Field(..., description="구독 고유 ID")
    shop_id: str = Field(..., description="상점 ID")
    status: SubscriptionStatus = Field(default=SubscriptionStatus.TRIAL)

    # 구독 기간
    trial_started_at: Optional[datetime] = Field(None, description="체험 시작일")
    trial_ends_at: Optional[datetime] = Field(None, description="체험 종료일")
    current_period_start: Optional[datetime] = Field(None, description="현재 구독 시작일")
    current_period_end: Optional[datetime] = Field(None, description="현재 구독 종료일 (다음 결제일)")

    # 결제 정보
    billing_key: Optional[str] = Field(None, description="토스페이먼츠 빌링키")
    monthly_amount: int = Field(default=9900, description="월 구독 금액")

    # 유예/정지 관련
    grace_period_ends_at: Optional[datetime] = Field(None, description="유예 기간 종료일")
    suspended_at: Optional[datetime] = Field(None, description="정지일")
    cancelled_at: Optional[datetime] = Field(None, description="취소일")
    cancel_reason: Optional[str] = Field(None, description="취소 사유")

    # 타임스탬프
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)

    class Config:
        from_attributes = True


class PaymentHistory(BaseModel):
    """결제 내역 모델"""
    id: str = Field(..., description="결제 내역 ID")
    subscription_id: str = Field(..., description="구독 ID")
    shop_id: str = Field(..., description="상점 ID")

    # 결제 정보
    amount: int = Field(..., description="결제 금액")
    payment_key: Optional[str] = Field(None, description="토스페이먼츠 결제키")
    order_id: str = Field(..., description="주문번호")
    status: PaymentStatus = Field(default=PaymentStatus.PENDING)

    # 카드 정보
    card_company: Optional[str] = Field(None, description="카드사")
    card_number: Optional[str] = Field(None, description="마스킹된 카드번호")

    # 실패 정보
    failure_code: Optional[str] = Field(None)
    failure_message: Optional[str] = Field(None)

    # 타임스탬프
    paid_at: Optional[datetime] = Field(None, description="결제 완료 시간")
    created_at: datetime = Field(default_factory=datetime.now)

    class Config:
        from_attributes = True
