"""
인증 API 라우터
이메일/비밀번호 로그인, PIN 관리 등
"""
import logging
import os
import httpx
import sentry_sdk
from datetime import datetime, timedelta, timezone
from typing import Dict, Tuple
from collections import defaultdict
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from ..config import get_settings

# 프로덕션에서는 INFO 레벨로 설정
logger = logging.getLogger(__name__)
_is_production = os.getenv("VERCEL_ENV", "development") == "production"
logger.setLevel(logging.INFO if _is_production else logging.DEBUG)

settings = get_settings()

from ..database import get_db, get_supabase_admin_client
from ..utils import now_seoul_iso
from ..services.auth_service import AuthService
from ..services.pin_service import PinService
from ..schemas.auth import (
    TokenResponse,
    LoginRequest,
    RegisterRequest,
    ShopResponse,
    PinVerifyRequest,
    PinVerifyResponse,
    PinChangeRequest,
    ShopUpdateRequest,
    RefreshTokenRequest,
    PasswordResetRequestSchema,
    PasswordResetVerifySchema,
    PasswordResetConfirmSchema,
    PasswordResetResponse,
    PasswordResetVerifyResponse,
    UsernameCheckRequest,
    UsernameCheckResponse,
    NiceAuthStartResponse,
    NiceAuthCompleteRequest,
    NiceAuthCompleteResponse,
    FindEmailByBusinessNumberRequest,
    FindEmailByBusinessNumberResponse,
    PasswordResetByBusinessNumberRequest,
    PasswordResetByBusinessNumberResponse,
)
from ..services.nice_service import get_nice_service, generate_request_id


# ========== Rate Limiting 구현 ==========
# 인메모리 저장소 (프로덕션에서는 Redis 권장)
# datetime.min에 timezone 정보 추가 (aware datetime과 비교하기 위함)
_datetime_min_utc = datetime.min.replace(tzinfo=timezone.utc)
_login_attempts: Dict[str, Tuple[int, datetime]] = defaultdict(lambda: (0, _datetime_min_utc))


def _get_client_ip(request: Request) -> str:
    """클라이언트 IP 주소 추출"""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _check_rate_limit(ip: str) -> Tuple[bool, int, datetime]:
    """
    Rate limit 확인
    Returns: (is_allowed, remaining_attempts, reset_time)
    """
    attempts, first_attempt_time = _login_attempts[ip]
    limit_window = timedelta(minutes=settings.login_rate_limit_minutes)
    max_attempts = settings.login_rate_limit_attempts
    now = datetime.now(timezone.utc)

    # 제한 시간이 지났으면 초기화
    if now - first_attempt_time > limit_window:
        _login_attempts[ip] = (0, _datetime_min_utc)
        return True, max_attempts, now + limit_window

    remaining = max_attempts - attempts
    reset_time = first_attempt_time + limit_window

    if attempts >= max_attempts:
        return False, 0, reset_time

    return True, remaining, reset_time


def _record_login_attempt(ip: str, success: bool):
    """로그인 시도 기록"""
    if success:
        # 성공하면 카운터 초기화
        _login_attempts[ip] = (0, _datetime_min_utc)
    else:
        attempts, first_time = _login_attempts[ip]
        if first_time == _datetime_min_utc:
            first_time = datetime.now(timezone.utc)
        _login_attempts[ip] = (attempts + 1, first_time)

router = APIRouter(prefix="/api/auth", tags=["인증"])
security = HTTPBearer()


# ========== Turnstile (CAPTCHA) 검증 ==========
TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"


