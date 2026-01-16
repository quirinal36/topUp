"""
구독 상태 체크 의존성
"""
from fastapi import Depends, HTTPException, status
from ..routers.auth import get_current_shop
from ..services.subscription_service import get_subscription_service
from ..models.subscription import SubscriptionStatus


async def require_active_subscription(shop_id: str = Depends(get_current_shop)) -> str:
    """
    활성 구독 필수 의존성
    - TRIAL, ACTIVE, GRACE, CANCELLED 상태에서만 통과
    - SUSPENDED 상태에서는 403 에러
    """
    service = get_subscription_service()
    subscription = service.get_or_create_subscription(shop_id)

    # 상태 체크 및 자동 업데이트
    subscription = service.check_and_update_status(shop_id)

    if subscription.status == SubscriptionStatus.SUSPENDED:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="구독이 정지되었습니다. 결제 후 이용해 주세요."
        )

    return shop_id


async def check_subscription_status(shop_id: str = Depends(get_current_shop)) -> dict:
    """
    구독 상태 체크 의존성 (정보 반환용)
    - 차단하지 않고 상태만 반환
    """
    service = get_subscription_service()
    subscription = service.get_or_create_subscription(shop_id)
    subscription = service.check_and_update_status(shop_id)

    return {
        "shop_id": shop_id,
        "subscription_status": subscription.status,
        "is_active": subscription.is_active,
        "is_read_only": subscription.is_read_only
    }
