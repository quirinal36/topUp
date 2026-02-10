"""
온보딩 관련 스키마
"""
import re
from typing import List, Optional
from pydantic import BaseModel, Field, field_validator


class BusinessNumberVerifyRequest(BaseModel):
    """사업자등록번호 검증 요청"""
    business_number: str = Field(..., description="사업자등록번호")


class BusinessNumberVerifyResponse(BaseModel):
    """사업자등록번호 검증 응답"""
    is_valid: bool = Field(..., description="유효 여부")
    status_code: str = Field("", description="상태 코드 (01: 계속사업자, 02: 휴업, 03: 폐업)")
    status_name: str = Field("", description="상태명")
    tax_type: str = Field("", description="과세유형")
    message: str = Field(..., description="결과 메시지")


class BusinessNumberCheckDuplicateResponse(BaseModel):
    """사업자등록번호 중복 확인 응답"""
    is_duplicate: bool = Field(..., description="중복 여부")
    message: str = Field(..., description="결과 메시지")
    existing_username: Optional[str] = Field(None, description="이미 등록된 사용자 ID (마스킹)")
    existing_shop_name: Optional[str] = Field(None, description="이미 등록된 상점명")


class ShopOnboardingStep1(BaseModel):
    """Step 1: 상점 기본 정보"""
    name: str = Field(..., min_length=1, max_length=100, description="상점명")
    business_number: str = Field(..., description="사업자등록번호 (xxx-xx-xxxxx)")
    is_business_verified: bool = Field(default=False, description="사업자등록번호 검증 완료 여부")

    @field_validator('business_number')
    @classmethod
    def validate_business_number(cls, v: str) -> str:
        if not v or v.strip() == '':
            raise ValueError('사업자등록번호는 필수입니다')
        # 숫자만 추출
        digits = re.sub(r'[^0-9]', '', v)
        if len(digits) != 10:
            raise ValueError('사업자등록번호는 10자리 숫자여야 합니다')
        # 포맷팅하여 반환
        return f"{digits[:3]}-{digits[3:5]}-{digits[5:]}"


class MenuCreateItem(BaseModel):
    """메뉴 항목 (온보딩용)"""
    name: str = Field(..., min_length=1, max_length=100, description="메뉴명")
    price: int = Field(..., ge=0, description="가격 (원)")


class ShopOnboardingStep2(BaseModel):
    """Step 2: 메뉴 등록"""
    menus: List[MenuCreateItem] = Field(default_factory=list, description="메뉴 목록")


class CustomerImportRow(BaseModel):
    """고객 임포트 행"""
    name: str = Field(..., min_length=1, max_length=50, description="고객명")
    phone: str = Field(..., min_length=11, max_length=11, pattern=r"^010\d{8}$", description="연락처 (01012345678)")
    balance: int = Field(default=0, ge=0, description="초기 잔액")


class CustomerImportRequest(BaseModel):
    """Step 3: 고객 일괄 등록 요청"""
    customers: List[CustomerImportRow] = Field(..., description="고객 목록")


class CustomerImportResponse(BaseModel):
    """고객 일괄 등록 응답"""
    total: int = Field(..., description="전체 행 수")
    imported: int = Field(..., description="등록 성공 수")
    skipped: int = Field(..., description="건너뛴 수 (중복 등)")
    errors: List[str] = Field(default_factory=list, description="에러 메시지 목록")


class OnboardingStatusResponse(BaseModel):
    """온보딩 상태 응답"""
    completed: bool = Field(..., description="온보딩 완료 여부")
    shop_name: str = Field(..., description="상점명")
    business_number: Optional[str] = Field(None, description="사업자등록번호")
    menu_count: int = Field(..., description="등록된 메뉴 수")
    customer_count: int = Field(..., description="등록된 고객 수")