async def verify_turnstile(token: str, client_ip: str) -> bool:
    """
    Cloudflare Turnstile 토큰 검증
    Returns: True if valid, False otherwise
    """
    secret_key = settings.turnstile_secret_key

    # 시크릿 키가 없으면 검증 비활성화 (개발 환경)
    if not secret_key:
        logger.warning("[TURNSTILE] Secret key not configured, skipping verification")
        return True

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                TURNSTILE_VERIFY_URL,
                data={
                    "secret": secret_key,
                    "response": token,
                    "remoteip": client_ip,
                },
                timeout=10.0
            )
            result = response.json()

            if result.get("success"):
                logger.debug(f"[TURNSTILE] Verification successful")
                return True
            else:
                error_codes = result.get("error-codes", [])
                logger.warning(f"[TURNSTILE] Verification failed: {error_codes}")
                return False

    except Exception as e:
        logger.error(f"[TURNSTILE] Verification error: {str(e)}")
        # 네트워크 오류 시 통과 (가용성 우선)
        return True


def get_auth_service(db=Depends(get_db)) -> AuthService:
    """인증 서비스 의존성"""
    return AuthService(db)


def get_pin_service(db=Depends(get_db)) -> PinService:
    """PIN 서비스 의존성"""
    return PinService(db)


async def get_current_shop(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    auth_service: AuthService = Depends(get_auth_service)
) -> str:
    """현재 로그인된 상점 ID 반환"""
    token = credentials.credentials
    shop_id = auth_service.verify_token(token)
    if not shop_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="유효하지 않은 인증 토큰입니다"
        )
    # Sentry 사용자 컨텍스트 설정
    sentry_sdk.set_user({"id": shop_id})
    return shop_id


@router.post("/login", response_model=TokenResponse)
async def login(
    login_request: LoginRequest,
    request: Request,
    auth_service: AuthService = Depends(get_auth_service)
):
    """아이디/비밀번호 로그인 (Rate Limiting 적용)"""
    client_ip = _get_client_ip(request)

    # Rate Limit 확인
    is_allowed, remaining, reset_time = _check_rate_limit(client_ip)
    if not is_allowed:
        seconds_until_reset = int((reset_time - datetime.now(timezone.utc)).total_seconds())
        logger.warning(f"[LOGIN] Rate limit exceeded for IP: {client_ip[:10]}...")
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"너무 많은 로그인 시도입니다. {seconds_until_reset}초 후에 다시 시도해주세요.",
            headers={"Retry-After": str(seconds_until_reset)}
        )

    try:
        result = await auth_service.login(login_request.username, login_request.password)
        if not result:
            _record_login_attempt(client_ip, success=False)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="아이디 또는 비밀번호가 올바르지 않습니다"
            )

        _record_login_attempt(client_ip, success=True)
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[LOGIN] 로그인 에러: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="로그인 처리 중 오류가 발생했습니다"
        )


@router.post("/register", response_model=TokenResponse)
async def register(
    register_request: RegisterRequest,
    request: Request,
    auth_service: AuthService = Depends(get_auth_service)
):
    """회원가입 (본인인증 + Turnstile 봇 방지 적용)"""
    client_ip = _get_client_ip(request)

    # Turnstile 검증 (프로덕션 환경에서 필수)
    if settings.turnstile_secret_key:
        if not register_request.turnstile_token:
            logger.warning(f"[REGISTER] Missing Turnstile token from IP: {client_ip[:10]}...")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="보안 검증이 필요합니다. 페이지를 새로고침해주세요."
            )

        is_valid = await verify_turnstile(register_request.turnstile_token, client_ip)
        if not is_valid:
            logger.warning(f"[REGISTER] Turnstile verification failed for IP: {client_ip[:10]}...")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="보안 검증에 실패했습니다. 다시 시도해주세요."
            )

    try:
        result = await auth_service.register(
            username=register_request.username,
            password=register_request.password,
            shop_name=register_request.shop_name,
            verification_token=register_request.verification_token,
            pin=register_request.pin,
            email=register_request.email
        )
        logger.info(f"[REGISTER] New registration from IP: {client_ip[:10]}...")
        return result
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"[REGISTER] 회원가입 에러: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="회원가입 처리 중 오류가 발생했습니다"
        )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    request: RefreshTokenRequest,
    auth_service: AuthService = Depends(get_auth_service)
):
    """리프레시 토큰으로 새 액세스 토큰 발급"""
    result = auth_service.refresh_access_token(request.refresh_token)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="유효하지 않거나 만료된 리프레시 토큰입니다"
        )
    return result


