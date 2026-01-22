"""
온보딩 API 라우터
회원가입 후 3단계 온보딩 프로세스 처리
"""
import logging
import io
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse

from ..database import get_supabase_admin_client
from ..utils import now_seoul_iso
from ..routers.auth import get_current_shop
from ..schemas.onboarding import (
    ShopOnboardingStep1,
    ShopOnboardingStep2,
    CustomerImportRequest,
    CustomerImportResponse,
    OnboardingStatusResponse,
    BusinessNumberVerifyRequest,
    BusinessNumberVerifyResponse,
    BusinessNumberCheckDuplicateResponse,
)
from ..services.business_verification_service import (
    verify_business_number,
    validate_business_number_format,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/onboarding", tags=["온보딩"])


@router.post("/verify-business-number", response_model=BusinessNumberVerifyResponse)
async def verify_business_number_endpoint(
    data: BusinessNumberVerifyRequest,
):
    """사업자등록번호 유효성 검증 (국세청 API)"""
    import re
    digits = re.sub(r'[^0-9]', '', data.business_number)

    if len(digits) != 10:
        return BusinessNumberVerifyResponse(
            is_valid=False,
            status_code="",
            status_name="",
            tax_type="",
            message="사업자등록번호는 10자리 숫자여야 합니다"
        )

    result = await verify_business_number(digits)

    return BusinessNumberVerifyResponse(
        is_valid=result.is_valid,
        status_code=result.status_code,
        status_name=result.status_name,
        tax_type=result.tax_type,
        message=result.message
    )


@router.get("/check-business-number/{business_number}", response_model=BusinessNumberCheckDuplicateResponse)
async def check_business_number_duplicate(
    business_number: str,
    shop_id: str = Depends(get_current_shop)
):
    """사업자등록번호 중복 확인 (현재 상점 제외)"""
    import re
    admin_db = get_supabase_admin_client()

    # 숫자만 추출하고 포맷팅
    digits = re.sub(r'[^0-9]', '', business_number)

    if len(digits) != 10:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="사업자등록번호는 10자리 숫자여야 합니다"
        )

    # xxx-xx-xxxxx 포맷
    formatted = f"{digits[:3]}-{digits[3:5]}-{digits[5:]}"

    # 중복 확인 (현재 상점 제외) - username과 name도 조회
    result = admin_db.table("shops").select("id, username, name").eq(
        "business_number", formatted
    ).neq("id", shop_id).maybe_single().execute()

    # result가 None이거나 data가 None인 경우 처리
    is_duplicate = result is not None and result.data is not None

    if is_duplicate:
        shop_data = result.data
        username = shop_data.get("username", "")
        shop_name = shop_data.get("name", "")

        # 사용자명 마스킹 (앞 2자리 제외 나머지 *)
        masked_username = ""
        if username and len(username) > 2:
            masked_username = username[:2] + "*" * (len(username) - 2)
        elif username:
            masked_username = username[0] + "*" * (len(username) - 1) if len(username) > 0 else ""

        return BusinessNumberCheckDuplicateResponse(
            is_duplicate=True,
            message="이미 등록된 사업자등록번호입니다. 로그인하거나 비밀번호를 찾아주세요.",
            existing_username=masked_username,
            existing_shop_name=shop_name
        )

    return BusinessNumberCheckDuplicateResponse(
        is_duplicate=False,
        message="사용 가능한 사업자등록번호입니다",
        existing_username=None,
        existing_shop_name=None
    )


@router.get("/status", response_model=OnboardingStatusResponse)
async def get_onboarding_status(
    shop_id: str = Depends(get_current_shop)
):
    """온보딩 상태 조회"""
    admin_db = get_supabase_admin_client()

    # 상점 정보 조회
    shop_result = admin_db.table("shops").select(
        "name, business_number, onboarding_completed"
    ).eq("id", shop_id).maybe_single().execute()

    if not shop_result or not shop_result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="상점 정보를 찾을 수 없습니다"
        )

    shop = shop_result.data

    # 메뉴 수 조회
    menu_result = admin_db.table("menus").select("id", count="exact").eq("shop_id", shop_id).execute()
    menu_count = menu_result.count or 0

    # 고객 수 조회
    customer_result = admin_db.table("customers").select("id", count="exact").eq("shop_id", shop_id).execute()
    customer_count = customer_result.count or 0

    return OnboardingStatusResponse(
        completed=shop.get("onboarding_completed", False),
        shop_name=shop["name"],
        business_number=shop.get("business_number"),
        menu_count=menu_count,
        customer_count=customer_count
    )


@router.put("/step1")
async def complete_step1(
    data: ShopOnboardingStep1,
    shop_id: str = Depends(get_current_shop)
):
    """Step 1: 상점 기본 정보 저장"""
    import re
    admin_db = get_supabase_admin_client()

    # 사업자등록번호 중복 확인
    duplicate_check = admin_db.table("shops").select("id").eq(
        "business_number", data.business_number
    ).neq("id", shop_id).maybe_single().execute()

    # duplicate_check가 None이거나 data가 None이 아닌 경우 중복
    if duplicate_check is not None and duplicate_check.data is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="이미 등록된 사업자등록번호입니다"
        )

    update_data = {
        "name": data.name,
        "business_number": data.business_number,
        "updated_at": now_seoul_iso()
    }

    result = admin_db.table("shops").update(update_data).eq("id", shop_id).execute()

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="상점 정보 저장에 실패했습니다"
        )

    logger.info(f"[ONBOARDING] Step 1 완료 - shop_id: {shop_id[:8]}..., business_number: {data.business_number[:7]}***")

    return {"message": "상점 정보가 저장되었습니다"}


