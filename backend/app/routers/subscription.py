"""
구독 관리 API 라우터
"""
from fastapi import APIRouter, Depends, HTTPException, status
from typing import Optional
import uuid
from datetime import datetime

from ..routers.auth import get_current_shop
from ..services.subscription_service import get_subscription_service
from ..services.tosspayments_service import get_toss_service
from ..services.notification_service import get_notification_service
from ..database import get_supabase_admin_client
from ..config import get_settings
from ..schemas.subscription import (
    SubscriptionResponse,
    RegisterBillingKeyRequest,
    BillingKeyResponse,
    CancelSubscriptionRequest,
    SubscriptionActionResponse,
    PaymentHistoryListResponse,
    UpdatePhoneRequest
)

router = APIRouter(prefix="/api/subscription", tags=["구독 관리"])
settings = get_settings()


@router.get("", response_model=SubscriptionResponse)
async def get_subscription(shop_id: str = Depends(get_current_shop)):
    """현재 구독 정보 조회"""
    service = get_subscription_service()
    subscription = service.get_or_create_subscription(shop_id)

    # 상태 체크 및 자동 업데이트
    subscription = service.check_and_update_status(shop_id)

    return subscription


@router.post("/billing-key", response_model=BillingKeyResponse)
async def register_billing_key(
    request: RegisterBillingKeyRequest,
    shop_id: str = Depends(get_current_shop)
):
    """빌링키 등록 (카드 등록)"""
    toss_service = get_toss_service()
    sub_service = get_subscription_service()

    # 구독 조회/생성
    subscription = sub_service.get_or_create_subscription(shop_id)

    # 토스페이먼츠에서 빌링키 발급
    result = await toss_service.issue_billing_key(
        auth_key=request.auth_key,
        customer_key=request.customer_key
    )

    if not result.success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result.error_message or "빌링키 발급에 실패했습니다"
        )

    # 빌링키 저장
    sub_service.update_billing_key(shop_id, result.billing_key)

    return BillingKeyResponse(
        success=True,
        card_company=result.card_company,
        card_number=result.card_number,
        message="카드가 등록되었습니다"
    )


@router.delete("/billing-key", response_model=SubscriptionActionResponse)
async def remove_billing_key(shop_id: str = Depends(get_current_shop)):
    """빌링키 삭제 (카드 삭제)"""
    service = get_subscription_service()
    subscription = service.get_subscription(shop_id)

    if not subscription:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="구독 정보를 찾을 수 없습니다"
        )

    service.remove_billing_key(shop_id)
    updated = service.get_subscription(shop_id)

    return SubscriptionActionResponse(
        success=True,
        message="카드가 삭제되었습니다",
        subscription=updated
    )


