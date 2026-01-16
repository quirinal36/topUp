"""
구독 서비스 로직
"""
from datetime import datetime, timedelta
from typing import Optional
import uuid

from ..database import get_supabase_admin_client
from ..config import get_settings
from ..models.subscription import SubscriptionStatus, PaymentStatus
from ..schemas.subscription import SubscriptionResponse, PaymentHistoryResponse

settings = get_settings()


def calculate_days_remaining(end_date: Optional[datetime]) -> Optional[int]:
    """남은 일수 계산"""
    if not end_date:
        return None
    now = datetime.now(end_date.tzinfo) if end_date.tzinfo else datetime.now()
    delta = end_date - now
    return max(0, delta.days)


def is_subscription_active(status: SubscriptionStatus) -> bool:
    """서비스 이용 가능 여부"""
    return status in [SubscriptionStatus.TRIAL, SubscriptionStatus.ACTIVE,
                      SubscriptionStatus.GRACE, SubscriptionStatus.CANCELLED]


def is_subscription_read_only(status: SubscriptionStatus) -> bool:
    """읽기 전용 모드 여부"""
    return status == SubscriptionStatus.SUSPENDED


class SubscriptionService:
    """구독 관리 서비스"""

    def __init__(self):
        self.db = get_supabase_admin_client()

    def get_subscription(self, shop_id: str) -> Optional[SubscriptionResponse]:
        """구독 정보 조회"""
        result = self.db.table("subscriptions").select("*").eq("shop_id", shop_id).maybe_single().execute()

        if not result.data:
            return None

        sub = result.data
        status = SubscriptionStatus(sub["status"])

        # 남은 일수 계산
        days_remaining = None
        if status == SubscriptionStatus.TRIAL and sub.get("trial_ends_at"):
            days_remaining = calculate_days_remaining(datetime.fromisoformat(sub["trial_ends_at"].replace("Z", "+00:00")))
        elif status == SubscriptionStatus.GRACE and sub.get("grace_period_ends_at"):
            days_remaining = calculate_days_remaining(datetime.fromisoformat(sub["grace_period_ends_at"].replace("Z", "+00:00")))

        return SubscriptionResponse(
            id=sub["id"],
            shop_id=sub["shop_id"],
            status=status,
            trial_started_at=sub.get("trial_started_at"),
            trial_ends_at=sub.get("trial_ends_at"),
            current_period_start=sub.get("current_period_start"),
            current_period_end=sub.get("current_period_end"),
            has_billing_key=bool(sub.get("billing_key")),
            monthly_amount=sub.get("monthly_amount", settings.subscription_monthly_price),
            grace_period_ends_at=sub.get("grace_period_ends_at"),
            suspended_at=sub.get("suspended_at"),
            cancelled_at=sub.get("cancelled_at"),
            days_remaining=days_remaining,
            is_active=is_subscription_active(status),
            is_read_only=is_subscription_read_only(status),
            created_at=sub["created_at"]
        )

    def create_trial_subscription(self, shop_id: str) -> SubscriptionResponse:
        """무료 체험 구독 생성"""
        now = datetime.now()
        trial_ends = now + timedelta(days=settings.subscription_trial_days)

        subscription_data = {
            "id": str(uuid.uuid4()),
            "shop_id": shop_id,
            "status": SubscriptionStatus.TRIAL.value,
            "trial_started_at": now.isoformat(),
            "trial_ends_at": trial_ends.isoformat(),
            "monthly_amount": settings.subscription_monthly_price,
            "created_at": now.isoformat(),
            "updated_at": now.isoformat()
        }

        self.db.table("subscriptions").insert(subscription_data).execute()
        return self.get_subscription(shop_id)

    def get_or_create_subscription(self, shop_id: str) -> SubscriptionResponse:
        """구독 조회 또는 생성"""
        subscription = self.get_subscription(shop_id)
        if not subscription:
            subscription = self.create_trial_subscription(shop_id)
        return subscription

    def update_billing_key(self, shop_id: str, billing_key: str) -> bool:
        """빌링키 업데이트"""
        self.db.table("subscriptions").update({
            "billing_key": billing_key,
            "updated_at": datetime.now().isoformat()
        }).eq("shop_id", shop_id).execute()
        return True

    def remove_billing_key(self, shop_id: str) -> bool:
        """빌링키 삭제"""
        self.db.table("subscriptions").update({
            "billing_key": None,
            "updated_at": datetime.now().isoformat()
        }).eq("shop_id", shop_id).execute()
        return True

    def activate_subscription(self, shop_id: str) -> SubscriptionResponse:
        """구독 활성화 (결제 성공 후)"""
        now = datetime.now()
        period_end = now + timedelta(days=30)

        self.db.table("subscriptions").update({
            "status": SubscriptionStatus.ACTIVE.value,
            "current_period_start": now.isoformat(),
            "current_period_end": period_end.isoformat(),
            "grace_period_ends_at": None,
            "suspended_at": None,
            "updated_at": now.isoformat()
        }).eq("shop_id", shop_id).execute()

        return self.get_subscription(shop_id)

    def start_grace_period(self, shop_id: str) -> SubscriptionResponse:
        """유예 기간 시작 (결제 실패 시)"""
        now = datetime.now()
        grace_ends = now + timedelta(days=settings.subscription_grace_days)

        self.db.table("subscriptions").update({
            "status": SubscriptionStatus.GRACE.value,
            "grace_period_ends_at": grace_ends.isoformat(),
            "updated_at": now.isoformat()
        }).eq("shop_id", shop_id).execute()

        return self.get_subscription(shop_id)

    def suspend_subscription(self, shop_id: str) -> SubscriptionResponse:
        """구독 정지 (유예 기간 만료)"""
        now = datetime.now()

        self.db.table("subscriptions").update({
            "status": SubscriptionStatus.SUSPENDED.value,
            "suspended_at": now.isoformat(),
            "updated_at": now.isoformat()
        }).eq("shop_id", shop_id).execute()

        return self.get_subscription(shop_id)

    def cancel_subscription(self, shop_id: str, reason: Optional[str] = None) -> SubscriptionResponse:
        """구독 취소 요청 (다음 결제일까지 사용)"""
        now = datetime.now()

        self.db.table("subscriptions").update({
            "status": SubscriptionStatus.CANCELLED.value,
            "cancelled_at": now.isoformat(),
            "cancel_reason": reason,
            "updated_at": now.isoformat()
        }).eq("shop_id", shop_id).execute()

        return self.get_subscription(shop_id)

    def reactivate_subscription(self, shop_id: str) -> SubscriptionResponse:
        """구독 재활성화 (취소 철회)"""
        now = datetime.now()

        self.db.table("subscriptions").update({
            "status": SubscriptionStatus.ACTIVE.value,
            "cancelled_at": None,
            "cancel_reason": None,
            "updated_at": now.isoformat()
        }).eq("shop_id", shop_id).execute()

        return self.get_subscription(shop_id)

    def check_and_update_status(self, shop_id: str) -> SubscriptionResponse:
        """구독 상태 체크 및 자동 업데이트"""
        subscription = self.get_subscription(shop_id)
        if not subscription:
            return self.create_trial_subscription(shop_id)

        now = datetime.now()

        # 체험 기간 만료 체크
        if subscription.status == SubscriptionStatus.TRIAL:
            if subscription.trial_ends_at and now > subscription.trial_ends_at:
                if subscription.has_billing_key:
                    # 빌링키 있으면 결제 시도 필요 (별도 스케줄러에서 처리)
                    pass
                else:
                    # 빌링키 없으면 정지
                    return self.suspend_subscription(shop_id)

        # 유예 기간 만료 체크
        elif subscription.status == SubscriptionStatus.GRACE:
            if subscription.grace_period_ends_at and now > subscription.grace_period_ends_at:
                return self.suspend_subscription(shop_id)

        # 취소된 구독의 기간 만료 체크
        elif subscription.status == SubscriptionStatus.CANCELLED:
            if subscription.current_period_end and now > subscription.current_period_end:
                return self.suspend_subscription(shop_id)

        return subscription

    # ===== 결제 내역 관리 =====

    def create_payment_record(
        self,
        subscription_id: str,
        shop_id: str,
        amount: int,
        order_id: str
    ) -> str:
        """결제 기록 생성"""
        payment_id = str(uuid.uuid4())
        self.db.table("payment_history").insert({
            "id": payment_id,
            "subscription_id": subscription_id,
            "shop_id": shop_id,
            "amount": amount,
            "order_id": order_id,
            "status": PaymentStatus.PENDING.value,
            "created_at": datetime.now().isoformat()
        }).execute()
        return payment_id

    def update_payment_success(
        self,
        payment_id: str,
        payment_key: str,
        card_company: Optional[str] = None,
        card_number: Optional[str] = None
    ):
        """결제 성공 업데이트"""
        self.db.table("payment_history").update({
            "status": PaymentStatus.SUCCESS.value,
            "payment_key": payment_key,
            "card_company": card_company,
            "card_number": card_number,
            "paid_at": datetime.now().isoformat()
        }).eq("id", payment_id).execute()

    def update_payment_failed(
        self,
        payment_id: str,
        failure_code: str,
        failure_message: str
    ):
        """결제 실패 업데이트"""
        self.db.table("payment_history").update({
            "status": PaymentStatus.FAILED.value,
            "failure_code": failure_code,
            "failure_message": failure_message
        }).eq("id", payment_id).execute()

    def get_payment_history(
        self,
        shop_id: str,
        page: int = 1,
        page_size: int = 10
    ) -> tuple[list[PaymentHistoryResponse], int]:
        """결제 내역 조회"""
        offset = (page - 1) * page_size

        result = self.db.table("payment_history") \
            .select("*", count="exact") \
            .eq("shop_id", shop_id) \
            .order("created_at", desc=True) \
            .range(offset, offset + page_size - 1) \
            .execute()

        payments = [
            PaymentHistoryResponse(
                id=p["id"],
                amount=p["amount"],
                order_id=p["order_id"],
                status=PaymentStatus(p["status"]),
                card_company=p.get("card_company"),
                card_number=p.get("card_number"),
                failure_message=p.get("failure_message"),
                paid_at=p.get("paid_at"),
                created_at=p["created_at"]
            )
            for p in result.data
        ]

        return payments, result.count or 0


# 싱글톤 인스턴스
_subscription_service: Optional[SubscriptionService] = None


def get_subscription_service() -> SubscriptionService:
    """구독 서비스 싱글톤 반환"""
    global _subscription_service
    if _subscription_service is None:
        _subscription_service = SubscriptionService()
    return _subscription_service
