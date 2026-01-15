"""
인증 API 라우터
이메일/비밀번호 로그인, PIN 관리 등
"""
import logging
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

# 디버그 로깅 설정
logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

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
)

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
    request: LoginRequest,
    auth_service: AuthService = Depends(get_auth_service)
):
    """이메일/비밀번호 로그인"""
    try:
        result = await auth_service.login(request.email, request.password)
        if not result:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="이메일 또는 비밀번호가 올바르지 않습니다"
            )
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
    result = admin_db.table("shops").select("id, name, email, created_at").eq("id", shop_id).maybe_single().execute()
    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="상점 정보를 찾을 수 없습니다"
        )
        
    return result.data
