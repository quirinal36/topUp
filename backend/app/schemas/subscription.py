"""
구독 관련 스키마
"""
from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, Field
from ..models.subscription import SubscriptionStatus, PaymentStatus


# ===== 구독 응답 스키마 =====

class SubscriptionResponse(BaseModel):
    """구독 정보 응답"""
    id: str
    shop_id: str
    status: SubscriptionStatus

    # 구독 기간
    trial_started_at: Optional[datetime]
    trial_ends_at: Optional[datetime]
    current_period_start: Optional[datetime]
    current_period_end: Optional[datetime]

    # 결제 정보
    has_billing_key: bool = Field(description="빌링키 등록 여부")
    monthly_amount: int

    # 유예/정지 관련
    grace_period_ends_at: Optional[datetime]
    suspended_at: Optional[datetime]
    cancelled_at: Optional[datetime]

    # 편의 필드
    days_remaining: Optional[int] = Field(None, description="남은 일수 (체험/유예 기간)")
    is_active: bool = Field(description="서비스 이용 가능 여부")
    is_read_only: bool = Field(description="읽기 전용 모드 여부")

    created_at: datetime


class PaymentHistoryResponse(BaseModel):
    """결제 내역 응답"""
    id: str
    amount: int
    order_id: str
    status: PaymentStatus
    card_company: Optional[str]
    card_number: Optional[str]
    failure_message: Optional[str]
    paid_at: Optional[datetime]
    created_at: datetime


class PaymentHistoryListResponse(BaseModel):
    """결제 내역 목록 응답"""
    payments: List[PaymentHistoryResponse]
    total: int


# ===== 빌링키 관련 스키마 =====

class RegisterBillingKeyRequest(BaseModel):
    """빌링키 등록 요청 (토스페이먼츠 인증 완료 후)"""
    auth_key: str = Field(..., description="토스페이먼츠 인증키")
    customer_key: str = Field(..., description="고객 식별키")


class BillingKeyResponse(BaseModel):
    """빌링키 등록 응답"""
    success: bool
    card_company: Optional[str]
    card_number: Optional[str]
    message: str


# ===== 구독 관리 스키마 =====

class SubscribeRequest(BaseModel):
    """구독 시작 요청"""
    pass  # 빌링키가 이미 등록된 상태에서 호출


class CancelSubscriptionRequest(BaseModel):
    """구독 취소 요청"""
    reason: Optional[str] = Field(None, max_length=500, description="취소 사유")


class SubscriptionActionResponse(BaseModel):
    """구독 액션 응답"""
    success: bool
    message: str
    subscription: Optional[SubscriptionResponse]


# ===== 웹훅 스키마 =====

class TossPaymentsWebhook(BaseModel):
    """토스페이먼츠 웹훅 페이로드"""
    event_type: str = Field(alias="eventType")
    data: dict


# ===== 알림 관련 스키마 =====

class UpdatePhoneRequest(BaseModel):
    """연락처 업데이트 요청"""
    phone: str = Field(..., min_length=10, max_length=15, description="연락처 (- 없이)")
