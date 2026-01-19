"""
NICE 본인인증 서비스

개발/테스트용 모킹 서비스와 실제 NICE API 연동 서비스를 제공합니다.
환경변수 NICE_MODE로 전환 가능:
- mock: 모킹 서비스 (기본값, 개발/테스트용)
- production: 실제 NICE API (계약 후 구현)
"""
import secrets
import hashlib
from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Optional, Protocol

from ..config import get_settings


@dataclass
class NiceAuthResult:
    """본인인증 결과"""
    success: bool
    ci: Optional[str] = None  # 연계정보 (Connecting Information)
    name: Optional[str] = None  # 인증된 이름
    error_message: Optional[str] = None


class NiceAuthServiceProtocol(Protocol):
    """NICE 인증 서비스 프로토콜"""

    def start_auth(self, request_id: str) -> dict:
        """
        인증 시작 - 암호화된 요청 데이터 반환

        Args:
            request_id: 요청 고유 ID

        Returns:
            dict: 인증 요청 데이터 (request_id, enc_data 포함)
        """
        ...

    def complete_auth(self, request_id: str, enc_data: str) -> NiceAuthResult:
        """
        인증 완료 - CI 값 추출

        Args:
            request_id: 요청 고유 ID
            enc_data: NICE에서 받은 암호화된 응답 데이터

        Returns:
            NiceAuthResult: 인증 결과 (CI, 이름 등)
        """
        ...


class MockNiceAuthService:
    """
    개발/테스트용 모킹 서비스

    실제 NICE API를 호출하지 않고 항상 성공하는 인증을 시뮬레이션합니다.
    """

    def __init__(self):
        self._pending_requests: dict[str, dict] = {}

    def start_auth(self, request_id: str) -> dict:
        """인증 시작 (모킹)"""
        self._pending_requests[request_id] = {
            "created_at": datetime.utcnow(),
            "status": "pending"
        }
        return {
            "request_id": request_id,
            "enc_data": f"MOCK_ENC_DATA_{request_id}",
            "mock_mode": True
        }

    def complete_auth(self, request_id: str, enc_data: str) -> NiceAuthResult:
        """
        인증 완료 (모킹)

        모킹 모드에서는 항상 성공하며, request_id 기반으로 고유한 CI를 생성합니다.
        동일한 request_id로 여러 번 호출해도 같은 CI가 반환됩니다.
        """
        # request_id 기반으로 결정적(deterministic) CI 생성
        mock_ci = hashlib.sha256(
            f"mock_ci_{request_id}".encode()
        ).hexdigest()

        # 대기 중인 요청 정리
        if request_id in self._pending_requests:
            del self._pending_requests[request_id]

        return NiceAuthResult(
            success=True,
            ci=mock_ci,
            name="테스트사용자",
            error_message=None
        )


class RealNiceAuthService:
    """
    실제 NICE API 연동 서비스

    NICE 평가정보와 계약 후 구현 예정입니다.
    """

    def __init__(self, site_code: str, site_pw: str):
        self.site_code = site_code
        self.site_pw = site_pw

    def start_auth(self, request_id: str) -> dict:
        """인증 시작 - 실제 NICE API 호출"""
        # TODO: 실제 NICE API 구현
        # 1. 요청 번호 생성
        # 2. 요청 데이터 암호화
        # 3. NICE 서버에 인증 요청
        raise NotImplementedError(
            "NICE 본인인증 서비스 계약 후 구현 예정입니다. "
            "현재는 NICE_MODE=mock 으로 설정하여 테스트해주세요."
        )

    def complete_auth(self, request_id: str, enc_data: str) -> NiceAuthResult:
        """인증 완료 - 실제 NICE 응답 파싱"""
        # TODO: 실제 NICE API 구현
        # 1. 암호화된 응답 복호화
        # 2. CI 값 추출
        # 3. 결과 반환
        raise NotImplementedError(
            "NICE 본인인증 서비스 계약 후 구현 예정입니다. "
            "현재는 NICE_MODE=mock 으로 설정하여 테스트해주세요."
        )


# 서비스 인스턴스 캐시
_nice_service_instance: Optional[NiceAuthServiceProtocol] = None


def get_nice_service() -> NiceAuthServiceProtocol:
    """
    환경변수에 따라 적절한 서비스 인스턴스 반환

    Returns:
        NiceAuthServiceProtocol: NICE 인증 서비스 인스턴스
    """
    global _nice_service_instance

    if _nice_service_instance is not None:
        return _nice_service_instance

    settings = get_settings()

    if settings.nice_mode == "production":
        _nice_service_instance = RealNiceAuthService(
            site_code=settings.nice_site_code,
            site_pw=settings.nice_site_pw
        )
    else:
        _nice_service_instance = MockNiceAuthService()

    return _nice_service_instance


def generate_request_id() -> str:
    """안전한 요청 ID 생성"""
    return secrets.token_urlsafe(32)
