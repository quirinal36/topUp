"""
거래 관리 API 라우터
충전, 차감, 취소 등
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import Optional
from datetime import datetime
import uuid

from ..database import get_supabase_admin_client
from ..routers.auth import get_current_shop
from ..models.transaction import TransactionType
from ..schemas.transaction import (
    ChargeRequest,
    DeductRequest,
    CancelRequest,
    TransactionResponse,
    TransactionListResponse
)

router = APIRouter(prefix="/api/transactions", tags=["거래 관리"])


@router.get("", response_model=TransactionListResponse)
async def get_transactions(
    customer_id: Optional[str] = Query(None, description="고객 ID로 필터링"),
    type: Optional[TransactionType] = Query(None, description="거래 유형으로 필터링"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    shop_id: str = Depends(get_current_shop)
):
    """거래 내역 조회"""
    # RLS 우회를 위해 admin 클라이언트 사용
    db = get_supabase_admin_client()

    # 해당 상점의 고객 ID 목록 조회
    customers = db.table("customers").select("id").eq("shop_id", shop_id).execute()
    customer_ids = [c["id"] for c in customers.data]

    if not customer_ids:
        return TransactionListResponse(transactions=[], total=0, page=page, page_size=page_size)

    # 거래 조회
    base_query = db.table("transactions").select("*", count="exact").in_("customer_id", customer_ids)

    if customer_id:
        if customer_id not in customer_ids:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="해당 고객에 대한 접근 권한이 없습니다"
            )
        base_query = base_query.eq("customer_id", customer_id)

    if type:
        base_query = base_query.eq("type", type.value)

    offset = (page - 1) * page_size
    result = base_query.order("created_at", desc=True).range(offset, offset + page_size - 1).execute()

    transactions = [
        TransactionResponse(
            id=t["id"],
            customer_id=t["customer_id"],
            type=t["type"],
            amount=t["amount"],
            actual_payment=t.get("actual_payment"),
            service_amount=t.get("service_amount"),
            payment_method=t.get("payment_method"),
            note=t.get("note"),
            created_at=t["created_at"]
        )
        for t in result.data
    ]

    return TransactionListResponse(
        transactions=transactions,
        total=result.count or 0,
        page=page,
        page_size=page_size
    )


@router.post("/charge", response_model=TransactionResponse, status_code=status.HTTP_201_CREATED)
async def charge(
    request: ChargeRequest,
    shop_id: str = Depends(get_current_shop)
):
    """선불 충전"""
    # RLS 우회를 위해 admin 클라이언트 사용
    db = get_supabase_admin_client()

    # 고객 확인
    customer = db.table("customers").select("*").eq("id", request.customer_id).eq("shop_id", shop_id).maybe_single().execute()

    if not customer or not customer.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="고객을 찾을 수 없습니다"
        )

    # 충전 금액 계산
    total_amount = request.actual_payment + request.service_amount

    # 거래 생성
    transaction_id = str(uuid.uuid4())
    transaction = {
        "id": transaction_id,
        "customer_id": request.customer_id,
        "type": "CHARGE",
        "amount": total_amount,
        "actual_payment": request.actual_payment,
        "service_amount": request.service_amount,
        "payment_method": request.payment_method.value,
        "note": request.note,
        "created_at": datetime.now().isoformat()
    }

    db.table("transactions").insert(transaction).execute()

    # 잔액 업데이트
    new_balance = customer.data["current_balance"] + total_amount
    db.table("customers").update({"current_balance": new_balance}).eq("id", request.customer_id).execute()

    return TransactionResponse(
        id=transaction_id,
        customer_id=request.customer_id,
        type=TransactionType.CHARGE,
        amount=total_amount,
        actual_payment=request.actual_payment,
        service_amount=request.service_amount,
        payment_method=request.payment_method,
        note=request.note,
        created_at=transaction["created_at"]
    )


@router.post("/deduct", response_model=TransactionResponse, status_code=status.HTTP_201_CREATED)
async def deduct(
    request: DeductRequest,
    shop_id: str = Depends(get_current_shop)
):
    """서비스 이용 (차감)"""
    # RLS 우회를 위해 admin 클라이언트 사용
    db = get_supabase_admin_client()

    # 고객 확인
    customer = db.table("customers").select("*").eq("id", request.customer_id).eq("shop_id", shop_id).maybe_single().execute()

    if not customer or not customer.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="고객을 찾을 수 없습니다"
        )

    # 잔액 확인
    if customer.data["current_balance"] < request.amount:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"잔액이 부족합니다. 현재 잔액: {customer.data['current_balance']:,}원"
        )

    # 거래 생성
    transaction_id = str(uuid.uuid4())
    transaction = {
        "id": transaction_id,
        "customer_id": request.customer_id,
        "type": "DEDUCT",
        "amount": request.amount,
        "note": request.note,
        "created_at": datetime.now().isoformat()
    }

    db.table("transactions").insert(transaction).execute()

    # 잔액 업데이트
    new_balance = customer.data["current_balance"] - request.amount
    db.table("customers").update({"current_balance": new_balance}).eq("id", request.customer_id).execute()

    return TransactionResponse(
        id=transaction_id,
        customer_id=request.customer_id,
        type=TransactionType.DEDUCT,
        amount=request.amount,
        actual_payment=None,
        service_amount=None,
        payment_method=None,
        note=request.note,
        created_at=transaction["created_at"]
    )


@router.post("/cancel", response_model=TransactionResponse, status_code=status.HTTP_201_CREATED)
async def cancel(
    request: CancelRequest,
    shop_id: str = Depends(get_current_shop)
):
    """거래 취소 (PIN 검증 필요)"""
    # RLS 우회를 위해 admin 클라이언트 사용
    db = get_supabase_admin_client()

    # 원본 거래 조회
    original = db.table("transactions").select("*").eq("id", request.transaction_id).maybe_single().execute()

    if not original or not original.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="거래를 찾을 수 없습니다"
        )

    # 이미 취소된 거래인지 확인
    if original.data["type"] == "CANCEL":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="이미 취소된 거래입니다"
        )

    # 고객 및 상점 확인
    customer = db.table("customers").select("*").eq("id", original.data["customer_id"]).eq("shop_id", shop_id).maybe_single().execute()

    if not customer or not customer.data:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="해당 거래에 대한 접근 권한이 없습니다"
        )

    # 취소 거래 생성
    cancel_amount = original.data["amount"]
    transaction_id = str(uuid.uuid4())
    transaction = {
        "id": transaction_id,
        "customer_id": original.data["customer_id"],
        "type": "CANCEL",
        "amount": cancel_amount,
        "note": f"거래 취소: {request.transaction_id}" + (f" - {request.reason}" if request.reason else ""),
        "created_at": datetime.now().isoformat()
    }

    db.table("transactions").insert(transaction).execute()

    # 잔액 복구/차감
    if original.data["type"] == "CHARGE":
        # 충전 취소 -> 잔액 차감
        new_balance = customer.data["current_balance"] - cancel_amount
    else:
        # 차감 취소 -> 잔액 복구
        new_balance = customer.data["current_balance"] + cancel_amount

    db.table("customers").update({"current_balance": new_balance}).eq("id", original.data["customer_id"]).execute()

    return TransactionResponse(
        id=transaction_id,
        customer_id=original.data["customer_id"],
        type=TransactionType.CANCEL,
        amount=cancel_amount,
        actual_payment=None,
        service_amount=None,
        payment_method=None,
        note=transaction["note"],
        created_at=transaction["created_at"]
    )