@router.post("/subscribe", response_model=SubscriptionActionResponse)
async def subscribe(shop_id: str = Depends(get_current_shop)):
    """구독 시작 (빌링키로 첫 결제)"""
    sub_service = get_subscription_service()
    toss_service = get_toss_service()

    subscription = sub_service.get_subscription(shop_id)
    if not subscription:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="구독 정보를 찾을 수 없습니다"
        )

    if not subscription.has_billing_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="등록된 결제 수단이 없습니다"
        )

    # 빌링키 조회
    db = get_supabase_admin_client()
    sub_data = db.table("subscriptions").select("billing_key").eq("shop_id", shop_id).single().execute()
    billing_key = sub_data.data.get("billing_key")

    # 주문번호 생성
    order_id = f"SUB_{shop_id[:8]}_{datetime.now().strftime('%Y%m%d%H%M%S')}"

    # 결제 기록 생성
    payment_id = sub_service.create_payment_record(
        subscription_id=subscription.id,
        shop_id=shop_id,
        amount=subscription.monthly_amount,
        order_id=order_id
    )

    # 결제 실행
    result = await toss_service.charge_billing(
        billing_key=billing_key,
        customer_key=shop_id,
        amount=subscription.monthly_amount,
        order_id=order_id
    )

    if result.success:
        # 결제 성공
        sub_service.update_payment_success(
            payment_id=payment_id,
            payment_key=result.payment_key,
            card_company=result.card_company,
            card_number=result.card_number
        )

        # 구독 활성화
        updated = sub_service.activate_subscription(shop_id)

        # 알림 발송
        notification_service = get_notification_service()
        shop = db.table("shops").select("name, phone").eq("id", shop_id).single().execute()
        if shop.data.get("phone"):
            next_date = updated.current_period_end.strftime("%Y년 %m월 %d일") if updated.current_period_end else ""
            await notification_service.send_payment_success_notification(
                phone=shop.data["phone"],
                shop_name=shop.data.get("name", "고객"),
                amount=subscription.monthly_amount,
                next_payment_date=next_date
            )

        return SubscriptionActionResponse(
            success=True,
            message="구독이 시작되었습니다",
            subscription=updated
        )
    else:
        # 결제 실패
        sub_service.update_payment_failed(
            payment_id=payment_id,
            failure_code=result.error_code or "UNKNOWN",
            failure_message=result.error_message or "결제에 실패했습니다"
        )

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result.error_message or "결제에 실패했습니다"
        )


@router.post("/cancel", response_model=SubscriptionActionResponse)
async def cancel_subscription(
    request: CancelSubscriptionRequest,
    shop_id: str = Depends(get_current_shop)
):
    """구독 취소 (다음 결제일까지 사용)"""
    service = get_subscription_service()
    subscription = service.get_subscription(shop_id)

    if not subscription:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="구독 정보를 찾을 수 없습니다"
        )

    if subscription.status not in ["ACTIVE", "GRACE"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="취소할 수 있는 구독 상태가 아닙니다"
        )

    updated = service.cancel_subscription(shop_id, request.reason)

    return SubscriptionActionResponse(
        success=True,
        message="구독이 취소되었습니다. 현재 결제 기간까지 서비스를 이용할 수 있습니다.",
        subscription=updated
    )


@router.post("/reactivate", response_model=SubscriptionActionResponse)
async def reactivate_subscription(shop_id: str = Depends(get_current_shop)):
    """구독 취소 철회"""
    service = get_subscription_service()
    subscription = service.get_subscription(shop_id)

    if not subscription:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="구독 정보를 찾을 수 없습니다"
        )

    if subscription.status != "CANCELLED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="취소된 구독만 재활성화할 수 있습니다"
        )

    updated = service.reactivate_subscription(shop_id)

    return SubscriptionActionResponse(
        success=True,
        message="구독이 재활성화되었습니다",
        subscription=updated
    )


@router.get("/payments", response_model=PaymentHistoryListResponse)
async def get_payment_history(
    page: int = 1,
    page_size: int = 10,
    shop_id: str = Depends(get_current_shop)
):
    """결제 내역 조회"""
    service = get_subscription_service()
    payments, total = service.get_payment_history(shop_id, page, page_size)

    return PaymentHistoryListResponse(
        payments=payments,
        total=total
    )


@router.put("/phone", response_model=dict)
async def update_notification_phone(
    request: UpdatePhoneRequest,
    shop_id: str = Depends(get_current_shop)
):
    """알림 연락처 업데이트"""
    db = get_supabase_admin_client()
    db.table("shops").update({
        "phone": request.phone,
        "updated_at": datetime.now().isoformat()
    }).eq("id", shop_id).execute()

    return {"success": True, "message": "연락처가 저장되었습니다"}


@router.get("/config", response_model=dict)
async def get_subscription_config():
    """구독 설정 정보 (공개)"""
    return {
        "monthly_price": settings.subscription_monthly_price,
        "trial_days": settings.subscription_trial_days,
        "grace_days": settings.subscription_grace_days,
        "toss_client_key": settings.toss_client_key
    }
