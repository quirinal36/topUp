"""
NiceService 유닛 테스트
본인인증 서비스 모킹/실제 모드 검증

실행 방법:
pytest tests/unit_tests/test_nice_service.py -v
"""
# conftest.py에서 환경 변수 설정됨
import pytest
import os
import sys
from unittest.mock import patch

from app.services.nice_service import (
    MockNiceAuthService,
    generate_request_id,
    NiceAuthResult
)


class TestRequestIdGeneration:
    """요청 ID 생성 테스트"""

    def test_generate_request_id_format(self):
        """요청 ID 형식 확인 - URL 안전 base64"""
        request_id = generate_request_id()

        # secrets.token_urlsafe(32) 형식 - 43자 URL-safe base64
        assert request_id is not None
        assert len(request_id) == 43  # 32 bytes → 43 base64 chars
        # URL-safe 문자만 포함 확인
        import re
        assert re.match(r'^[A-Za-z0-9_-]+$', request_id)

    def test_generate_request_id_uniqueness(self):
        """요청 ID 고유성 확인"""
        ids = [generate_request_id() for _ in range(100)]
        unique_ids = set(ids)

        assert len(unique_ids) == 100  # 모두 고유해야 함


class TestMockNiceAuthService:
    """MockNiceAuthService 테스트"""

    def setup_method(self):
        """테스트 셋업"""
        self.service = MockNiceAuthService()

    def test_start_auth_returns_enc_data(self):
        """인증 시작 시 암호화 데이터 반환"""
        request_id = generate_request_id()
        result = self.service.start_auth(request_id)

        assert "request_id" in result
        assert "enc_data" in result
        assert result["request_id"] == request_id
        assert result["mock_mode"] is True

    def test_complete_auth_success(self):
        """인증 완료 성공"""
        request_id = generate_request_id()

        # 먼저 start_auth 호출
        start_result = self.service.start_auth(request_id)
        enc_data = start_result["enc_data"]

        # 완료 처리
        result = self.service.complete_auth(request_id, enc_data)

        assert result.success is True
        assert result.ci is not None
        assert result.name is not None
        assert result.error_message is None

    def test_complete_auth_deterministic_ci(self):
        """같은 request_id로 항상 같은 CI 생성"""
        request_id = generate_request_id()

        # 두 번 인증 시도
        self.service.start_auth(request_id)
        result1 = self.service.complete_auth(request_id, "enc_data")

        # 새 서비스 인스턴스로 다시
        service2 = MockNiceAuthService()
        service2.start_auth(request_id)
        result2 = service2.complete_auth(request_id, "enc_data")

        # 같은 request_id면 같은 CI
        assert result1.ci == result2.ci

    def test_complete_auth_without_start(self):
        """start_auth 없이 complete_auth 호출"""
        result = self.service.complete_auth("unknown_request_id", "enc_data")

        # Mock 서비스는 시작 없이도 처리 가능
        assert result.success is True  # Mock은 항상 성공

    def test_complete_auth_invalid_request_id(self):
        """유효하지 않은 request_id 처리"""
        # 빈 request_id
        result = self.service.complete_auth("", "enc_data")

        # Mock 서비스는 빈 ID도 처리 가능 (실제 서비스와 다름)
        assert result.success is True


class TestNiceAuthResult:
    """NiceAuthResult 데이터클래스 테스트"""

    def test_success_result(self):
        """성공 결과 생성"""
        result = NiceAuthResult(
            success=True,
            ci="test-ci-12345",
            name="홍길동"
        )

        assert result.success is True
        assert result.ci == "test-ci-12345"
        assert result.name == "홍길동"
        assert result.error_message is None

    def test_failure_result(self):
        """실패 결과 생성"""
        result = NiceAuthResult(
            success=False,
            error_message="인증 시간이 초과되었습니다"
        )

        assert result.success is False
        assert result.ci is None
        assert result.name is None
        assert result.error_message == "인증 시간이 초과되었습니다"


class TestServiceFactory:
    """서비스 팩토리 테스트"""

    def test_get_mock_service_when_mock_mode(self):
        """MOCK 모드일 때 MockNiceAuthService 반환"""
        with patch.dict(os.environ, {"NICE_MODE": "MOCK"}):
            from importlib import reload
            import app.services.nice_service as nice_module
            reload(nice_module)

            service = nice_module.get_nice_service()
            assert isinstance(service, nice_module.MockNiceAuthService)

    def test_get_mock_service_when_no_env(self):
        """환경 변수 없을 때 MockNiceAuthService 반환 (기본값)"""
        with patch.dict(os.environ, {}, clear=True):
            # NICE_MODE 환경 변수 제거
            os.environ.pop("NICE_MODE", None)
            os.environ.pop("NICE_SITE_CODE", None)
            os.environ.pop("NICE_SITE_PW", None)

            from importlib import reload
            import app.services.nice_service as nice_module
            reload(nice_module)

            service = nice_module.get_nice_service()
            # 설정 없으면 Mock 반환
            assert isinstance(service, nice_module.MockNiceAuthService)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