@router.post("/logout")
async def logout(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    auth_service: AuthService = Depends(get_auth_service)
):
    """
    로그아웃 - 현재 토큰을 블랙리스트에 추가
    클라이언트는 이 API 호출 후 로컬 토큰도 삭제해야 함
    """
    token = credentials.credentials
    payload = auth_service.get_token_payload(token)

    if payload:
        jti = payload.get("jti")
        shop_id = payload.get("sub")
        exp = payload.get("exp")

        if jti and shop_id and exp:
            # exp는 Unix timestamp
            expires_at = datetime.fromtimestamp(exp, tz=timezone.utc)
            auth_service.blacklist_token(jti, shop_id, expires_at)
            logger.info(f"[LOGOUT] 로그아웃 성공 - shop_id: {shop_id[:8]}...")

    return {"message": "로그아웃되었습니다"}


@router.post("/pin/verify", response_model=PinVerifyResponse)
async def verify_pin(
    request: PinVerifyRequest,
    shop_id: str = Depends(get_current_shop),
    pin_service: PinService = Depends(get_pin_service)
):
    """PIN 검증"""
    verified, remaining, locked_until = await pin_service.verify_pin(shop_id, request.pin)

    return PinVerifyResponse(
        verified=verified,
        remaining_attempts=remaining,
        locked_until=locked_until.isoformat() if locked_until else None
    )


@router.post("/pin/change")
async def change_pin(
    request: PinChangeRequest,
    shop_id: str = Depends(get_current_shop),
    pin_service: PinService = Depends(get_pin_service)
):
    """PIN 변경"""
    success = await pin_service.change_pin(shop_id, request.current_pin, request.new_pin)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="현재 PIN이 일치하지 않습니다"
        )
    return {"message": "PIN이 변경되었습니다"}


@router.post("/pin/reset")
async def reset_pin(
    request: PinVerifyRequest,
    shop_id: str = Depends(get_current_shop),
    pin_service: PinService = Depends(get_pin_service)
):
    """PIN 재설정 (비밀번호 재인증 후)"""
    success = await pin_service.reset_pin(shop_id, request.pin)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="PIN 재설정에 실패했습니다"
        )
    return {"message": "PIN이 재설정되었습니다"}


@router.post("/check-username", response_model=UsernameCheckResponse)
async def check_username(
    request: UsernameCheckRequest
):
    """아이디 중복 확인"""
    admin_db = get_supabase_admin_client()
    result = admin_db.table("shops").select("id").eq("username", request.username.lower()).execute()

    if result.data:
        return UsernameCheckResponse(
            available=False,
            message="이미 사용 중인 아이디입니다"
        )

    return UsernameCheckResponse(
        available=True,
        message="사용 가능한 아이디입니다"
    )


@router.post("/nice/start", response_model=NiceAuthStartResponse)
async def nice_auth_start():
    """NICE 본인인증 시작"""
    request_id = generate_request_id()
    nice_service = get_nice_service()
    result = nice_service.start_auth(request_id)

    return NiceAuthStartResponse(
        request_id=result["request_id"],
        enc_data=result["enc_data"],
        mock_mode=result.get("mock_mode", False)
    )


@router.post("/nice/complete", response_model=NiceAuthCompleteResponse)
async def nice_auth_complete(
    request: NiceAuthCompleteRequest,
    auth_service: AuthService = Depends(get_auth_service)
):
    """NICE 본인인증 완료"""
    nice_service = get_nice_service()
    result = nice_service.complete_auth(request.request_id, request.enc_data)

    if not result.success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result.error_message or "본인인증에 실패했습니다"
        )

    # CI 중복 확인 (이미 가입된 사용자인지)
    admin_db = get_supabase_admin_client()
    existing = admin_db.table("shops").select("id").eq("ci", result.ci).execute()

    if existing.data:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="이미 가입된 정보입니다. 기존 계정으로 로그인해주세요."
        )

    # 임시 토큰 발급 (CI 포함, 10분 유효)
    verification_token, expires_at = auth_service.create_verification_token(result.ci)

    logger.info(f"[NICE] 본인인증 완료 - request_id: {request.request_id[:8]}...")

    return NiceAuthCompleteResponse(
        verification_token=verification_token,
        expires_at=expires_at
    )


