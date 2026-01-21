"""
AuthService 유닛 테스트
인증, JWT 토큰, 비밀번호 해싱 등 핵심 기능 검증

실행 방법:
pytest tests/unit_tests/test_auth_service.py -v
"""
# conftest.py에서 환경 변수 설정됨
import pytest
import jwt
import os
import sys
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, AsyncMock, patch

from app.services.auth_service import AuthService


class TestPasswordHashing:
    """비밀번호 해싱 테스트"""

    def setup_method(self):
        """테스트 셋업"""
        mock_db = MagicMock()
        self.service = AuthService(mock_db)

    def test_hash_password_creates_hash(self):
        """해싱이 올바르게 생성되는지 확인"""
        password = "testpassword123"
        hash1 = self.service.hash_password(password)

        assert hash1 is not None
        assert hash1 != password
        assert hash1.startswith("$2b$")  # bcrypt prefix

    def test_hash_password_different_salts(self):
        """같은 비밀번호라도 다른 해시가 생성됨"""
        password = "testpassword123"
        hash1 = self.service.hash_password(password)
        hash2 = self.service.hash_password(password)

        assert hash1 != hash2  # 솔트가 다르므로 해시도 다름

    def test_verify_password_correct(self):
        """올바른 비밀번호 검증"""
        password = "testpassword123"
        hashed = self.service.hash_password(password)

        assert self.service.verify_password(password, hashed) is True

    def test_verify_password_incorrect(self):
        """틀린 비밀번호 검증"""
        password = "testpassword123"
        hashed = self.service.hash_password(password)

        assert self.service.verify_password("wrongpassword", hashed) is False

    def test_verify_password_empty(self):
        """빈 비밀번호 처리"""
        hashed = self.service.hash_password("somepassword")

        assert self.service.verify_password("", hashed) is False


class TestJWTToken:
    """JWT 토큰 테스트"""

    def setup_method(self):
        """테스트 셋업"""
        mock_db = MagicMock()
        # 블랙리스트 조회 - 빈 결과 반환 (블랙리스트에 없음)
        mock_db.table.return_value.select.return_value.eq.return_value.execute.return_value = MagicMock(data=[])
        self.service = AuthService(mock_db)

    def test_create_access_token(self):
        """액세스 토큰 생성"""
        shop_id = "test-shop-id-123"
        token, jti = self.service.create_access_token(shop_id)

        assert token is not None
        assert jti is not None
        assert len(token.split('.')) == 3  # JWT 형식 (header.payload.signature)

    def test_verify_access_token(self):
        """액세스 토큰 검증"""
        shop_id = "test-shop-id-123"
        token, _ = self.service.create_access_token(shop_id)

        verified_shop_id = self.service.verify_token(token, "access")

        assert verified_shop_id == shop_id

    def test_create_refresh_token(self):
        """리프레시 토큰 생성"""
        shop_id = "test-shop-id-123"
        token, jti = self.service.create_refresh_token(shop_id)

        assert token is not None
        assert jti is not None

    def test_verify_refresh_token(self):
        """리프레시 토큰 검증"""
        shop_id = "test-shop-id-123"
        token, _ = self.service.create_refresh_token(shop_id)

        verified_shop_id = self.service.verify_token(token, "refresh")

        assert verified_shop_id == shop_id

    def test_verify_wrong_token_type(self):
        """잘못된 토큰 타입 검증"""
        shop_id = "test-shop-id-123"
        access_token, _ = self.service.create_access_token(shop_id)

        # 액세스 토큰을 리프레시 토큰으로 검증 시도
        result = self.service.verify_token(access_token, "refresh")

        assert result is None

    def test_verify_invalid_token(self):
        """유효하지 않은 토큰 검증"""
        result = self.service.verify_token("invalid.token.here", "access")

        assert result is None

    def test_verify_expired_token(self):
        """만료된 토큰 검증"""
        shop_id = "test-shop-id-123"

        # 만료된 토큰 직접 생성
        from app.config import get_settings
        settings = get_settings()

        expired_payload = {
            "sub": shop_id,
            "type": "access",
            "jti": "test-jti",
            "exp": datetime.now(timezone.utc) - timedelta(hours=1),  # 1시간 전 만료
            "iat": datetime.now(timezone.utc) - timedelta(hours=2)
        }
        expired_token = jwt.encode(expired_payload, settings.jwt_secret_key, algorithm="HS256")

        result = self.service.verify_token(expired_token, "access")

        assert result is None


