"""
알림 서비스 (Solapi 문자/알림톡)
"""
import httpx
import hmac
import hashlib
import time
import uuid
from typing import Optional
from datetime import datetime

from ..config import get_settings

settings = get_settings()

SOLAPI_URL = "https://api.solapi.com"


class NotificationService:
    """Solapi 알림 서비스"""

    def __init__(self):
        self.api_key = settings.solapi_api_key
        self.api_secret = settings.solapi_api_secret
        self.sender_phone = settings.solapi_sender_phone

    def _get_auth_header(self) -> dict:
        """Solapi 인증 헤더 생성"""
        date = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
        salt = str(uuid.uuid4())
        signature = hmac.new(
            self.api_secret.encode(),
            (date + salt).encode(),
            hashlib.sha256
        ).hexdigest()

        return {
            "Authorization": f"HMAC-SHA256 apiKey={self.api_key}, date={date}, salt={salt}, signature={signature}",
            "Content-Type": "application/json"
        }

    async def send_sms(
        self,
        to: str,
        text: str
    ) -> bool:
        """SMS 발송"""
        if not self.api_key or not self.sender_phone:
            print(f"[알림] SMS 설정 없음. 메시지: {text}")
            return False

        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    f"{SOLAPI_URL}/messages/v4/send",
                    headers=self._get_auth_header(),
                    json={
                        "message": {
                            "to": to,
                            "from": self.sender_phone,
                            "text": text
                        }
                    }
                )
                return response.status_code == 200

            except Exception as e:
                print(f"SMS 발송 실패: {e}")
                return False

    async def send_payment_failed_notification(
        self,
        phone: str,
        shop_name: str,
        grace_days: int = 7
    ) -> bool:
        """결제 실패 알림"""
        message = f"""[카페 선결제 관리]
{shop_name}님, 이번 달 구독 결제가 실패했습니다.

{grace_days}일 이내에 결제 수단을 확인해 주세요.
유예 기간 후에는 서비스 이용이 제한됩니다.

설정 > 구독 관리에서 결제 수단을 변경할 수 있습니다."""

        return await self.send_sms(phone, message)

    async def send_subscription_expiring_notification(
        self,
        phone: str,
        shop_name: str,
        days_remaining: int
    ) -> bool:
        """구독 만료 임박 알림"""
        message = f"""[카페 선결제 관리]
{shop_name}님, 무료 체험 기간이 {days_remaining}일 남았습니다.

결제 수단을 등록하시면 서비스를 계속 이용할 수 있습니다.

설정 > 구독 관리에서 결제 수단을 등록해 주세요."""

        return await self.send_sms(phone, message)

    async def send_subscription_suspended_notification(
        self,
        phone: str,
        shop_name: str
    ) -> bool:
        """구독 정지 알림"""
        message = f"""[카페 선결제 관리]
{shop_name}님, 구독이 정지되었습니다.

현재 데이터 조회만 가능하며, 새로운 충전/차감이 제한됩니다.

설정 > 구독 관리에서 결제하시면 바로 서비스를 이용할 수 있습니다."""

        return await self.send_sms(phone, message)

    async def send_payment_success_notification(
        self,
        phone: str,
        shop_name: str,
        amount: int,
        next_payment_date: str
    ) -> bool:
        """결제 성공 알림"""
        message = f"""[카페 선결제 관리]
{shop_name}님, 구독 결제가 완료되었습니다.

결제 금액: {amount:,}원
다음 결제일: {next_payment_date}

감사합니다."""

        return await self.send_sms(phone, message)


# 싱글톤 인스턴스
_notification_service: Optional[NotificationService] = None


def get_notification_service() -> NotificationService:
    """알림 서비스 싱글톤 반환"""
    global _notification_service
    if _notification_service is None:
        _notification_service = NotificationService()
    return _notification_service
