"""
인증 서비스
아이디/비밀번호 인증, JWT 토큰 관리, NICE 본인인증 등을 담당
"""
import logging
import os
import random
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any, Tuple
from jose import jwt, JWTError
import bcrypt
import resend
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


# 본인인증 토큰 유효 시간 (10분)
VERIFICATION_TOKEN_EXPIRE_MINUTES = 10


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

    def create_access_token(self, shop_id: str) -> Tuple[str, str]:
        """
        JWT 액세스 토큰 생성
        Returns: (token, jti) - 토큰과 JWT ID
        """
        now = datetime.now(timezone.utc)
        expire = now + timedelta(minutes=settings.access_token_expire_minutes)
        jti = str(uuid.uuid4())
        to_encode = {
            "sub": shop_id,
            "exp": expire,
            "type": "access",
            "iat": now,
            "jti": jti  # JWT ID for revocation
        }
        token = jwt.encode(to_encode, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)
        return token, jti

    def create_refresh_token(self, shop_id: str) -> Tuple[str, str]:
        """
        JWT 리프레시 토큰 생성
        Returns: (token, jti) - 토큰과 JWT ID
        """
        now = datetime.now(timezone.utc)
        expire = now + timedelta(days=settings.refresh_token_expire_days)
        jti = str(uuid.uuid4())
        to_encode = {
            "sub": shop_id,
            "exp": expire,
            "type": "refresh",
            "iat": now,
            "jti": jti  # JWT ID for revocation
        }
        token = jwt.encode(to_encode, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)
        return token, jti

    def _is_token_blacklisted(self, jti: str) -> bool:
        """토큰이 블랙리스트에 있는지 확인"""
        try:
            result = self.admin_db.table("token_blacklist").select("jti").eq("jti", jti).maybe_single().execute()
            return result is not None and result.data is not None
        except Exception as e:
            logger.error(f"[AUTH] 블랙리스트 확인 오류: {str(e)}")
            return False  # 오류 시 보수적으로 허용

    def blacklist_token(self, jti: str, shop_id: str, expires_at: datetime) -> bool:
        """토큰을 블랙리스트에 추가"""
        try:
            self.admin_db.table("token_blacklist").insert({
                "jti": jti,
                "shop_id": shop_id,
                "expires_at": expires_at.isoformat(),
                "created_at": datetime.now(timezone.utc).isoformat()
            }).execute()
            logger.info(f"[AUTH] 토큰 블랙리스트 추가 - jti: {jti[:8]}...")
            return True
        except Exception as e:
            logger.error(f"[AUTH] 블랙리스트 추가 오류: {str(e)}")
            return False

    def verify_token(self, token: str, token_type: str = "access") -> Optional[str]:
        """토큰 검증 및 shop_id 반환 (블랙리스트 확인 포함)"""
        try:
            payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
            shop_id: str = payload.get("sub")
            actual_type: str = payload.get("type")
            jti: str = payload.get("jti")

            # 토큰 타입 검증
            if shop_id is None or actual_type != token_type:
                return None

            # jti가 있으면 블랙리스트 확인
            if jti and self._is_token_blacklisted(jti):
                logger.debug(f"[AUTH] 블랙리스트된 토큰 - jti: {jti[:8]}...")
                return None

            return shop_id
        except JWTError:
            return None

    def get_token_payload(self, token: str) -> Optional[Dict[str, Any]]:
        """토큰에서 페이로드 추출 (검증 없이)"""
        try:
            payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
            return payload
        except JWTError:
            return None

    def refresh_access_token(self, refresh_token: str) -> Optional[Dict[str, Any]]:
        """리프레시 토큰으로 새 액세스 토큰 발급"""
        shop_id = self.verify_token(refresh_token, token_type="refresh")
        if not shop_id:
            return None

        access_token, _ = self.create_access_token(shop_id)
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "expires_in": settings.access_token_expire_minutes * 60
        }

    def create_verification_token(self, ci: str) -> Tuple[str, datetime]:
        """
        본인인증 완료 후 임시 토큰 생성 (CI 포함, 10분 유효)
        Returns: (token, expires_at)
        """
        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(minutes=VERIFICATION_TOKEN_EXPIRE_MINUTES)
        to_encode = {
            "ci": ci,
            "type": "verification",
            "exp": expires_at,
            "iat": now
        }
        token = jwt.encode(to_encode, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)
        return token, expires_at

    def verify_verification_token(self, token: str) -> Optional[str]:
        """
        본인인증 토큰 검증 후 CI 반환
        Returns: CI 값 또는 None (유효하지 않은 경우)
        """
        try:
            payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
            token_type: str = payload.get("type")
            ci: str = payload.get("ci")

            if token_type != "verification" or not ci:
                logger.debug("[AUTH] 유효하지 않은 verification 토큰 타입")
                return None

            return ci
        except JWTError as e:
            logger.debug(f"[AUTH] verification 토큰 검증 실패: {str(e)}")
            return None

    async def login(self, username: str, password: str) -> Optional[Dict[str, Any]]:
        """아이디/비밀번호 로그인"""
        logger.debug(f"[LOGIN] 로그인 시도 - username: {username}")

        # 아이디로 상점 조회 (admin 클라이언트로 RLS 우회)
        result = self.admin_db.table("shops").select("*").eq("username", username.lower()).execute()

        if not result.data:
            logger.debug(f"[LOGIN] 아이디를 찾을 수 없음: {username}")
            return None

        shop = result.data[0]

        # 비밀번호 검증
        if not shop.get("password_hash") or not self.verify_password(password, shop["password_hash"]):
            logger.debug(f"[LOGIN] 비밀번호 불일치: {username}")
            return None

        logger.info(f"[LOGIN] 로그인 성공 - shop_id: {shop['id'][:8]}...")

        # 토큰 생성 (jti 포함)
        access_token, _ = self.create_access_token(shop["id"])
        refresh_token, _ = self.create_refresh_token(shop["id"])

        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "expires_in": settings.access_token_expire_minutes * 60,
            "shop_id": shop["id"]
        }

    async def register(
        self,
        username: str,
        password: str,
        shop_name: str,
        verification_token: str,
        pin: str,
        email: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        신규 회원가입 (본인인증 필수)

        Args:
            username: 로그인 아이디
            password: 비밀번호
            shop_name: 상점명
            verification_token: 본인인증 완료 토큰 (CI 포함)
            pin: 사용자가 설정한 4자리 PIN 번호
            email: 비밀번호 재설정용 이메일 (선택)
        """
        logger.debug(f"[REGISTER] 회원가입 시도 - username: {username}")

        # 본인인증 토큰 검증
        ci = self.verify_verification_token(verification_token)
        if not ci:
            logger.warning(f"[REGISTER] 유효하지 않은 본인인증 토큰 - username: {username}")
            raise ValueError("본인인증이 만료되었습니다. 다시 인증해주세요.")

        # CI 중복 확인 (이미 가입된 사용자인지)
        existing_ci = self.admin_db.table("shops").select("id").eq("ci", ci).execute()
        if existing_ci.data:
            logger.warning(f"[REGISTER] CI 중복 - username: {username}")
            raise ValueError("이미 가입된 정보입니다. 기존 계정으로 로그인해주세요.")

        # 아이디 중복 체크 (admin 클라이언트로 RLS 우회)
        existing = self.admin_db.table("shops").select("id").eq("username", username.lower()).execute()
        if existing.data:
            logger.debug(f"[REGISTER] 아이디 중복: {username}")
            raise ValueError("이미 사용 중인 아이디입니다")

        # PIN 유효성 검증
        if not pin or len(pin) != 4 or not pin.isdigit():
            raise ValueError("PIN은 4자리 숫자여야 합니다")

        # 상점 생성
        shop_id = str(uuid.uuid4())
        password_hash = self.hash_password(password)

        # 사용자가 설정한 PIN 해시
        pin_hash = self.pin_service.hash_pin(pin)

        now = datetime.now(timezone.utc)
        shop_data = {
            "id": shop_id,
            "username": username.lower(),
            "password_hash": password_hash,
            "name": shop_name,
            "ci": ci,
            "pin_hash": pin_hash,
            "pin_change_required": False,  # 사용자가 직접 설정했으므로 변경 불필요
            "created_at": now.isoformat(),
            "updated_at": now.isoformat()
        }

        # 이메일이 제공된 경우 추가
        if email:
            shop_data["email"] = email.lower()

        self.admin_db.table("shops").insert(shop_data).execute()

        logger.info(f"[REGISTER] 회원가입 성공 - shop_id: {shop_id[:8]}...")

        # 토큰 생성 (jti 포함)
        access_token, _ = self.create_access_token(shop_id)
        refresh_token, _ = self.create_refresh_token(shop_id)

        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "expires_in": settings.access_token_expire_minutes * 60,
            "shop_id": shop_id,
            "pin_change_required": False  # 사용자가 직접 설정한 PIN 사용
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
        now = datetime.now(timezone.utc)
        expire = now + timedelta(minutes=15)
        to_encode = {
            "sub": shop_id,
            "email": email,
            "exp": expire,
            "type": "password_reset",
            "iat": now
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
            now = datetime.now(timezone.utc)
            expires_at = now + timedelta(minutes=RESET_CODE_EXPIRE_MINUTES)

            # 인증번호 저장 (기존 코드 덮어쓰기)
            self.admin_db.table("shops").update({
                "reset_code_hash": code_hash,
                "reset_code_expires_at": expires_at.isoformat(),
                "reset_code_failed_count": 0,
                "reset_code_locked_until": None,
                "updated_at": now.isoformat()
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
        Resend API를 사용하여 인증번호 이메일 발송
        """
        masked_email = _mask_email(email)

        # Resend API 키가 설정되지 않은 경우 로그만 출력 (개발용)
        if not settings.resend_api_key:
            logger.warning(f"[EMAIL] Resend API 키 미설정 - 인증번호 로그 출력: {email} -> {code}")
            return

        try:
            resend.api_key = settings.resend_api_key

            # 이메일 HTML 템플릿
            html_content = f"""
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <style>
                    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }}
                    .container {{ max-width: 600px; margin: 0 auto; padding: 40px 20px; }}
                    .header {{ text-align: center; margin-bottom: 30px; }}
                    .code-box {{ background: #f8f9fa; border-radius: 12px; padding: 30px; text-align: center; margin: 30px 0; }}
                    .code {{ font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #2563eb; }}
                    .warning {{ color: #6b7280; font-size: 14px; margin-top: 20px; }}
                    .footer {{ text-align: center; color: #9ca3af; font-size: 12px; margin-top: 40px; }}
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>비밀번호 재설정</h1>
                    </div>
                    <p>안녕하세요,</p>
                    <p>비밀번호 재설정을 요청하셨습니다. 아래 인증번호를 입력해주세요.</p>
                    <div class="code-box">
                        <div class="code">{code}</div>
                    </div>
                    <p class="warning">
                        ⚠️ 이 인증번호는 <strong>10분</strong> 후에 만료됩니다.<br>
                        본인이 요청하지 않았다면 이 이메일을 무시해주세요.
                    </p>
                    <div class="footer">
                        <p>{settings.resend_from_name}</p>
                    </div>
                </div>
            </body>
            </html>
            """

            # Resend API 호출
            params = {
                "from": f"{settings.resend_from_name} <{settings.resend_from_email}>",
                "to": [email],
                "subject": f"[{settings.resend_from_name}] 비밀번호 재설정 인증번호: {code}",
                "html": html_content
            }

            response = resend.Emails.send(params)
            logger.info(f"[EMAIL] 이메일 발송 성공 - email: {masked_email}, id: {response.get('id', 'unknown')}")

        except Exception as e:
            logger.error(f"[EMAIL] 이메일 발송 실패 - email: {masked_email}, error: {str(e)}")
            # 이메일 발송 실패해도 전체 프로세스는 계속 진행 (보안상 사용자에게 실패 알리지 않음)

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

        now = datetime.now(timezone.utc)
        update_data = {
            "reset_code_failed_count": failed_count,
            "updated_at": now.isoformat()
        }

        # 최대 실패 횟수 도달 시 잠금
        new_locked_until = None
        if failed_count >= RESET_MAX_FAILED_ATTEMPTS:
            new_locked_until = now + timedelta(minutes=RESET_LOCK_DURATION_MINUTES)
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
            "updated_at": datetime.now(timezone.utc).isoformat()
        }).eq("id", shop_id).execute()

        logger.info(f"[PASSWORD_RESET] 비밀번호 변경 완료 - shop_id: {shop_id[:8]}...")
        return True
