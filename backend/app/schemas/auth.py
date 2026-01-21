"""
인증 관련 스키마
"""
import re
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, field_validator


class TokenResponse(BaseModel):
    """토큰 응답"""
    access_token: str
    refresh_token: Optional[str] = None
    token_type: str = "bearer"
    expires_in: int
    shop_id: Optional[str] = None
    initial_pin: Optional[str] = None  # 회원가입 시 초기 PIN
    pin_change_required: Optional[bool] = None  # PIN 변경 필요 여부


class RefreshTokenRequest(BaseModel):
    """토큰 갱신 요청"""
    refresh_token: str = Field(..., description="리프레시 토큰")


class LoginRequest(BaseModel):
    """로그인 요청"""
    username: str = Field(..., min_length=4, max_length=20, description="아이디")
    password: str = Field(..., min_length=8, description="비밀번호")

    @field_validator('username')
    @classmethod
    def validate_username(cls, v: str) -> str:
        if not re.match(r'^[a-z0-9]+$', v):
            raise ValueError('아이디는 영문 소문자와 숫자만 사용할 수 있습니다')
        return v.lower()


class RegisterRequest(BaseModel):
    """회원가입 요청"""
    username: str = Field(..., min_length=4, max_length=20, description="아이디 (영문 소문자 + 숫자)")
    password: str = Field(..., min_length=8, description="비밀번호 (8자 이상)")
    pin: str = Field(..., min_length=4, max_length=4, pattern=r"^\d{4}$", description="4자리 PIN 번호")
    email: Optional[str] = Field(None, description="비밀번호 재설정용 이메일 (선택)")
    shop_name: str = Field(..., min_length=1, max_length=100, description="상점명")
    verification_token: str = Field(..., description="본인인증 완료 토큰")
    turnstile_token: Optional[str] = Field(None, description="Cloudflare Turnstile 토큰")

    @field_validator('username')
    @classmethod
    def validate_username(cls, v: str) -> str:
        if not re.match(r'^[a-z0-9]+$', v):
            raise ValueError('아이디는 영문 소문자와 숫자만 사용할 수 있습니다')
        return v.lower()

    @field_validator('pin')
    @classmethod
    def validate_pin(cls, v: str) -> str:
        if not re.match(r'^\d{4}$', v):
            raise ValueError('PIN은 4자리 숫자여야 합니다')
        return v

    @field_validator('email')
    @classmethod
    def validate_email(cls, v: Optional[str]) -> Optional[str]:
        if v is None or v == '':
            return None
        email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        if not re.match(email_pattern, v):
            raise ValueError('올바른 이메일 형식이 아닙니다')
        return v.lower()

    @field_validator('password')
    @classmethod
    def validate_password(cls, v: str) -> str:
        if not any(c.isalpha() for c in v):
            raise ValueError('비밀번호는 영문을 포함해야 합니다')
        if not any(c.isdigit() for c in v):
            raise ValueError('비밀번호는 숫자를 포함해야 합니다')
        return v


class ShopResponse(BaseModel):
    """상점 응답"""
    id: str
    name: str
    username: Optional[str] = None
    email: Optional[str] = None
    business_number: Optional[str] = None
    onboarding_completed: bool = False
    created_at: str


# ========== 아이디 중복 확인 ==========

class UsernameCheckRequest(BaseModel):
    """아이디 중복 확인 요청"""
    username: str = Field(..., min_length=4, max_length=20, description="확인할 아이디")

    @field_validator('username')
    @classmethod
    def validate_username(cls, v: str) -> str:
        if not re.match(r'^[a-z0-9]+$', v):
            raise ValueError('아이디는 영문 소문자와 숫자만 사용할 수 있습니다')
        return v.lower()


class UsernameCheckResponse(BaseModel):
    """아이디 중복 확인 응답"""
    available: bool
    message: str


# ========== NICE 본인인증 ==========

class NiceAuthStartResponse(BaseModel):
    """본인인증 시작 응답"""
    request_id: str
    enc_data: str  # NICE 요청 데이터 (암호화)
    mock_mode: bool = False  # 모킹 모드 여부


class NiceAuthCompleteRequest(BaseModel):
    """본인인증 완료 요청"""
    request_id: str
    enc_data: str  # NICE 응답 데이터


class NiceAuthCompleteResponse(BaseModel):
    """본인인증 완료 응답"""
    verification_token: str  # 10분 유효 임시 토큰
    expires_at: datetime


class PinVerifyRequest(BaseModel):
    """PIN 검증 요청"""
    pin: str = Field(..., min_length=4, max_length=4, pattern=r"^\d{4}$")


class PinVerifyResponse(BaseModel):
    """PIN 검증 응답"""
    verified: bool
    remaining_attempts: Optional[int] = None
    locked_until: Optional[str] = None


class PinChangeRequest(BaseModel):
    """PIN 변경 요청"""
    current_pin: str = Field(..., min_length=4, max_length=4, pattern=r"^\d{4}$")
    new_pin: str = Field(..., min_length=4, max_length=4, pattern=r"^\d{4}$")


class ShopUpdateRequest(BaseModel):
    """상점 정보 수정 요청"""
    name: str = Field(..., min_length=1, max_length=100, description="상점명")


# ========== 비밀번호 재설정 스키마 ==========

class PasswordResetRequestSchema(BaseModel):
    """비밀번호 재설정 요청 (인증번호 발송)"""
    email: str = Field(..., description="가입된 이메일")

    @field_validator('email')
    @classmethod
    def validate_email(cls, v: str) -> str:
        email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        if not re.match(email_pattern, v):
            raise ValueError('올바른 이메일 형식이 아닙니다')
        return v.lower()


class PasswordResetVerifySchema(BaseModel):
    """인증번호 검증 요청"""
    email: str = Field(..., description="이메일")
    code: str = Field(..., min_length=6, max_length=6, pattern=r"^\d{6}$", description="6자리 인증번호")

    @field_validator('email')
    @classmethod
    def validate_email(cls, v: str) -> str:
        email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        if not re.match(email_pattern, v):
            raise ValueError('올바른 이메일 형식이 아닙니다')
        return v.lower()


class PasswordResetConfirmSchema(BaseModel):
    """새 비밀번호 설정 요청"""
    email: str = Field(..., description="이메일")
    reset_token: str = Field(..., description="재설정 토큰")
    new_password: str = Field(..., min_length=8, description="새 비밀번호 (8자 이상)")

    @field_validator('email')
    @classmethod
    def validate_email(cls, v: str) -> str:
        email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        if not re.match(email_pattern, v):
            raise ValueError('올바른 이메일 형식이 아닙니다')
        return v.lower()

    @field_validator('new_password')
    @classmethod
    def validate_password(cls, v: str) -> str:
        if not any(c.isalpha() for c in v):
            raise ValueError('비밀번호는 영문을 포함해야 합니다')
        if not any(c.isdigit() for c in v):
            raise ValueError('비밀번호는 숫자를 포함해야 합니다')
        return v


class PasswordResetResponse(BaseModel):
    """비밀번호 재설정 응답"""
    message: str
    expires_in: Optional[int] = None


class PasswordResetVerifyResponse(BaseModel):
    """인증번호 검증 응답"""
    verified: bool
    reset_token: Optional[str] = None
    remaining_attempts: Optional[int] = None
    locked_until: Optional[str] = None