class TestVerificationToken:
    """본인인증 토큰 테스트"""

    def setup_method(self):
        """테스트 셋업"""
        mock_db = MagicMock()
        self.service = AuthService(mock_db)

    def test_create_verification_token(self):
        """본인인증 토큰 생성"""
        ci = "test-ci-value-12345"
        token, expires_at = self.service.create_verification_token(ci)

        assert token is not None
        assert expires_at > datetime.now(timezone.utc)
        # 10분 후 만료
        assert expires_at < datetime.now(timezone.utc) + timedelta(minutes=11)

    def test_verify_verification_token(self):
        """본인인증 토큰 검증"""
        ci = "test-ci-value-12345"
        token, _ = self.service.create_verification_token(ci)

        result = self.service.verify_verification_token(token)

        assert result == ci

    def test_verify_invalid_verification_token(self):
        """유효하지 않은 본인인증 토큰"""
        result = self.service.verify_verification_token("invalid-token")

        assert result is None


class TestResetCodeHashing:
    """비밀번호 재설정 코드 해싱 테스트"""

    def setup_method(self):
        """테스트 셋업"""
        mock_db = MagicMock()
        self.service = AuthService(mock_db)

    def test_hash_reset_code(self):
        """재설정 코드 해싱"""
        code = "123456"
        hashed = self.service._hash_reset_code(code)

        assert hashed is not None
        assert hashed != code

    def test_verify_reset_code_correct(self):
        """올바른 재설정 코드 검증"""
        code = "123456"
        hashed = self.service._hash_reset_code(code)

        assert self.service._verify_reset_code(code, hashed) is True

    def test_verify_reset_code_incorrect(self):
        """틀린 재설정 코드 검증"""
        code = "123456"
        hashed = self.service._hash_reset_code(code)

        assert self.service._verify_reset_code("654321", hashed) is False


class TestResetToken:
    """비밀번호 재설정 토큰 테스트"""

    def setup_method(self):
        """테스트 셋업"""
        mock_db = MagicMock()
        self.service = AuthService(mock_db)

    def test_create_reset_token(self):
        """재설정 토큰 생성"""
        shop_id = "test-shop-id"
        email = "test@example.com"
        token = self.service._create_reset_token(shop_id, email)

        assert token is not None
        assert len(token.split('.')) == 3  # JWT 형식

    def test_verify_reset_token(self):
        """재설정 토큰 검증"""
        shop_id = "test-shop-id"
        email = "test@example.com"
        token = self.service._create_reset_token(shop_id, email)

        result = self.service._verify_reset_token(token, email)

        assert result == shop_id

    def test_verify_reset_token_wrong_email(self):
        """잘못된 이메일로 재설정 토큰 검증"""
        shop_id = "test-shop-id"
        email = "test@example.com"
        token = self.service._create_reset_token(shop_id, email)

        result = self.service._verify_reset_token(token, "wrong@example.com")

        assert result is None


class TestTokenPayload:
    """토큰 페이로드 추출 테스트"""

    def setup_method(self):
        """테스트 셋업"""
        mock_db = MagicMock()
        self.service = AuthService(mock_db)

    def test_get_token_payload(self):
        """토큰 페이로드 추출"""
        shop_id = "test-shop-id"
        token, jti = self.service.create_access_token(shop_id)

        payload = self.service.get_token_payload(token)

        assert payload is not None
        assert payload["sub"] == shop_id
        assert payload["jti"] == jti
        assert payload["type"] == "access"

    def test_get_token_payload_invalid(self):
        """유효하지 않은 토큰 페이로드 추출"""
        payload = self.service.get_token_payload("invalid-token")

        assert payload is None


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
