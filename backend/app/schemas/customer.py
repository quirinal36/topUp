"""
고객 관련 스키마
"""
from typing import Optional, List
from pydantic import BaseModel, Field


class CustomerCreate(BaseModel):
    """고객 생성 요청"""
    name: str = Field(..., min_length=1, max_length=50, description="고객 성함")
    phone_suffix: str = Field(..., min_length=4, max_length=4, pattern=r"^\d{4}$", description="연락처 뒷자리")


class CustomerUpdate(BaseModel):
    """고객 수정 요청"""
    name: Optional[str] = Field(None, min_length=1, max_length=50)
    phone_suffix: Optional[str] = Field(None, min_length=4, max_length=4, pattern=r"^\d{4}$")


class CustomerResponse(BaseModel):
    """고객 응답"""
    id: str
    name: str
    phone_suffix: str
    current_balance: int
    created_at: str


class CustomerDetail(CustomerResponse):
    """고객 상세 정보"""
    total_charged: int = Field(description="총 충전액")
    total_used: int = Field(description="총 사용액")
    transaction_count: int = Field(description="거래 횟수")


class CustomerListResponse(BaseModel):
    """고객 목록 응답"""
    customers: List[CustomerResponse]
    total: int
    page: int
    page_size: int


class CustomerSearchQuery(BaseModel):
    """고객 검색 쿼리"""
    query: Optional[str] = Field(None, description="이름 또는 연락처로 검색")
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)
