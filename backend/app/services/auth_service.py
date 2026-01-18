"""
인증 서비스
이메일/비밀번호 인증, JWT 토큰 관리 등을 담당
"""
import logging
import os
import random
import uuid
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, Tuple
from jose import jwt, JWTError
import bcrypt
from supabase import Client

from ..config import get_settings
from ..database import get_supabase_admin_client
from .pin_service import PinService

# 프로덕션에서는 INFO 레벨로 설정
logger = logging.getLogger(__name__)
_is_production = os.getenv("VERCEL_ENV", "development") == "production"
logger.setLevel(logging.INFO if _is_production else logging.DEBUG)

settings = get_settings()


def _mask_email(email: str) -> str:
    """이메일 마스킹 (로깅용)"""
    if not email or "@" not in email:
        return "***"
    local, domain = email.split("@", 1)
    if len(local) <= 2:
        return f"**@{domain}"
    return f"{local[0]}***{local[-1]}@{domain}"


def _generate_random_pin() -> str:
    """보안을 위한 랜덤 4자리 PIN 생성"""
    return ''.join([str(random.randint(0, 9)) for _ in range(4)])


def _generate_reset_code() -> str:
    """보안을 위한 랜덤 6자리 인증번호 생성"""
    return ''.join([str(random.randint(0, 9)) for _ in range(6)])


