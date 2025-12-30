"""
인증 서비스
소셜 로그인, JWT 토큰 관리 등을 담당
"""
import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from jose import jwt, JWTError
import httpx
from supabase import Client

from ..config import get_settings
from ..database import get_supabase_admin_client
from .pin_service import PinService

# 디버그 로깅 설정
logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

settings = get_settings()


class AuthService:
    """인증 관련 서비스"""

    def __init__(self, db: Client):
        self.db = db
        # 인증 서비스는 RLS를 우회해야 하므로 admin 클라이언트 사용
        self.admin_db = get_supabase_admin_client()
        self.pin_service = PinService(db)

    def create_access_token(self, shop_id: str) -> str:
        """JWT 액세스 토큰 생성"""
        expire = datetime.utcnow() + timedelta(minutes=settings.access_token_expire_minutes)
        to_encode = {
            "sub": shop_id,
            "exp": expire,
            "type": "access"
        }
        return jwt.encode(to_encode, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)

    def verify_token(self, token: str) -> Optional[str]:
        """토큰 검증 및 shop_id 반환"""
        try:
            payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
            shop_id: str = payload.get("sub")
            if shop_id is None:
                return None
            return shop_id
        except JWTError:
            return None

    async def get_naver_user_info(self, code: str) -> Optional[Dict[str, Any]]:
        """네이버 OAuth로 사용자 정보 조회"""
        async with httpx.AsyncClient() as client:
            # 액세스 토큰 요청
            token_response = await client.post(
                "https://nid.naver.com/oauth2.0/token",
                data={
                    "grant_type": "authorization_code",
                    "client_id": settings.naver_client_id,
                    "client_secret": settings.naver_client_secret,
                    "code": code,
                    "redirect_uri": settings.naver_redirect_uri
                }
            )
            token_data = token_response.json()

            if "access_token" not in token_data:
                return None

            # 사용자 정보 요청
            user_response = await client.get(
                "https://openapi.naver.com/v1/nid/me",
                headers={"Authorization": f"Bearer {token_data['access_token']}"}
            )
            user_data = user_response.json()

            if user_data.get("resultcode") != "00":
                return None

            response = user_data.get("response", {})
            return {
                "provider": "NAVER",
                "provider_user_id": response.get("id"),
                "email": response.get("email"),
                "name": response.get("name")
            }

    async def get_kakao_user_info(self, code: str) -> Optional[Dict[str, Any]]:
        """카카오 OAuth로 사용자 정보 조회"""
        logger.debug(f"[KAKAO] 카카오 로그인 시작 - code: {code[:20]}...")
        logger.debug(f"[KAKAO] 설정값 - client_id: {settings.kakao_client_id}, redirect_uri: {settings.kakao_redirect_uri}")

        async with httpx.AsyncClient() as client:
            # 액세스 토큰 요청
            token_request_data = {
                "grant_type": "authorization_code",
                "client_id": settings.kakao_client_id,
                "client_secret": settings.kakao_client_secret,
                "code": code,
                "redirect_uri": settings.kakao_redirect_uri
            }
            logger.debug(f"[KAKAO] 토큰 요청 데이터: {token_request_data}")

            token_response = await client.post(
                "https://kauth.kakao.com/oauth/token",
                data=token_request_data,
                headers={"Content-Type": "application/x-www-form-urlencoded"}
            )
            logger.debug(f"[KAKAO] 토큰 응답 상태: {token_response.status_code}")
            token_data = token_response.json()
            logger.debug(f"[KAKAO] 토큰 응답 데이터: {token_data}")

            if "access_token" not in token_data:
                logger.error(f"[KAKAO] 액세스 토큰 없음! 에러: {token_data.get('error', 'unknown')}, 설명: {token_data.get('error_description', 'unknown')}")
                return None

            logger.debug(f"[KAKAO] 액세스 토큰 획득 성공")

            # 사용자 정보 요청
            user_response = await client.get(
                "https://kapi.kakao.com/v2/user/me",
                headers={"Authorization": f"Bearer {token_data['access_token']}"}
            )
            logger.debug(f"[KAKAO] 사용자 정보 응답 상태: {user_response.status_code}")
            user_data = user_response.json()
            logger.debug(f"[KAKAO] 사용자 정보: {user_data}")

            kakao_account = user_data.get("kakao_account", {})
            result = {
                "provider": "KAKAO",
                "provider_user_id": str(user_data.get("id")),
                "email": kakao_account.get("email"),
                "name": kakao_account.get("profile", {}).get("nickname")
            }
            logger.debug(f"[KAKAO] 반환할 사용자 정보: {result}")
            return result

    async def social_login(self, provider: str, code: str) -> Optional[Dict[str, Any]]:
        """소셜 로그인 처리"""
        logger.debug(f"[SOCIAL_LOGIN] 소셜 로그인 시작 - provider: {provider}, code: {code[:20]}...")

        # 소셜 사용자 정보 조회
        if provider.upper() == "NAVER":
            user_info = await self.get_naver_user_info(code)
        elif provider.upper() == "KAKAO":
            user_info = await self.get_kakao_user_info(code)
        else:
            logger.error(f"[SOCIAL_LOGIN] 지원하지 않는 provider: {provider}")
            return None

        if not user_info:
            logger.error(f"[SOCIAL_LOGIN] 사용자 정보 조회 실패 - provider: {provider}")
            return None

        logger.debug(f"[SOCIAL_LOGIN] 사용자 정보 조회 성공: {user_info}")

        # 기존 소셜 계정 조회 (admin 클라이언트로 RLS 우회)
        result = self.admin_db.table("social_accounts").select("*").eq(
            "provider", user_info["provider"]
        ).eq("provider_user_id", user_info["provider_user_id"]).execute()

        if result.data:
            # 기존 계정으로 로그인
            social_account = result.data[0]
            shop_id = social_account["shop_id"]
        else:
            # 신규 상점 및 소셜 계정 생성
            import uuid
            shop_id = str(uuid.uuid4())

            # 상점 생성 (PIN은 나중에 설정) - admin 클라이언트 사용
            self.admin_db.table("shops").insert({
                "id": shop_id,
                "name": user_info.get("name", "내 카페"),
                "pin_hash": "",  # 최초 설정 필요
                "created_at": datetime.now().isoformat(),
                "updated_at": datetime.now().isoformat()
            }).execute()

            # 소셜 계정 연결 - admin 클라이언트 사용
            self.admin_db.table("social_accounts").insert({
                "id": str(uuid.uuid4()),
                "shop_id": shop_id,
                "provider": user_info["provider"],
                "provider_user_id": user_info["provider_user_id"],
                "email": user_info.get("email"),
                "is_primary": True,
                "created_at": datetime.now().isoformat()
            }).execute()

        # 토큰 생성
        access_token = self.create_access_token(shop_id)

        return {
            "access_token": access_token,
            "token_type": "bearer",
            "expires_in": settings.access_token_expire_minutes * 60,
            "shop_id": shop_id,
            "is_new": not bool(result.data)
        }

    async def link_social_account(self, shop_id: str, provider: str, code: str) -> bool:
        """추가 소셜 계정 연동"""
        if provider.upper() == "NAVER":
            user_info = await self.get_naver_user_info(code)
        elif provider.upper() == "KAKAO":
            user_info = await self.get_kakao_user_info(code)
        else:
            return False

        if not user_info:
            return False

        # 이미 연동된 계정인지 확인 - admin 클라이언트 사용
        existing = self.admin_db.table("social_accounts").select("*").eq(
            "provider", user_info["provider"]
        ).eq("provider_user_id", user_info["provider_user_id"]).execute()

        if existing.data:
            return False  # 이미 다른 상점에 연동됨

        # 소셜 계정 연결 - admin 클라이언트 사용
        import uuid
        self.admin_db.table("social_accounts").insert({
            "id": str(uuid.uuid4()),
            "shop_id": shop_id,
            "provider": user_info["provider"],
            "provider_user_id": user_info["provider_user_id"],
            "email": user_info.get("email"),
            "is_primary": False,
            "created_at": datetime.now().isoformat()
        }).execute()

        return True