@router.put("/step2")
async def complete_step2(
    data: ShopOnboardingStep2,
    shop_id: str = Depends(get_current_shop)
):
    """Step 2: 메뉴 일괄 등록"""
    admin_db = get_supabase_admin_client()

    if not data.menus:
        logger.info(f"[ONBOARDING] Step 2 건너뜀 (메뉴 없음) - shop_id: {shop_id[:8]}...")
        return {"message": "메뉴 등록을 건너뛰었습니다", "count": 0}

    # 기존 메뉴 삭제 (온보딩 중 재시도 시 중복 방지)
    admin_db.table("menus").delete().eq("shop_id", shop_id).execute()

    # 메뉴 일괄 등록
    menu_records = [
        {
            "shop_id": shop_id,
            "name": menu.name,
            "price": menu.price,
            "is_active": True,
            "display_order": index
        }
        for index, menu in enumerate(data.menus)
    ]

    result = admin_db.table("menus").insert(menu_records).execute()

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="메뉴 등록에 실패했습니다"
        )

    logger.info(f"[ONBOARDING] Step 2 완료 - shop_id: {shop_id[:8]}..., menu_count: {len(data.menus)}")

    return {"message": f"{len(data.menus)}개의 메뉴가 등록되었습니다", "count": len(data.menus)}


@router.post("/step3/import", response_model=CustomerImportResponse)
async def import_customers(
    data: CustomerImportRequest,
    shop_id: str = Depends(get_current_shop)
):
    """Step 3: 고객 일괄 등록"""
    admin_db = get_supabase_admin_client()

    if not data.customers:
        logger.info(f"[ONBOARDING] Step 3 건너뜀 (고객 없음) - shop_id: {shop_id[:8]}...")
        return CustomerImportResponse(
            total=0,
            imported=0,
            skipped=0,
            errors=[]
        )

    # 기존 고객 조회 (중복 체크용)
    existing_result = admin_db.table("customers").select("name, phone_suffix").eq("shop_id", shop_id).execute()
    existing_customers = {(c["name"], c["phone_suffix"]) for c in (existing_result.data or [])}

    imported = 0
    skipped = 0
    errors = []
    customers_to_insert = []

    for index, customer in enumerate(data.customers):
        key = (customer.name, customer.phone_suffix)

        # 중복 체크
        if key in existing_customers:
            skipped += 1
            continue

        # 새로 추가할 목록에도 중복 체크
        if key in {(c["name"], c["phone_suffix"]) for c in customers_to_insert}:
            skipped += 1
            continue

        customers_to_insert.append({
            "shop_id": shop_id,
            "name": customer.name,
            "phone_suffix": customer.phone_suffix,
            "current_balance": customer.balance
        })

    # 일괄 등록
    if customers_to_insert:
        try:
            result = admin_db.table("customers").insert(customers_to_insert).execute()
            imported = len(result.data) if result.data else 0
        except Exception as e:
            logger.error(f"[ONBOARDING] 고객 일괄 등록 에러: {str(e)}")
            errors.append(f"일괄 등록 중 오류가 발생했습니다: {str(e)}")

    logger.info(f"[ONBOARDING] Step 3 완료 - shop_id: {shop_id[:8]}..., imported: {imported}, skipped: {skipped}")

    return CustomerImportResponse(
        total=len(data.customers),
        imported=imported,
        skipped=skipped,
        errors=errors
    )


@router.post("/complete")
async def complete_onboarding(
    shop_id: str = Depends(get_current_shop)
):
    """온보딩 완료 처리"""
    admin_db = get_supabase_admin_client()

    result = admin_db.table("shops").update({
        "onboarding_completed": True,
        "updated_at": now_seoul_iso()
    }).eq("id", shop_id).execute()

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="온보딩 완료 처리에 실패했습니다"
        )

    logger.info(f"[ONBOARDING] 온보딩 완료 - shop_id: {shop_id[:8]}...")

    return {"message": "온보딩이 완료되었습니다"}


@router.get("/template")
async def get_import_template():
    """고객 데이터 임포트 템플릿 다운로드 (CSV)"""
    # CSV 템플릿 생성
    csv_content = "고객명,연락처뒷자리,잔액\n"
    csv_content += "홍길동,1234,50000\n"
    csv_content += "김철수,5678,30000\n"
    csv_content += "이영희,9012,0\n"

    # UTF-8 BOM 추가 (Excel에서 한글 인식을 위해)
    csv_bytes = ('\ufeff' + csv_content).encode('utf-8')

    return StreamingResponse(
        io.BytesIO(csv_bytes),
        media_type="text/csv",
        headers={
            "Content-Disposition": "attachment; filename=customer_import_template.csv"
        }
    )