@router.get("/me", response_model=ShopResponse)
async def get_current_shop_info(
    shop_id: str = Depends(get_current_shop)
):
    """현재 로그인된 상점 정보 조회"""
    admin_db = get_supabase_admin_client()
    result = admin_db.table("shops").select(
        "id, name, username, email, business_number, onboarding_completed, created_at"
    ).eq("id", shop_id).maybe_single().execute()
    if not result or not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="상점 정보를 찾을 수 없습니다"
        )

    return result.data


@router.put("/me", response_model=ShopResponse)
async def update_current_shop_info(
    request: ShopUpdateRequest,
    shop_id: str = Depends(get_current_shop)
):
    """현재 로그인된 상점 정보 수정"""
    admin_db = get_supabase_admin_client()

    admin_db.table("shops").update({
        "name": request.name,
        "updated_at": now_seoul_iso()
    }).eq("id", shop_id).execute()

    # 업데이트된 정보 반환
    result = admin_db.table("shops").select("id, name, email, created_at").eq("id", shop_id).maybe_single().execute()
    if not result or not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="상점 정보를 찾을 수 없습니다"
        )

    return result.data


# ========== 비밀번호 재설정 엔드포인트 ==========

# 비밀번호 재설정 요청 Rate Limiting (IP당 시간당 3회)
_reset_request_attempts: Dict[str, Tuple[int, datetime]] = defaultdict(lambda: (0, _datetime_min_utc))

# 사업자등록번호 이메일 조회 Rate Limiting (IP당 시간당 5회)
_find_email_attempts: Dict[str, Tuple[int, datetime]] = defaultdict(lambda: (0, _datetime_min_utc))


def _check_reset_rate_limit(ip: str) -> Tuple[bool, int]:
    """비밀번호 재설정 요청 Rate Limit 확인"""
    attempts, first_attempt_time = _reset_request_attempts[ip]
    limit_window = timedelta(hours=1)  # 1시간
    max_attempts = 3  # 시간당 3회
    now = datetime.now(timezone.utc)

    # 제한 시간이 지났으면 초기화
    if now - first_attempt_time > limit_window:
        _reset_request_attempts[ip] = (1, now)
        return True, max_attempts - 1

    if attempts >= max_attempts:
        return False, 0

    _reset_request_attempts[ip] = (attempts + 1, first_attempt_time)
    return True, max_attempts - attempts - 1


@router.post("/password-reset/request", response_model=PasswordResetResponse)
async def request_password_reset(
    request_data: PasswordResetRequestSchema,
    request: Request,
    auth_service: AuthService = Depends(get_auth_service)
):
    """비밀번호 재설정 인증번호 발송 요청"""
    client_ip = _get_client_ip(request)

    # Rate Limit 확인
    is_allowed, remaining = _check_reset_rate_limit(client_ip)
    if not is_allowed:
        logger.warning(f"[PASSWORD_RESET] Rate limit exceeded for IP: {client_ip[:10]}...")
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="너무 많은 요청입니다. 1시간 후에 다시 시도해주세요."
        )

    try:
        result = await auth_service.request_password_reset(request_data.email)
        return PasswordResetResponse(**result)
    except Exception as e:
        logger.error(f"[PASSWORD_RESET] 인증번호 요청 에러: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="인증번호 발송 중 오류가 발생했습니다"
        )


