"""
거래 관리 API 라우터
충전, 차감, 취소 등
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import Optional
from datetime import datetime, date, timedelta

from ..database import get_supabase_admin_client
from ..utils import now_seoul_iso
from ..routers.auth import get_current_shop
from ..models.transaction import TransactionType
from ..schemas.transaction import (
    ChargeRequest,
    DeductRequest,
    CancelRequest,
    TransactionResponse,
    TransactionWithCustomer,
    TransactionListResponse
)

router = APIRouter(prefix="/api/transactions", tags=["거래 관리"])


@router.get("", response_model=TransactionListResponse)
async def get_transactions(
    customer_id: Optional[str] = Query(None, description="고객 ID로 필터링"),
    type: Optional[TransactionType] = Query(None, description="거래 유형으로 필터링"),
    start_date: Optional[date] = Query(None, description="시작일 (YYYY-MM-DD)"),
    end_date: Optional[date] = Query(None, description="종료일 (YYYY-MM-DD)"),
    search: Optional[str] = Query(None, description="고객 이름 또는 전화번호 뒷자리 검색"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    shop_id: str = Depends(get_current_shop)
):
    """거래 내역 조회"""
    # RLS 우회를 위해 admin 클라이언트 사용
    db = get_supabase_admin_client()

    # 해당 상점의 고객 조회 (이름, 전화번호 포함)
    customers_query = db.table("customers").select("id, name, phone_suffix").eq("shop_id", shop_id)
    customers_result = customers_query.execute()

    # 고객 이름 또는 전화번호 뒷자리 검색
    if search:
        search_lower = search.lower()
        filtered_customers = [
            c for c in customers_result.data
            if search_lower in c["name"].lower() or search in c.get("phone_suffix", "")
        ]
    else:
        filtered_customers = customers_result.data

    customer_map = {c["id"]: c["name"] for c in filtered_customers}
    customer_ids = list(customer_map.keys())

    if not customer_ids:
        return TransactionListResponse(
            transactions=[], total=0, page=page, page_size=page_size,
            total_charge=0, total_deduct=0
        )

    # 거래 조회 쿼리 구성
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

    # 날짜 필터링
    if start_date:
        start_datetime = datetime.combine(start_date, datetime.min.time()).isoformat()
        base_query = base_query.gte("created_at", start_datetime)

    if end_date:
        end_datetime = datetime.combine(end_date + timedelta(days=1), datetime.min.time()).isoformat()
        base_query = base_query.lt("created_at", end_datetime)

    # 페이지네이션 적용하여 거래 조회
    offset = (page - 1) * page_size
    result = base_query.order("created_at", desc=True).range(offset, offset + page_size - 1).execute()

    # 합계 계산을 위한 별도 쿼리 (필터 조건은 동일, 페이지네이션 제외)
    sum_query = db.table("transactions").select("type, amount").in_("customer_id", customer_ids)

    if customer_id:
        sum_query = sum_query.eq("customer_id", customer_id)
    if start_date:
        sum_query = sum_query.gte("created_at", start_datetime)
    if end_date:
        sum_query = sum_query.lt("created_at", end_datetime)

    sum_result = sum_query.execute()

    total_charge = sum(t["amount"] for t in sum_result.data if t["type"] == "CHARGE")
    total_deduct = sum(t["amount"] for t in sum_result.data if t["type"] == "DEDUCT")

    transactions = [
        TransactionWithCustomer(
            id=t["id"],
            customer_id=t["customer_id"],
            customer_name=customer_map.get(t["customer_id"]),
            type=t["type"],
            amount=t["amount"],
            actual_payment=t.get("actual_payment"),
            service_amount=t.get("service_amount"),
            payment_method=t.get("payment_method"),
            note=t.get("note"),
            created_at=t["created_at"],
            is_cancelled=t.get("is_cancelled", False),
            cancelled_by_id=t.get("cancelled_by_id")
        )
        for t in result.data
    ]

    return TransactionListResponse(
        transactions=transactions,
        total=result.count or 0,
        page=page,
        page_size=page_size,
        total_charge=total_charge,
        total_deduct=total_deduct
    )


@router.post("/charge", response_model=TransactionResponse, status_code=status.HTTP_201_CREATED)
async def charge(
    request: ChargeRequest,
    shop_id: str = Depends(get_current_shop)
):
    """선불 충전 (원자적 트랜잭션)"""
    db = get_supabase_admin_client()

    # 원자적 충전 RPC 함수 호출 (Race Condition 방지)
    result = db.rpc("charge_balance", {
        "p_customer_id": request.customer_id,
        "p_shop_id": shop_id,
        "p_actual_payment": request.actual_payment,
        "p_service_amount": request.service_amount,
        "p_payment_method": request.payment_method.value,
        "p_note": request.note
    }).execute()

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="충전 처리 중 오류가 발생했습니다"
        )

    rpc_result = result.data

    # RPC 함수에서 반환된 에러 처리
    if not rpc_result.get("success"):
        error_code = rpc_result.get("error", "UNKNOWN_ERROR")
        error_message = rpc_result.get("message", "알 수 없는 오류가 발생했습니다")

        if error_code == "CUSTOMER_NOT_FOUND":
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=error_message)
        elif error_code == "UNAUTHORIZED":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=error_message)
        else:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error_message)

    return TransactionResponse(
        id=rpc_result["transaction_id"],
        customer_id=rpc_result["customer_id"],
        type=TransactionType.CHARGE,
        amount=rpc_result["amount"],
        actual_payment=rpc_result["actual_payment"],
        service_amount=rpc_result["service_amount"],
        payment_method=request.payment_method,
        note=rpc_result.get("note"),
        created_at=now_seoul_iso(),
        new_balance=rpc_result.get("new_balance")
    )


@router.post("/deduct", response_model=TransactionResponse, status_code=status.HTTP_201_CREATED)
async def deduct(
    request: DeductRequest,
    shop_id: str = Depends(get_current_shop)
):
    """서비스 이용 차감 (원자적 트랜잭션)"""
    db = get_supabase_admin_client()

    # 원자적 차감 RPC 함수 호출 (Race Condition 방지, 잔액 검증 원자적 수행)
    result = db.rpc("deduct_balance", {
        "p_customer_id": request.customer_id,
        "p_shop_id": shop_id,
        "p_amount": request.amount,
        "p_note": request.note
    }).execute()

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="차감 처리 중 오류가 발생했습니다"
        )

    rpc_result = result.data

    # RPC 함수에서 반환된 에러 처리
    if not rpc_result.get("success"):
        error_code = rpc_result.get("error", "UNKNOWN_ERROR")
        error_message = rpc_result.get("message", "알 수 없는 오류가 발생했습니다")

        if error_code == "CUSTOMER_NOT_FOUND":
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=error_message)
        elif error_code == "UNAUTHORIZED":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=error_message)
        elif error_code == "INSUFFICIENT_BALANCE":
            current_balance = rpc_result.get("current_balance", 0)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"잔액이 부족합니다. 현재 잔액: {current_balance:,}원"
            )
        elif error_code == "INVALID_AMOUNT":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error_message)
        else:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error_message)

    return TransactionResponse(
        id=rpc_result["transaction_id"],
        customer_id=rpc_result["customer_id"],
        type=TransactionType.DEDUCT,
        amount=rpc_result["amount"],
        actual_payment=None,
        service_amount=None,
        payment_method=None,
        note=rpc_result.get("note"),
        created_at=now_seoul_iso(),
        new_balance=rpc_result.get("new_balance")
    )


@router.post("/cancel", response_model=TransactionResponse, status_code=status.HTTP_201_CREATED)
async def cancel(
    request: CancelRequest,
    shop_id: str = Depends(get_current_shop)
):
    """거래 취소 (원자적 트랜잭션, PIN 검증 필요)"""
    db = get_supabase_admin_client()

    # 취소 사유 포함한 노트 생성
    cancel_note = "거래 취소"
    if request.reason:
        cancel_note += f": {request.reason}"

    # 원자적 취소 RPC 함수 호출 (Race Condition 방지)
    result = db.rpc("cancel_transaction", {
        "p_transaction_id": request.transaction_id,
        "p_shop_id": shop_id,
        "p_note": cancel_note
    }).execute()

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="취소 처리 중 오류가 발생했습니다"
        )

    rpc_result = result.data

    # RPC 함수에서 반환된 에러 처리
    if not rpc_result.get("success"):
        error_code = rpc_result.get("error", "UNKNOWN_ERROR")
        error_message = rpc_result.get("message", "알 수 없는 오류가 발생했습니다")

        if error_code == "TRANSACTION_NOT_FOUND":
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=error_message)
        elif error_code == "UNAUTHORIZED":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=error_message)
        elif error_code == "INVALID_CANCEL":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error_message)
        elif error_code == "ALREADY_CANCELLED":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error_message)
        elif error_code == "INSUFFICIENT_BALANCE_FOR_CANCEL":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error_message)
        else:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error_message)

    return TransactionResponse(
        id=rpc_result["transaction_id"],
        customer_id=rpc_result["customer_id"],
        type=TransactionType.CANCEL,
        amount=rpc_result["amount"],
        actual_payment=None,
        service_amount=None,
        payment_method=None,
        note=rpc_result.get("note"),
        created_at=now_seoul_iso(),
        new_balance=rpc_result.get("new_balance")
    )
