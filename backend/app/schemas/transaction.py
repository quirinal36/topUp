"""
거래 관련 스키마
"""
from typing import Optional, List
from pydantic import BaseModel, Field
from ..models.transaction import TransactionType, PaymentMethod


class ChargeRequest(BaseModel):
    """충전 요청"""
    customer_id: str = Field(..., description="고객 ID")
    actual_payment: int = Field(..., gt=0, description="실제 결제액")
    service_amount: int = Field(default=0, ge=0, description="서비스 증정액")
    payment_method: PaymentMethod = Field(..., description="결제 수단")
    note: Optional[str] = Field(None, max_length=200, description="비고")


class DeductRequest(BaseModel):
    """차감 요청"""
    customer_id: str = Field(..., description="고객 ID")
    amount: int = Field(..., gt=0, description="사용 금액")
    note: Optional[str] = Field(None, max_length=200, description="비고 (주문 메뉴)")


class CancelRequest(BaseModel):
    """거래 취소 요청"""
    transaction_id: str = Field(..., description="취소할 거래 ID")
    reason: Optional[str] = Field(None, max_length=200, description="취소 사유")


class TransactionResponse(BaseModel):
    """거래 응답"""
    id: str
    customer_id: str
    type: TransactionType
    amount: int
    actual_payment: Optional[int]
    service_amount: Optional[int]
    payment_method: Optional[PaymentMethod]
    note: Optional[str]
    created_at: str
    is_cancelled: bool = False
    cancelled_by_id: Optional[str] = None
    new_balance: Optional[int] = Field(None, description="거래 후 잔액 (검증용)")


class TransactionWithCustomer(TransactionResponse):
    """거래 응답 (고객 정보 포함)"""
    customer_name: Optional[str] = None


class TransactionListResponse(BaseModel):
    """거래 목록 응답"""
    transactions: List[TransactionWithCustomer]
    total: int
    page: int
    page_size: int
    total_charge: int = Field(default=0, description="필터 조건 충전 합계")
    total_deduct: int = Field(default=0, description="필터 조건 차감 합계")


class DashboardSummary(BaseModel):
    """대시보드 요약"""
    today_total_charge: int = Field(description="오늘 총 충전액")
    today_total_deduct: int = Field(description="오늘 총 차감액")
    total_balance: int = Field(description="전체 예치금 잔액")
    total_customers: int = Field(description="총 고객 수")


class AnalyticsPeriod(BaseModel):
    """기간별 통계"""
    period: str  # 날짜 또는 기간
    charge_amount: int
    deduct_amount: int
    transaction_count: int


class TopCustomer(BaseModel):
    """상위 고객"""
    customer_id: str
    name: str
    total_charged: int
    visit_count: int


class PaymentMethodStats(BaseModel):
    """결제 수단별 통계"""
    method: PaymentMethod
    count: int
    amount: int
    percentage: float
