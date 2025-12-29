"""
데이터베이스 연결 모듈
Supabase 클라이언트 초기화 및 관리
"""
from supabase import create_client, Client
from functools import lru_cache
from .config import get_settings


@lru_cache()
def get_supabase_client() -> Client:
    """Supabase 클라이언트 싱글톤 반환"""
    settings = get_settings()
    return create_client(settings.supabase_url, settings.supabase_key)


@lru_cache()
def get_supabase_admin_client() -> Client:
    """Supabase 관리자 클라이언트 반환 (서비스 롤 키 사용)"""
    settings = get_settings()
    return create_client(settings.supabase_url, settings.supabase_service_key)


def get_db() -> Client:
    """의존성 주입용 데이터베이스 클라이언트 반환"""
    return get_supabase_client()
