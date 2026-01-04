"""
인증 API 라우터
소셜 로그인, PIN 관리 등
"""
import logging
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional

# 디버그 로깅 설정
logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

from ..database import get_db
from ..services.auth_service import AuthService
from ..services.pin_service import PinService
from ..schemas.auth import (
    TokenResponse,
    ShopCreate,
    ShopResponse,
    PinVerifyRequest,
    PinVerifyResponse,
    PinChangeRequest,
    SocialLoginRequest,
    SocialAccountLink
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


@router.post("/login/{provider}", response_model=TokenResponse)
async def social_login(
    provider: str,
    request: SocialLoginRequest,
    auth_service: AuthService = Depends(get_auth_service)
):
    """
    소셜 로그인
    - provider: naver 또는 kakao
    """
    try:
        result = await auth_service.social_login(provider, request.code)
        if not result:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="소셜 로그인에 실패했습니다. 인증 코드가 만료되었거나 redirect_uri가 일치하지 않을 수 있습니다."
            )
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[LOGIN] 소셜 로그인 에러: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"소셜 로그인 처리 중 오류가 발생했습니다: {str(e)}"
        )


@router.get("/debug/env")
async def debug_env():
    """환경변수 디버그 (임시)"""
    import os
    return {
        "NAVER_REDIRECT_URI": os.environ.get("NAVER_REDIRECT_URI", "NOT_SET"),
        "naver_redirect_uri_lower": os.environ.get("naver_redirect_uri", "NOT_SET"),
    }


@router.get("/login/{provider}/url")
async def get_login_url(provider: str):
    """소셜 로그인 URL 반환"""
    from ..config import get_settings
    settings = get_settings()

    if provider.lower() == "naver":
        url = (
            f"https://nid.naver.com/oauth2.0/authorize"
            f"?client_id={settings.naver_client_id}"
            f"&redirect_uri={settings.naver_redirect_uri}"
            f"&response_type=code"
            f"&state=naver"
        )
    elif provider.lower() == "kakao":
        url = (
            f"https://kauth.kakao.com/oauth/authorize"
            f"?client_id={settings.kakao_client_id}"
            f"&redirect_uri={settings.kakao_redirect_uri}"
            f"&response_type=code"
        )
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="지원하지 않는 소셜 로그인입니다"
        )

    return {"url": url}


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
    """PIN 재설정 (소셜 로그인 재인증 후)"""
    success = await pin_service.reset_pin(shop_id, request.pin)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="PIN 재설정에 실패했습니다"
        )
    return {"message": "PIN이 재설정되었습니다"}


@router.post("/link/{provider}")
async def link_social_account(
    provider: str,
    request: SocialLoginRequest,
    shop_id: str = Depends(get_current_shop),
    auth_service: AuthService = Depends(get_auth_service)
):
    """추가 소셜 계정 연동"""
    success = await auth_service.link_social_account(shop_id, provider, request.code)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="소셜 계정 연동에 실패했습니다. 이미 다른 상점에 연동된 계정일 수 있습니다."
        )
    return {"message": "소셜 계정이 연동되었습니다"}


@router.get("/me")
async def get_current_shop_info(
    shop_id: str = Depends(get_current_shop),
    db=Depends(get_db)
):
    """현재 로그인된 상점 정보 조회"""
    result = db.table("shops").select("id, name, created_at").eq("id", shop_id).single().execute()
    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="상점 정보를 찾을 수 없습니다"
        )
    return result.data


@router.get("/social-accounts")
async def get_linked_social_accounts(
    shop_id: str = Depends(get_current_shop),
    db=Depends(get_db)
):
    """연동된 소셜 계정 목록 조회"""
    result = db.table("social_accounts").select(
        "provider, email, is_primary, created_at"
    ).eq("shop_id", shop_id).execute()

    return [
        SocialAccountLink(
            provider=acc["provider"],
            email=acc.get("email"),
            is_primary=acc["is_primary"],
            linked_at=acc["created_at"]
        )
        for acc in result.data
    ]
