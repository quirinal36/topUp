"""
메뉴 관련 스키마
"""
from typing import List, Optional
from pydantic import BaseModel, Field


class MenuCreate(BaseModel):
    """메뉴 생성 요청"""
    name: str = Field(..., min_length=1, max_length=100, description="메뉴명")
    price: int = Field(..., ge=0, description="가격 (원)")


class MenuUpdate(BaseModel):
    """메뉴 수정 요청"""
    name: Optional[str] = Field(None, min_length=1, max_length=100, description="메뉴명")
    price: Optional[int] = Field(None, ge=0, description="가격 (원)")
    is_active: Optional[bool] = Field(None, description="활성화 여부")
    display_order: Optional[int] = Field(None, ge=0, description="표시 순서")


class MenuResponse(BaseModel):
    """메뉴 응답"""
    id: str
    name: str
    price: int
    is_active: bool
    display_order: int
    created_at: str


class MenuListResponse(BaseModel):
    """메뉴 목록 응답"""
    menus: List[MenuResponse]
    total: int


class MenuReorderRequest(BaseModel):
    """메뉴 순서 변경 요청"""
    menu_ids: List[str] = Field(..., description="순서대로 정렬된 메뉴 ID 목록")
