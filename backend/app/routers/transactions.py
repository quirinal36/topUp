"""
거래 관리 API 라우터
충전, 차감, 취소 등
"""
import json
import logging
from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import Optional
from datetime import datetime, date, timedelta
from postgrest.exceptions import APIError

from ..database import get_supabase_admin_client

logger = logging.getLogger(__name__)
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


def _parse_rpc_error(e: APIError) -> Optional[dict]:
    """
    Supabase postgrest APIError에서 RPC 함수가 반환한 에러 JSON을 추출합니다.
    RPC 함수가 success: false를 반환하면 postgrest가 이를 파싱하지 못하고 APIError를 발생시킵니다.
    """
    try:
        # e.details가 있으면 직접 파싱 시도 (가장 일반적인 경우)
        if hasattr(e, 'details') and e.details:
            details = e.details

            # bytes인 경우 UTF-8 디코딩
            if isinstance(details, bytes):
                return json.loads(details.decode('utf-8'))

            # 문자열인 경우
            if isinstance(details, str):
                # b'...' 형태의 문자열인 경우 (bytes repr)
                if details.startswith("b'") and details.endswith("'"):
                    json_str = details[2:-1]  # b' 와 ' 제거
                    # UTF-8 바이트 시퀀스(\xNN)를 실제 바이트로 변환 후 UTF-8 디코딩
                    json_bytes = json_str.encode('latin-1').decode('unicode_escape').encode('latin-1')
                    return json.loads(json_bytes.decode('utf-8'))

                # 일반 JSON 문자열
                return json.loads(details)

        # fallback: 에러 메시지에서 details 추출 시도
        error_str = str(e)
        if "'details':" in error_str:
            import re
            # 'details': 'b\'...\'' 패턴 매칭
            match = re.search(r"'details':\s*'(b\\'.*?\\')'", error_str)
            if match:
                details_str = match.group(1)
                # b\'...\' -> b'...'
                details_str = details_str.replace("\\'", "'")
                if details_str.startswith("b'") and details_str.endswith("'"):
                    json_str = details_str[2:-1]
                    json_bytes = json_str.encode('latin-1').decode('unicode_escape').encode('latin-1')
                    return json.loads(json_bytes.decode('utf-8'))

        return None
    except Exception as parse_error:
        logger.error(f"[RPC_ERROR] 에러 파싱 실패: {parse_error}, 원본: {e}")
        return None


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

    # 권한 검증
    if customer_id and customer_id not in customer_ids:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="해당 고객에 대한 접근 권한이 없습니다"
        )

    # 날짜 필터링 준비
    start_datetime = None
    end_datetime = None
    if start_date:
        start_datetime = datetime.combine(start_date, datetime.min.time()).isoformat()
    if end_date:
        end_datetime = datetime.combine(end_date + timedelta(days=1), datetime.min.time()).isoformat()

    # RPC 함수로 단일 쿼리 실행 (목록 + 합계 동시 조회)
    result = db.rpc("get_transactions_with_totals", {
        "p_shop_id": shop_id,
        "p_customer_id": customer_id,
        "p_type": type.value if type else None,
        "p_start_date": start_datetime,
        "p_end_date": end_datetime,
        "p_customer_ids": customer_ids,
        "p_page": page,
        "p_page_size": page_size
    }).execute()

    if not result.data:
        return TransactionListResponse(
            transactions=[], total=0, page=page, page_size=page_size,
            total_charge=0, total_deduct=0
        )

    data = result.data
    transactions_data = data.get("transactions", [])

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
        for t in transactions_data
    ]

    return TransactionListResponse(
        transactions=transactions,
        total=data.get("total_count", 0),
        page=page,
        page_size=page_size,
        total_charge=data.get("total_charge", 0),
        total_deduct=data.get("total_deduct", 0)
    )


@router.post("/charge", response_model=TransactionResponse, status_code=status.HTTP_201_CREATED)
async def charge(
    request: ChargeRequest,
    shop_id: str = Depends(get_current_shop)
):
    """선불 충전 (원자적 트랜잭션)"""
    db = get_supabase_admin_client()

    # 원자적 충전 RPC 함수 호출 (Race Condition 방지)
    try:
        result = db.rpc("charge_balance", {
            "p_customer_id": request.customer_id,
            "p_shop_id": shop_id,
            "p_actual_payment": request.actual_payment,
            "p_service_amount": request.service_amount,
            "p_payment_method": request.payment_method.value,
            "p_note": request.note
        }).execute()
        rpc_result = result.data
    except APIError as e:
        logger.warning(f"[CHARGE] APIError 발생: {str(e)}")
        rpc_result = _parse_rpc_error(e)
        if rpc_result is None:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="충전 처리 중 오류가 발생했습니다"
            )

    if not rpc_result:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="충전 처리 중 오류가 발생했습니다"
        )

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
    try:
        result = db.rpc("deduct_balance", {
            "p_customer_id": request.customer_id,
            "p_shop_id": shop_id,
            "p_amount": request.amount,
            "p_note": request.note
        }).execute()
        rpc_result = result.data
    except APIError as e:
        logger.warning(f"[DEDUCT] APIError 발생: {str(e)}")
        rpc_result = _parse_rpc_error(e)
        if rpc_result is None:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="차감 처리 중 오류가 발생했습니다"
            )

    if not rpc_result:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="차감 처리 중 오류가 발생했습니다"
        )

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
    try:
        result = db.rpc("cancel_transaction", {
            "p_transaction_id": request.transaction_id,
            "p_shop_id": shop_id,
            "p_note": cancel_note
        }).execute()
        rpc_result = result.data
    except APIError as e:
        # Supabase postgrest가 RPC 에러 응답을 파싱하지 못할 때 발생
        # Details에서 실제 에러 JSON을 추출
        logger.warning(f"[CANCEL] APIError 발생: {str(e)}")
        rpc_result = _parse_rpc_error(e)
        if rpc_result is None:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="취소 처리 중 오류가 발생했습니다"
            )

    if not rpc_result:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="취소 처리 중 오류가 발생했습니다"
        )

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
