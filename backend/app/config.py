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

    # 앱 설정
    app_env: str = "development"
    frontend_url: str = "http://localhost:5173"
    cors_origins: str = "http://localhost:5173,http://localhost:5173"

    # 토스페이먼츠 설정
    toss_client_key: str = ""
    toss_secret_key: str = ""

    # 구독 설정
    subscription_monthly_price: int = 9900
    subscription_trial_days: int = 14
    subscription_grace_days: int = 7

    # Solapi 설정 (알림톡/문자)
    solapi_api_key: str = ""
    solapi_api_secret: str = ""
    solapi_sender_phone: str = ""

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
