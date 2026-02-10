"""
고객 관리 API 라우터
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import StreamingResponse
from typing import Optional
import uuid
import io
import logging
from openpyxl import Workbook

from ..database import get_supabase_admin_client
from ..utils import now_seoul_iso
from ..routers.auth import get_current_shop
from ..schemas.customer import (
    CustomerCreate,
    CustomerUpdate,
    CustomerResponse,
    CustomerDetail,
    CustomerListResponse
)
from ..schemas.onboarding import (
    CustomerImportRequest,
    CustomerImportResponse
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/customers", tags=["고객 관리"])


@router.get("", response_model=CustomerListResponse)
async def get_customers(
    query: Optional[str] = Query(None, description="이름 또는 연락처로 검색"),
    sort_by: str = Query("name", description="정렬 기준 (name, created_at, current_balance)"),
    sort_order: str = Query("asc", description="정렬 순서 (asc, desc)"),
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
    if query and query.strip():
        safe_query = query.strip()
        base_query = base_query.or_(f"name.ilike.%{safe_query}%,phone_suffix.ilike.%{safe_query}%")

    # 정렬
    valid_sort_fields = ["name", "created_at", "current_balance"]
    if sort_by not in valid_sort_fields:
        sort_by = "name"
    is_desc = sort_order.lower() == "desc"

    # 페이지네이션
    offset = (page - 1) * page_size
    result = base_query.order(sort_by, desc=is_desc).range(offset, offset + page_size - 1).execute()

    customers = [
        CustomerResponse(
            id=c["id"],
            name=c["name"],
            phone=c.get("phone"),
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
    shop_id: str = Depends(get_current_shop)
):
    """신규 고객 등록"""
    # RLS 우회를 위해 admin 클라이언트 사용
    admin_db = get_supabase_admin_client()

    # 전화번호에서 뒷자리 4자리 추출
    phone_suffix = customer.phone[-4:]

    # 중복 확인 (같은 상점 내 동일 이름 + 연락처)
    existing = admin_db.table("customers").select("id").eq("shop_id", shop_id).eq(
        "name", customer.name
    ).eq("phone_suffix", phone_suffix).execute()

    if existing.data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="이미 등록된 고객입니다"
        )

    # 고객 생성 (RLS 우회를 위해 admin 클라이언트 사용)
    new_customer = {
        "id": str(uuid.uuid4()),
        "shop_id": shop_id,
        "name": customer.name,
        "phone": customer.phone,
        "phone_suffix": phone_suffix,
        "current_balance": 0,
        "created_at": now_seoul_iso()
    }

    admin_db = get_supabase_admin_client()
    admin_db.table("customers").insert(new_customer).execute()

    return CustomerResponse(
        id=new_customer["id"],
        name=new_customer["name"],
        phone=new_customer["phone"],
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
        phone=customer.get("phone"),
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
    shop_id: str = Depends(get_current_shop)
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

    # phone이 변경되면 phone_suffix도 자동 업데이트
    if "phone" in update_data and update_data["phone"]:
        update_data["phone_suffix"] = update_data["phone"][-4:]

    result = admin_db.table("customers").update(update_data).eq("id", customer_id).execute()

    updated = {**existing.data, **update_data}
    return CustomerResponse(
        id=updated["id"],
        name=updated["name"],
        phone=updated.get("phone"),
        phone_suffix=updated["phone_suffix"],
        current_balance=updated["current_balance"],
        created_at=updated["created_at"]
    )


@router.delete("/{customer_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_customer(
    customer_id: str,
    shop_id: str = Depends(get_current_shop)
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


@router.get("/data/template")
async def get_customer_template():
    """고객 데이터 임포트 템플릿 다운로드 (Excel)"""
    wb = Workbook()
    ws = wb.active
    ws.title = "고객 데이터"

    # 헤더
    ws.append(["고객명", "연락처", "잔액"])
    # 예제 데이터
    ws.append(["홍길동", "01012341234", 50000])
    ws.append(["김철수", "01056785678", 30000])
    ws.append(["이영희", "01090129012", 0])

    # 열 너비 조정
    ws.column_dimensions["A"].width = 15
    ws.column_dimensions["B"].width = 15
    ws.column_dimensions["C"].width = 12

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)

    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": "attachment; filename=customer_import_template.xlsx"
        }
    )


@router.get("/data/export")
async def export_customers(
    shop_id: str = Depends(get_current_shop)
):
    """고객 데이터 전체 내보내기 (Excel)"""
    admin_db = get_supabase_admin_client()

    # 모든 고객 조회
    result = admin_db.table("customers").select(
        "name, phone, phone_suffix, current_balance"
    ).eq("shop_id", shop_id).order("name").execute()

    wb = Workbook()
    ws = wb.active
    ws.title = "고객 데이터"

    # 헤더
    ws.append(["고객명", "연락처", "잔액"])

    for customer in result.data or []:
        phone = customer.get("phone") or f"010****{customer['phone_suffix']}"
        ws.append([customer["name"], phone, customer["current_balance"]])

    # 열 너비 조정
    ws.column_dimensions["A"].width = 15
    ws.column_dimensions["B"].width = 15
    ws.column_dimensions["C"].width = 12

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)

    logger.info(f"[CUSTOMERS] 고객 데이터 내보내기 - shop_id: {shop_id[:8]}..., count: {len(result.data or [])}")

    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": "attachment; filename=customers_export.xlsx"
        }
    )


@router.post("/data/import", response_model=CustomerImportResponse)
async def import_customers(
    data: CustomerImportRequest,
    shop_id: str = Depends(get_current_shop)
):
    """고객 데이터 일괄 등록"""
    admin_db = get_supabase_admin_client()

    if not data.customers:
        return CustomerImportResponse(
            total=0,
            imported=0,
            skipped=0,
            errors=[]
        )

    # 기존 고객 조회 (중복 체크용)
    existing_result = admin_db.table("customers").select("name, phone").eq("shop_id", shop_id).execute()
    existing_customers = {(c["name"], c.get("phone", "")) for c in (existing_result.data or [])}

    imported = 0
    skipped = 0
    errors = []
    skipped_details = []
    customers_to_insert = []

    for customer in data.customers:
        phone_suffix = customer.phone[-4:]
        key = (customer.name, customer.phone)

        # 중복 체크
        if key in existing_customers:
            skipped += 1
            skipped_details.append({
                "name": customer.name,
                "phone": customer.phone,
                "reason": "기존 고객과 중복"
            })
            continue

        # 새로 추가할 목록에도 중복 체크
        if key in {(c["name"], c.get("phone", "")) for c in customers_to_insert}:
            skipped += 1
            skipped_details.append({
                "name": customer.name,
                "phone": customer.phone,
                "reason": "파일 내 중복"
            })
            continue

        customers_to_insert.append({
            "shop_id": shop_id,
            "name": customer.name,
            "phone": customer.phone,
            "phone_suffix": phone_suffix,
            "current_balance": customer.balance
        })

    # 일괄 등록
    if customers_to_insert:
        try:
            result = admin_db.table("customers").insert(customers_to_insert).execute()
            imported = len(result.data) if result.data else 0
        except Exception as e:
            logger.error(f"[CUSTOMERS] 고객 일괄 등록 에러: {str(e)}")
            errors.append(f"일괄 등록 중 오류가 발생했습니다: {str(e)}")

    logger.info(f"[CUSTOMERS] 고객 데이터 가져오기 - shop_id: {shop_id[:8]}..., imported: {imported}, skipped: {skipped}")

    return CustomerImportResponse(
        total=len(data.customers),
        imported=imported,
        skipped=skipped,
        errors=errors,
        skipped_details=skipped_details
    )
