"""
고객 관리 API 라우터
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import Optional
import uuid

from ..database import get_supabase_admin_client
from ..routers.auth import get_current_shop
from ..middleware.subscription_check import require_active_subscription
from ..schemas.customer import (
    CustomerCreate,
    CustomerUpdate,
    CustomerResponse,
    CustomerDetail,
    CustomerListResponse
)

router = APIRouter(prefix="/api/customers", tags=["고객 관리"])


@router.get("", response_model=CustomerListResponse)
async def get_customers(
    query: Optional[str] = Query(None, description="이름 또는 연락처로 검색"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    shop_id: str = Depends(get_current_shop)
):
    """고객 목록 조회 (검색 및 페이지네이션)"""
    # RLS 우회를 위해 admin 클라이언트 사용
    admin_db = get_supabase_admin_client()

    # 기본 쿼리
    base_query = admin_db.table("customers").select("*", count="exact").eq("shop_id", shop_id)

    # 검색 조건
    if query:
        base_query = base_query.or_(f"name.ilike.%{query}%,phone_suffix.ilike.%{query}%")

    # 페이지네이션
    offset = (page - 1) * page_size
    result = base_query.order("created_at", desc=True).range(offset, offset + page_size - 1).execute()

    customers = [
        CustomerResponse(
            id=c["id"],
            name=c["name"],
            phone_suffix=c["phone_suffix"],
            current_balance=c["current_balance"],
            created_at=c["created_at"]
        )
        for c in result.data
    ]

    return CustomerListResponse(
        customers=customers,
        total=result.count or 0,
        page=page,
        page_size=page_size
    )


@router.post("", response_model=CustomerResponse, status_code=status.HTTP_201_CREATED)
async def create_customer(
    customer: CustomerCreate,
    shop_id: str = Depends(require_active_subscription)
):
    """신규 고객 등록"""
    # RLS 우회를 위해 admin 클라이언트 사용
    admin_db = get_supabase_admin_client()

    # 중복 확인 (같은 상점 내 동일 이름 + 연락처)
    existing = admin_db.table("customers").select("id").eq("shop_id", shop_id).eq(
        "name", customer.name
    ).eq("phone_suffix", customer.phone_suffix).execute()

    if existing.data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="이미 등록된 고객입니다"
        )

    # 고객 생성 (RLS 우회를 위해 admin 클라이언트 사용)
    from datetime import datetime
    new_customer = {
        "id": str(uuid.uuid4()),
        "shop_id": shop_id,
        "name": customer.name,
        "phone_suffix": customer.phone_suffix,
        "current_balance": 0,
        "created_at": datetime.now().isoformat()
    }

    admin_db = get_supabase_admin_client()
    admin_db.table("customers").insert(new_customer).execute()

    return CustomerResponse(
        id=new_customer["id"],
        name=new_customer["name"],
        phone_suffix=new_customer["phone_suffix"],
        current_balance=0,
        created_at=new_customer["created_at"]
    )


@router.get("/{customer_id}", response_model=CustomerDetail)
async def get_customer(
    customer_id: str,
    shop_id: str = Depends(get_current_shop)
):
    """고객 상세 정보 조회"""
    # RLS 우회를 위해 admin 클라이언트 사용
    admin_db = get_supabase_admin_client()

    # 고객 정보
    result = admin_db.table("customers").select("*").eq("id", customer_id).eq("shop_id", shop_id).maybe_single().execute()

    if not result or not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="고객을 찾을 수 없습니다"
        )

    customer = result.data

    # 거래 통계
    transactions = admin_db.table("transactions").select("type, amount").eq("customer_id", customer_id).execute()

    total_charged = sum(t["amount"] for t in transactions.data if t["type"] == "CHARGE")
    total_used = sum(t["amount"] for t in transactions.data if t["type"] == "DEDUCT")

    return CustomerDetail(
        id=customer["id"],
        name=customer["name"],
        phone_suffix=customer["phone_suffix"],
        current_balance=customer["current_balance"],
        created_at=customer["created_at"],
        total_charged=total_charged,
        total_used=total_used,
        transaction_count=len(transactions.data)
    )


@router.put("/{customer_id}", response_model=CustomerResponse)
async def update_customer(
    customer_id: str,
    customer: CustomerUpdate,
    shop_id: str = Depends(require_active_subscription)
):
    """고객 정보 수정 (PIN 검증 필요)"""
    # RLS 우회를 위해 admin 클라이언트 사용
    admin_db = get_supabase_admin_client()

    # 고객 존재 확인
    existing = admin_db.table("customers").select("*").eq("id", customer_id).eq("shop_id", shop_id).maybe_single().execute()

    if not existing or not existing.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="고객을 찾을 수 없습니다"
        )

    # 업데이트할 필드만 추출
    update_data = customer.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="수정할 내용이 없습니다"
        )

    result = admin_db.table("customers").update(update_data).eq("id", customer_id).execute()

    updated = {**existing.data, **update_data}
    return CustomerResponse(
        id=updated["id"],
        name=updated["name"],
        phone_suffix=updated["phone_suffix"],
        current_balance=updated["current_balance"],
        created_at=updated["created_at"]
    )


@router.delete("/{customer_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_customer(
    customer_id: str,
    shop_id: str = Depends(require_active_subscription)
):
    """고객 삭제 (PIN 검증 필요)"""
    # RLS 우회를 위해 admin 클라이언트 사용
    admin_db = get_supabase_admin_client()

    # 고객 존재 확인
    existing = admin_db.table("customers").select("id, current_balance").eq("id", customer_id).eq("shop_id", shop_id).maybe_single().execute()

    if not existing or not existing.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="고객을 찾을 수 없습니다"
        )

    # 잔액 확인
    if existing.data["current_balance"] > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="잔액이 있는 고객은 삭제할 수 없습니다"
        )

    admin_db.table("customers").delete().eq("id", customer_id).execute()
