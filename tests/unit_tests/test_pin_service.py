"""
PinService 유닛 테스트
PIN 해싱 기능 검증 (DB 의존 테스트는 통합 테스트로 분리)

실행 방법:
pytest tests/unit_tests/test_pin_service.py -v
"""
# conftest.py에서 환경 변수 설정됨
import pytest
import os
import sys
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, AsyncMock, patch

from app.services.pin_service import PinService


class TestPinHashing:
    """PIN 해싱 테스트"""

    def setup_method(self):
        """테스트 셋업"""
        mock_db = MagicMock()
        self.service = PinService(mock_db)

    def test_hash_pin_creates_hash(self):
        """PIN 해싱이 올바르게 생성되는지 확인"""
        pin = "1234"
        hashed = self.service.hash_pin(pin)

        assert hashed is not None
        assert hashed != pin
        assert hashed.startswith("$2b$")  # bcrypt prefix

    def test_hash_pin_different_salts(self):
        """같은 PIN이라도 다른 해시가 생성됨"""
        pin = "1234"
        hash1 = self.service.hash_pin(pin)
        hash2 = self.service.hash_pin(pin)

        assert hash1 != hash2  # 솔트가 다르므로 해시도 다름

    def test_verify_pin_hash_correct(self):
        """올바른 PIN 검증"""
        pin = "1234"
        hashed = self.service.hash_pin(pin)

        assert self.service.verify_pin_hash(pin, hashed) is True

    def test_verify_pin_hash_incorrect(self):
        """틀린 PIN 검증"""
        pin = "1234"
        hashed = self.service.hash_pin(pin)

        assert self.service.verify_pin_hash("5678", hashed) is False

    def test_verify_pin_hash_empty(self):
        """빈 PIN 처리"""
        hashed = self.service.hash_pin("1234")

        assert self.service.verify_pin_hash("", hashed) is False

    def test_verify_pin_hash_invalid_format(self):
        """잘못된 형식의 해시 처리"""
        # bcrypt 형식이 아닌 경우
        result = self.service.verify_pin_hash("1234", "not-a-valid-hash")

        assert result is False


class TestPinConstants:
    """PIN 서비스 상수 테스트"""

    def test_max_failed_attempts(self):
        """최대 실패 횟수 상수 확인"""
        from app.services.pin_service import MAX_FAILED_ATTEMPTS
        assert MAX_FAILED_ATTEMPTS == 5

    def test_lock_duration(self):
        """잠금 시간 상수 확인"""
        from app.services.pin_service import LOCK_DURATION_MINUTES
        assert LOCK_DURATION_MINUTES == 1


class TestPinServiceInstantiation:
    """PinService 인스턴스화 테스트"""

    def test_service_creation(self):
        """서비스 생성 확인"""
        mock_db = MagicMock()
        service = PinService(mock_db)

        assert service is not None
        assert service.db == mock_db


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
