"""
환경 설정 모듈
Supabase, JWT, 소셜 로그인 등의 설정을 관리합니다.
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
    access_token_expire_minutes: int = 30

    # 네이버 소셜 로그인
    naver_client_id: str
    naver_client_secret: str
    naver_redirect_uri: str

    # 카카오 소셜 로그인
    kakao_client_id: str
    kakao_client_secret: str
    kakao_redirect_uri: str

    # 앱 설정
    app_env: str = "development"
    frontend_url: str = "http://localhost:5173"
    cors_origins: str = "http://localhost:5173,http://localhost:3000"

    @property
    def cors_origins_list(self) -> List[str]:
        """CORS 허용 도메인 리스트 반환"""
        return [origin.strip() for origin in self.cors_origins.split(",")]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    """설정 싱글톤 인스턴스 반환"""
    return Settings()
