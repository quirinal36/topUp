"""
인증 서비스
이메일/비밀번호 인증, JWT 토큰 관리 등을 담당
"""
import logging
import uuid
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from jose import jwt, JWTError
import bcrypt
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

    def hash_password(self, password: str) -> str:
        """비밀번호 해시"""
        return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

    def verify_password(self, password: str, password_hash: str) -> bool:
        """비밀번호 검증"""
        try:
            return bcrypt.checkpw(password.encode('utf-8'), password_hash.encode('utf-8'))
        except Exception:
            return False

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

    async def login(self, email: str, password: str) -> Optional[Dict[str, Any]]:
        """이메일/비밀번호 로그인"""
        logger.debug(f"[LOGIN] 로그인 시도 - email: {email}")

        # 이메일로 상점 조회 (admin 클라이언트로 RLS 우회)
        result = self.admin_db.table("shops").select("*").eq("email", email.lower()).execute()

        if not result.data:
            logger.debug(f"[LOGIN] 이메일을 찾을 수 없음: {email}")
            return None

        shop = result.data[0]

        # 비밀번호 검증
        if not shop.get("password_hash") or not self.verify_password(password, shop["password_hash"]):
            logger.debug(f"[LOGIN] 비밀번호 불일치: {email}")
            return None

        logger.debug(f"[LOGIN] 로그인 성공 - shop_id: {shop['id']}")

        # 토큰 생성
        access_token = self.create_access_token(shop["id"])

        return {
            "access_token": access_token,
            "token_type": "bearer",
            "expires_in": settings.access_token_expire_minutes * 60,
            "shop_id": shop["id"]
        }

    async def register(self, email: str, password: str, shop_name: str) -> Dict[str, Any]:
        """신규 회원가입"""
        logger.debug(f"[REGISTER] 회원가입 시도 - email: {email}, shop_name: {shop_name}")

        # 이메일 중복 체크 (admin 클라이언트로 RLS 우회)
        existing = self.admin_db.table("shops").select("id").eq("email", email.lower()).execute()
        if existing.data:
            logger.debug(f"[REGISTER] 이메일 중복: {email}")
            raise ValueError("이미 사용 중인 이메일입니다")

        # 상점 생성
        shop_id = str(uuid.uuid4())
        password_hash = self.hash_password(password)
        # 기본 PIN은 0000으로 설정
        default_pin_hash = self.pin_service.hash_pin("0000")

        self.admin_db.table("shops").insert({
            "id": shop_id,
            "email": email.lower(),
            "password_hash": password_hash,
            "name": shop_name,
            "pin_hash": default_pin_hash,  # 기본 PIN: 0000
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat()
        }).execute()

        logger.debug(f"[REGISTER] 회원가입 성공 - shop_id: {shop_id}")

        # 토큰 생성
        access_token = self.create_access_token(shop_id)

        return {
            "access_token": access_token,
            "token_type": "bearer",
            "expires_in": settings.access_token_expire_minutes * 60,
            "shop_id": shop_id
        }