# 비밀번호 재설정 상수
RESET_CODE_EXPIRE_MINUTES = 10  # 인증번호 유효 시간 (10분)
RESET_MAX_FAILED_ATTEMPTS = 5   # 최대 실패 횟수
RESET_LOCK_DURATION_MINUTES = 5  # 잠금 시간 (5분)


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
            "type": "access",
            "iat": datetime.utcnow()
        }
        return jwt.encode(to_encode, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)

    def create_refresh_token(self, shop_id: str) -> str:
        """JWT 리프레시 토큰 생성"""
        expire = datetime.utcnow() + timedelta(days=settings.refresh_token_expire_days)
        to_encode = {
            "sub": shop_id,
            "exp": expire,
            "type": "refresh",
            "iat": datetime.utcnow()
        }
        return jwt.encode(to_encode, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)

    def verify_token(self, token: str, token_type: str = "access") -> Optional[str]:
        """토큰 검증 및 shop_id 반환"""
        try:
            payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
            shop_id: str = payload.get("sub")
            actual_type: str = payload.get("type")

            # 토큰 타입 검증
            if shop_id is None or actual_type != token_type:
                return None
            return shop_id
        except JWTError:
            return None

    def refresh_access_token(self, refresh_token: str) -> Optional[Dict[str, Any]]:
        """리프레시 토큰으로 새 액세스 토큰 발급"""
        shop_id = self.verify_token(refresh_token, token_type="refresh")
        if not shop_id:
            return None

        access_token = self.create_access_token(shop_id)
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "expires_in": settings.access_token_expire_minutes * 60
        }

    async def login(self, email: str, password: str) -> Optional[Dict[str, Any]]:
        """이메일/비밀번호 로그인"""
        masked_email = _mask_email(email)
        logger.debug(f"[LOGIN] 로그인 시도 - email: {masked_email}")

        # 이메일로 상점 조회 (admin 클라이언트로 RLS 우회)
        result = self.admin_db.table("shops").select("*").eq("email", email.lower()).execute()

        if not result.data:
            logger.debug(f"[LOGIN] 이메일을 찾을 수 없음: {masked_email}")
            return None

        shop = result.data[0]

        # 비밀번호 검증
        if not shop.get("password_hash") or not self.verify_password(password, shop["password_hash"]):
            logger.debug(f"[LOGIN] 비밀번호 불일치: {masked_email}")
            return None

        logger.info(f"[LOGIN] 로그인 성공 - shop_id: {shop['id'][:8]}...")

        # 토큰 생성
        access_token = self.create_access_token(shop["id"])
        refresh_token = self.create_refresh_token(shop["id"])

        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "expires_in": settings.access_token_expire_minutes * 60,
            "shop_id": shop["id"]
        }

    async def register(self, email: str, password: str, shop_name: str) -> Dict[str, Any]:
        """신규 회원가입"""
        masked_email = _mask_email(email)
        logger.debug(f"[REGISTER] 회원가입 시도 - email: {masked_email}")

        # 이메일 중복 체크 (admin 클라이언트로 RLS 우회)
        existing = self.admin_db.table("shops").select("id").eq("email", email.lower()).execute()
        if existing.data:
            logger.debug(f"[REGISTER] 이메일 중복: {masked_email}")
            raise ValueError("이미 사용 중인 이메일입니다")

        # 상점 생성
        shop_id = str(uuid.uuid4())
        password_hash = self.hash_password(password)

        # 보안: 랜덤 4자리 PIN 생성 (기본값 0000 사용하지 않음)
        initial_pin = _generate_random_pin()
        initial_pin_hash = self.pin_service.hash_pin(initial_pin)

        self.admin_db.table("shops").insert({
            "id": shop_id,
            "email": email.lower(),
            "password_hash": password_hash,
            "name": shop_name,
            "pin_hash": initial_pin_hash,
            "pin_change_required": True,  # 첫 로그인 시 PIN 변경 필요
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat()
        }).execute()

        logger.info(f"[REGISTER] 회원가입 성공 - shop_id: {shop_id[:8]}...")

        # 토큰 생성
        access_token = self.create_access_token(shop_id)
        refresh_token = self.create_refresh_token(shop_id)

        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "expires_in": settings.access_token_expire_minutes * 60,
            "shop_id": shop_id,
            "initial_pin": initial_pin,  # 초기 PIN 반환 (사용자에게 안내 필요)
            "pin_change_required": True
        }

    # ========== 비밀번호 재설정 기능 ==========

    def _hash_reset_code(self, code: str) -> str:
        """인증번호 해시"""
        return bcrypt.hashpw(code.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

    def _verify_reset_code(self, code: str, code_hash: str) -> bool:
        """인증번호 검증"""
        try:
            return bcrypt.checkpw(code.encode('utf-8'), code_hash.encode('utf-8'))
        except Exception:
            return False

    def _create_reset_token(self, shop_id: str, email: str) -> str:
        """비밀번호 재설정용 임시 토큰 생성 (15분 유효)"""
        expire = datetime.utcnow() + timedelta(minutes=15)
        to_encode = {
            "sub": shop_id,
            "email": email,
            "exp": expire,
            "type": "password_reset",
            "iat": datetime.utcnow()
        }
        return jwt.encode(to_encode, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)

    def _verify_reset_token(self, token: str, email: str) -> Optional[str]:
        """재설정 토큰 검증 및 shop_id 반환"""
        try:
            payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
            shop_id: str = payload.get("sub")
            token_email: str = payload.get("email")
            token_type: str = payload.get("type")

            if shop_id is None or token_type != "password_reset":
                return None
            if token_email != email.lower():
                return None
            return shop_id
        except JWTError:
            return None

    async def request_password_reset(self, email: str) -> Dict[str, Any]:
        """
        비밀번호 재설정 인증번호 발송 요청
        보안: 이메일 존재 여부와 관계없이 동일한 응답 반환
        """
        masked_email = _mask_email(email)
        logger.debug(f"[PASSWORD_RESET] 인증번호 요청 - email: {masked_email}")

        # 이메일로 상점 조회
        result = self.admin_db.table("shops").select("id, email").eq("email", email.lower()).execute()

        if result.data:
            shop = result.data[0]
            shop_id = shop["id"]

            # 6자리 인증번호 생성
            reset_code = _generate_reset_code()
            code_hash = self._hash_reset_code(reset_code)
            expires_at = datetime.now() + timedelta(minutes=RESET_CODE_EXPIRE_MINUTES)

            # 인증번호 저장 (기존 코드 덮어쓰기)
            self.admin_db.table("shops").update({
                "reset_code_hash": code_hash,
                "reset_code_expires_at": expires_at.isoformat(),
                "reset_code_failed_count": 0,
                "reset_code_locked_until": None,
                "updated_at": datetime.now().isoformat()
            }).eq("id", shop_id).execute()

            # 이메일 발송 (Supabase Edge Function 또는 외부 서비스)
            await self._send_reset_email(email.lower(), reset_code)

            logger.info(f"[PASSWORD_RESET] 인증번호 발송 완료 - shop_id: {shop_id[:8]}...")
        else:
            # 존재하지 않는 이메일이어도 로그만 남기고 동일 응답
            logger.debug(f"[PASSWORD_RESET] 존재하지 않는 이메일: {masked_email}")

        # 보안: 이메일 존재 여부와 관계없이 동일 응답
        return {
            "message": "인증번호가 발송되었습니다. 이메일을 확인해주세요.",
            "expires_in": RESET_CODE_EXPIRE_MINUTES * 60
        }

    async def _send_reset_email(self, email: str, code: str):
        """
        인증번호 이메일 발송
        TODO: Supabase Edge Function 또는 외부 이메일 서비스 연동
        현재는 로그에만 출력 (개발/테스트용)
        """
        logger.info(f"[EMAIL] 비밀번호 재설정 인증번호 발송: {email} -> {code}")
        # 실제 구현 시 아래 중 하나 선택:
        # 1. Supabase Edge Function 호출
        # 2. SendGrid API 호출
        # 3. AWS SES 호출
        # 4. SMTP 직접 발송

    async def verify_reset_code(
        self, email: str, code: str
    ) -> Tuple[bool, Optional[str], Optional[int], Optional[datetime]]:
        """
        인증번호 검증
        Returns: (verified, reset_token, remaining_attempts, locked_until)
        """
        masked_email = _mask_email(email)
        logger.debug(f"[PASSWORD_RESET] 인증번호 검증 - email: {masked_email}")

        # 이메일로 상점 조회
        result = self.admin_db.table("shops").select(
            "id, reset_code_hash, reset_code_expires_at, reset_code_failed_count, reset_code_locked_until"
        ).eq("email", email.lower()).execute()

        if not result.data:
            logger.debug(f"[PASSWORD_RESET] 존재하지 않는 이메일: {masked_email}")
            # 보안: 존재하지 않는 이메일도 동일한 실패 응답
            return False, None, RESET_MAX_FAILED_ATTEMPTS - 1, None

        shop = result.data[0]
        shop_id = shop["id"]

        # 잠금 상태 확인
        locked_until = shop.get("reset_code_locked_until")
        if locked_until:
            locked_until_dt = datetime.fromisoformat(locked_until.replace("Z", "+00:00"))
            if datetime.now(locked_until_dt.tzinfo) < locked_until_dt:
                logger.debug(f"[PASSWORD_RESET] 계정 잠금 상태: {masked_email}")
                return False, None, 0, locked_until_dt

            # 잠금 해제
            self.admin_db.table("shops").update({
                "reset_code_failed_count": 0,
                "reset_code_locked_until": None
            }).eq("id", shop_id).execute()

        # 인증번호 존재 여부 확인
        code_hash = shop.get("reset_code_hash")
        if not code_hash:
            logger.debug(f"[PASSWORD_RESET] 인증번호 없음: {masked_email}")
            return False, None, RESET_MAX_FAILED_ATTEMPTS - 1, None

        # 만료 시간 확인
        expires_at = shop.get("reset_code_expires_at")
        if expires_at:
            expires_at_dt = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
            if datetime.now(expires_at_dt.tzinfo) > expires_at_dt:
                logger.debug(f"[PASSWORD_RESET] 인증번호 만료: {masked_email}")
                return False, None, RESET_MAX_FAILED_ATTEMPTS - 1, None

        # 인증번호 검증
        if self._verify_reset_code(code, code_hash):
            # 성공: reset_token 발급
            reset_token = self._create_reset_token(shop_id, email.lower())

            # 인증번호 무효화 (일회용)
            self.admin_db.table("shops").update({
                "reset_code_hash": None,
                "reset_code_expires_at": None,
                "reset_code_failed_count": 0,
                "reset_code_locked_until": None
            }).eq("id", shop_id).execute()

            logger.info(f"[PASSWORD_RESET] 인증번호 검증 성공 - shop_id: {shop_id[:8]}...")
            return True, reset_token, RESET_MAX_FAILED_ATTEMPTS, None

        # 실패: 횟수 증가
        failed_count = (shop.get("reset_code_failed_count") or 0) + 1
        remaining = RESET_MAX_FAILED_ATTEMPTS - failed_count

        update_data = {
            "reset_code_failed_count": failed_count,
            "updated_at": datetime.now().isoformat()
        }

        # 최대 실패 횟수 도달 시 잠금
        new_locked_until = None
        if failed_count >= RESET_MAX_FAILED_ATTEMPTS:
            new_locked_until = datetime.now() + timedelta(minutes=RESET_LOCK_DURATION_MINUTES)
            update_data["reset_code_locked_until"] = new_locked_until.isoformat()
            remaining = 0
            logger.warning(f"[PASSWORD_RESET] 계정 잠금 - shop_id: {shop_id[:8]}...")

        self.admin_db.table("shops").update(update_data).eq("id", shop_id).execute()

        logger.debug(f"[PASSWORD_RESET] 인증번호 불일치 - 남은 시도: {remaining}")
        return False, None, remaining, new_locked_until

    async def confirm_password_reset(self, email: str, reset_token: str, new_password: str) -> bool:
        """
        새 비밀번호 설정
        """
        masked_email = _mask_email(email)
        logger.debug(f"[PASSWORD_RESET] 비밀번호 변경 - email: {masked_email}")

        # reset_token 검증
        shop_id = self._verify_reset_token(reset_token, email)
        if not shop_id:
            logger.debug(f"[PASSWORD_RESET] 유효하지 않은 토큰: {masked_email}")
            return False

        # 새 비밀번호 해시
        new_password_hash = self.hash_password(new_password)

        # 비밀번호 업데이트
        self.admin_db.table("shops").update({
            "password_hash": new_password_hash,
            "reset_code_hash": None,
            "reset_code_expires_at": None,
            "reset_code_failed_count": 0,
            "reset_code_locked_until": None,
            "updated_at": datetime.now().isoformat()
        }).eq("id", shop_id).execute()

        logger.info(f"[PASSWORD_RESET] 비밀번호 변경 완료 - shop_id: {shop_id[:8]}...")
        return True