@router.post("/password-reset/verify", response_model=PasswordResetVerifyResponse)
async def verify_reset_code(
    request_data: PasswordResetVerifySchema,
    auth_service: AuthService = Depends(get_auth_service)
):
    """비밀번호 재설정 인증번호 검증"""
    try:
        verified, reset_token, remaining, locked_until = await auth_service.verify_reset_code(
            request_data.email,
            request_data.code
        )

        return PasswordResetVerifyResponse(
            verified=verified,
            reset_token=reset_token,
            remaining_attempts=remaining,
            locked_until=locked_until.isoformat() if locked_until else None
        )
    except Exception as e:
        logger.error(f"[PASSWORD_RESET] 인증번호 검증 에러: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="인증번호 검증 중 오류가 발생했습니다"
        )


@router.post("/password-reset/confirm", response_model=PasswordResetResponse)
async def confirm_password_reset(
    request_data: PasswordResetConfirmSchema,
    auth_service: AuthService = Depends(get_auth_service)
):
    """새 비밀번호 설정"""
    try:
        success = await auth_service.confirm_password_reset(
            request_data.email,
            request_data.reset_token,
            request_data.new_password
        )

        if not success:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="비밀번호 변경에 실패했습니다. 다시 시도해주세요."
            )

        return PasswordResetResponse(message="비밀번호가 변경되었습니다.")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[PASSWORD_RESET] 비밀번호 변경 에러: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="비밀번호 변경 중 오류가 발생했습니다"
        )


# ========== 사업자등록번호로 이메일 찾기 ==========

def _check_find_email_rate_limit(ip: str) -> Tuple[bool, int]:
    """사업자등록번호 이메일 조회 Rate Limit 확인 (시간당 5회)"""
    attempts, first_attempt_time = _find_email_attempts[ip]
    limit_window = timedelta(hours=1)
    max_attempts = 5
    now = datetime.now(timezone.utc)

    if now - first_attempt_time > limit_window:
        _find_email_attempts[ip] = (1, now)
        return True, max_attempts - 1

    if attempts >= max_attempts:
        return False, 0

    _find_email_attempts[ip] = (attempts + 1, first_attempt_time)
    return True, max_attempts - attempts - 1


@router.post("/find-email", response_model=FindEmailByBusinessNumberResponse)
async def find_email_by_business_number(
    request_data: FindEmailByBusinessNumberRequest,
    request: Request,
    auth_service: AuthService = Depends(get_auth_service)
):
    """사업자등록번호로 이메일 조회"""
    client_ip = _get_client_ip(request)

    # Rate Limit 확인
    is_allowed, remaining = _check_find_email_rate_limit(client_ip)
    if not is_allowed:
        logger.warning(f"[FIND_EMAIL] Rate limit exceeded for IP: {client_ip[:10]}...")
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="너무 많은 요청입니다. 1시간 후에 다시 시도해주세요."
        )

    try:
        result = await auth_service.find_email_by_business_number(request_data.business_number)
        return FindEmailByBusinessNumberResponse(**result)
    except Exception as e:
        logger.error(f"[FIND_EMAIL] 이메일 조회 에러: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="이메일 조회 중 오류가 발생했습니다"
        )


@router.post("/password-reset/request-by-business-number", response_model=PasswordResetByBusinessNumberResponse)
async def request_password_reset_by_business_number(
    request_data: PasswordResetByBusinessNumberRequest,
    request: Request,
    auth_service: AuthService = Depends(get_auth_service)
):
    """사업자등록번호로 이메일을 찾아 인증번호 발송"""
    client_ip = _get_client_ip(request)

    # Rate Limit 확인 (비밀번호 재설정과 동일 제한)
    is_allowed, remaining = _check_reset_rate_limit(client_ip)
    if not is_allowed:
        logger.warning(f"[PASSWORD_RESET_BIZ] Rate limit exceeded for IP: {client_ip[:10]}...")
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="너무 많은 요청입니다. 1시간 후에 다시 시도해주세요."
        )

    try:
        result = await auth_service.request_password_reset_by_business_number(
            request_data.business_number
        )
        return PasswordResetByBusinessNumberResponse(**result)
    except Exception as e:
        logger.error(f"[PASSWORD_RESET_BIZ] 인증번호 요청 에러: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="인증번호 발송 중 오류가 발생했습니다"
        )
