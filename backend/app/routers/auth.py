"""
인증 API 라우터
이메일/비밀번호 로그인, PIN 관리 등
"""
import logging
import os
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
)


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
    return shop_id


@router.post("/login", response_model=TokenResponse)
async def login(
    login_request: LoginRequest,
    request: Request,
    auth_service: AuthService = Depends(get_auth_service)
):
    """이메일/비밀번호 로그인 (Rate Limiting 적용)"""
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
        result = await auth_service.login(login_request.email, login_request.password)
        if not result:
            _record_login_attempt(client_ip, success=False)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="이메일 또는 비밀번호가 올바르지 않습니다"
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
    request: RegisterRequest,
    auth_service: AuthService = Depends(get_auth_service)
):
    """회원가입"""
    try:
        result = await auth_service.register(
            request.email,
            request.password,
            request.shop_name
        )
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


@router.get("/me", response_model=ShopResponse)
async def get_current_shop_info(
    shop_id: str = Depends(get_current_shop)
):
    """현재 로그인된 상점 정보 조회"""
    admin_db = get_supabase_admin_client()
    result = admin_db.table("shops").select(
        "id, name, email, business_number, onboarding_completed, created_at"
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
        "updated_at": datetime.now(timezone.utc).isoformat()
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
        # 보안: 에러가 발생해도 동일 응답
        return PasswordResetResponse(
            message="인증번호가 발송되었습니다. 이메일을 확인해주세요.",
            expires_in=600
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
