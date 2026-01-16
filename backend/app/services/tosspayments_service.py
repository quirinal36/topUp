"""
토스페이먼츠 API 연동 서비스
"""
import httpx
import base64
from typing import Optional
from dataclasses import dataclass

from ..config import get_settings

settings = get_settings()

TOSS_API_URL = "https://api.tosspayments.com/v1"


@dataclass
class BillingKeyResult:
    """빌링키 발급 결과"""
    success: bool
    billing_key: Optional[str] = None
    card_company: Optional[str] = None
    card_number: Optional[str] = None
    error_code: Optional[str] = None
    error_message: Optional[str] = None


@dataclass
class PaymentResult:
    """결제 결과"""
    success: bool
    payment_key: Optional[str] = None
    card_company: Optional[str] = None
    card_number: Optional[str] = None
    error_code: Optional[str] = None
    error_message: Optional[str] = None


class TossPaymentsService:
    """토스페이먼츠 API 서비스"""

    def __init__(self):
        self.secret_key = settings.toss_secret_key
        self.client_key = settings.toss_client_key

    def _get_auth_header(self) -> dict:
        """Basic Auth 헤더 생성"""
        credentials = f"{self.secret_key}:"
        encoded = base64.b64encode(credentials.encode()).decode()
        return {
            "Authorization": f"Basic {encoded}",
            "Content-Type": "application/json"
        }

    async def issue_billing_key(
        self,
        auth_key: str,
        customer_key: str
    ) -> BillingKeyResult:
        """
        빌링키 발급
        - 프론트에서 카드 정보 입력 후 받은 authKey로 빌링키 발급
        """
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    f"{TOSS_API_URL}/billing/authorizations/issue",
                    headers=self._get_auth_header(),
                    json={
                        "authKey": auth_key,
                        "customerKey": customer_key
                    }
                )

                if response.status_code == 200:
                    data = response.json()
                    return BillingKeyResult(
                        success=True,
                        billing_key=data.get("billingKey"),
                        card_company=data.get("card", {}).get("issuerCode"),
                        card_number=data.get("card", {}).get("number")
                    )
                else:
                    error = response.json()
                    return BillingKeyResult(
                        success=False,
                        error_code=error.get("code"),
                        error_message=error.get("message")
                    )

            except Exception as e:
                return BillingKeyResult(
                    success=False,
                    error_code="NETWORK_ERROR",
                    error_message=str(e)
                )

    async def charge_billing(
        self,
        billing_key: str,
        customer_key: str,
        amount: int,
        order_id: str,
        order_name: str = "카페 선결제 관리 서비스 구독"
    ) -> PaymentResult:
        """
        빌링키로 자동 결제
        """
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    f"{TOSS_API_URL}/billing/{billing_key}",
                    headers=self._get_auth_header(),
                    json={
                        "customerKey": customer_key,
                        "amount": amount,
                        "orderId": order_id,
                        "orderName": order_name
                    }
                )

                if response.status_code == 200:
                    data = response.json()
                    return PaymentResult(
                        success=True,
                        payment_key=data.get("paymentKey"),
                        card_company=data.get("card", {}).get("issuerCode"),
                        card_number=data.get("card", {}).get("number")
                    )
                else:
                    error = response.json()
                    return PaymentResult(
                        success=False,
                        error_code=error.get("code"),
                        error_message=error.get("message")
                    )

            except Exception as e:
                return PaymentResult(
                    success=False,
                    error_code="NETWORK_ERROR",
                    error_message=str(e)
                )

    async def cancel_payment(
        self,
        payment_key: str,
        cancel_reason: str = "고객 요청"
    ) -> bool:
        """결제 취소"""
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    f"{TOSS_API_URL}/payments/{payment_key}/cancel",
                    headers=self._get_auth_header(),
                    json={
                        "cancelReason": cancel_reason
                    }
                )
                return response.status_code == 200

            except Exception:
                return False

    async def get_payment(self, payment_key: str) -> Optional[dict]:
        """결제 정보 조회"""
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(
                    f"{TOSS_API_URL}/payments/{payment_key}",
                    headers=self._get_auth_header()
                )

                if response.status_code == 200:
                    return response.json()
                return None

            except Exception:
                return None


# 싱글톤 인스턴스
_toss_service: Optional[TossPaymentsService] = None


def get_toss_service() -> TossPaymentsService:
    """토스페이먼츠 서비스 싱글톤 반환"""
    global _toss_service
    if _toss_service is None:
        _toss_service = TossPaymentsService()
    return _toss_service
