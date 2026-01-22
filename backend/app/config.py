"""
환경 설정 모듈
Supabase, JWT 등의 설정을 관리합니다.
"""
from pydantic_settings import BaseSettings
from functools import lru_cache
from typing import List


class Settings(BaseSettings):
    """애플리케이션 설정"""

    # Supabase 설정
    supabase_url: str
    supabase_key: str
    supabase_service_key: str

    # JWT 설정
    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7  # 7 days
    refresh_token_expire_days: int = 30  # Refresh token 만료 (30일)

    # Rate Limiting 설정
    login_rate_limit_minutes: int = 15  # 제한 시간 (분)
    login_rate_limit_attempts: int = 5  # 최대 시도 횟수

    # 앱 설정
    app_env: str = "development"
    frontend_url: str = "http://localhost:5173"
    cors_origins: str = "http://localhost:5173,http://localhost:8080"

    # Resend 이메일 설정 (.env에서 읽음)
    resend_api_key: str
    resend_from_email: str
    resend_from_name: str

    # Cloudflare Turnstile 설정 (봇 방지)
    turnstile_secret_key: str = ""  # 빈 문자열이면 검증 비활성화 (개발용)

    # NICE 본인인증 설정
    nice_mode: str = "mock"  # mock | production
    nice_site_code: str = ""  # NICE 사이트 코드 (프로덕션용)
    nice_site_pw: str = ""  # NICE 사이트 비밀번호 (프로덕션용)

    # 국세청 사업자등록정보 조회 API (공공데이터포털)
    nts_api_key: str = ""  # 공공데이터포털에서 발급받은 디코딩 인증키

    @property
    def cors_origins_list(self) -> List[str]:
        """CORS 허용 도메인 리스트 반환"""
        return [origin.strip() for origin in self.cors_origins.split(",")]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    """설정 싱글톤 인스턴스 반환"""
    return Settings()
