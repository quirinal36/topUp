# NICE 본인인증 연동 및 아이디 기반 회원가입 전환

## Context

### Original Request
회원가입 시 NICE 평가정보 본인인증 단계를 추가하고, 이메일 기반에서 아이디(username) 기반 인증으로 전환

### Interview Summary
| 항목 | 결정 사항 |
|------|----------|
| NICE 계약 상태 | 미계약 → 구조 설계 및 모킹 구현 |
| 저장 정보 | CI 값만 저장 (중복가입 방지) |
| 아이디 정책 | 영문 소문자 + 숫자, 4~20자 |
| 기존 계정 | 없음 (신규 서비스) |
| 소셜 로그인 | 완전 제거 |
| Turnstile | 유지 |
| 본인인증 시점 | 상점 정보 입력 후, 최종 등록 전 |

### Architecture Decisions

**1. NICE 연동 추상화**
```
NiceAuthService (Protocol)
├── MockNiceAuthService  # 개발/테스트용
└── RealNiceAuthService  # 프로덕션용 (나중에 구현)
```
- 환경변수 `NICE_MODE=mock|production`으로 전환

**2. CI 저장 방식**
- `shops.ci` VARCHAR UNIQUE 컬럼 추가
- NICE에서 받은 CI 값 그대로 저장 (이미 해시된 값)

**3. 회원가입 세션 관리**
- 프론트엔드 Zustand로 멀티스텝 상태 관리
- 본인인증 완료 시 서버에서 임시 토큰 발급 (10분 유효)
- 최종 가입 시 임시 토큰 검증

---

## Work Objectives

### Core Objective
이메일 기반 인증에서 아이디 + NICE 본인인증 기반으로 전환하여, 실명 인증된 사용자만 서비스 이용 가능하도록 함

### Deliverables
1. 아이디 기반 로그인/회원가입 시스템
2. NICE 본인인증 연동 구조 (모킹 포함)
3. 멀티스텝 회원가입 UI
4. 소셜 로그인 코드 제거

### Definition of Done
- [ ] 아이디/비밀번호로 로그인 가능
- [ ] 4단계 회원가입 플로우 동작 (아이디 → 상점정보 → 본인인증 → 완료)
- [ ] 모킹 환경에서 본인인증 플로우 테스트 가능
- [ ] 동일 CI로 중복 가입 시 에러 발생
- [ ] 소셜 로그인 관련 코드 완전 제거
- [ ] Turnstile 봇 방지 유지

---

## Guardrails

### Must Have
- 아이디 유효성 검증 (영문 소문자 + 숫자, 4~20자)
- 아이디 중복 확인 기능
- NICE 모킹 모드 (개발/테스트용)
- CI 기반 중복 가입 방지
- 본인인증 세션 만료 처리 (10분)
- Turnstile 봇 방지

### Must NOT Have
- 이메일 기반 로그인 (완전 제거)
- 소셜 로그인 (완전 제거)
- 실제 NICE API 연동 (계약 전이므로 모킹만)
- 본인인증 정보 중 CI 외 다른 정보 저장

---

## Task Flow

```
Phase 1: Database
    └── 1.1 shops 테이블 스키마 변경

Phase 2: Backend Core
    ├── 2.1 모델/스키마 수정
    ├── 2.2 NICE 서비스 구현 (모킹)
    └── 2.3 인증 라우터 수정

Phase 3: Frontend
    ├── 3.1 멀티스텝 회원가입 컴포넌트
    ├── 3.2 로그인 페이지 수정
    └── 3.3 API 클라이언트 수정

Phase 4: Cleanup
    ├── 4.1 소셜 로그인 코드 제거
    └── 4.2 환경변수 정리
```

---

## Detailed TODOs

### Phase 1: Database Migration

#### TODO 1.1: shops 테이블 스키마 변경
**Priority:** Critical | **Estimate:** 30분

**Changes:**
```sql
-- 1. email 컬럼을 username으로 변경
ALTER TABLE shops RENAME COLUMN email TO username;

-- 2. username 제약조건 추가
ALTER TABLE shops ADD CONSTRAINT username_format
  CHECK (username ~ '^[a-z0-9]{4,20}$');

-- 3. CI 컬럼 추가
ALTER TABLE shops ADD COLUMN ci VARCHAR(88) UNIQUE;

-- 4. CI 컬럼 NOT NULL은 나중에 (기존 데이터 없으므로 바로 가능)
-- 신규 서비스이므로 바로 NOT NULL 가능
ALTER TABLE shops ALTER COLUMN ci SET NOT NULL;
```

**Files:**
- Supabase 마이그레이션 또는 MCP 도구로 실행

**Acceptance Criteria:**
- [ ] username 컬럼으로 변경됨
- [ ] username 형식 제약조건 동작
- [ ] ci 컬럼 추가 및 UNIQUE 제약조건 동작

---

### Phase 2: Backend Core

#### TODO 2.1: 모델 및 스키마 수정
**Priority:** Critical | **Estimate:** 45분

**Files to Modify:**

**`backend/app/models/shop.py`**
```python
# 변경: email → username
class Shop(BaseModel):
    id: UUID
    username: str  # 변경
    name: str
    ci: str  # 추가
    # ... 나머지 동일
```

**`backend/app/schemas/auth.py`**
```python
# 회원가입 요청 스키마 수정
class RegisterRequest(BaseModel):
    username: str = Field(..., min_length=4, max_length=20, pattern=r'^[a-z0-9]+$')
    password: str = Field(..., min_length=8)
    name: str  # 상점명
    verification_token: str  # 본인인증 완료 토큰

# 로그인 요청 스키마 수정
class LoginRequest(BaseModel):
    username: str
    password: str
    turnstile_token: str

# 아이디 중복 확인
class UsernameCheckRequest(BaseModel):
    username: str = Field(..., min_length=4, max_length=20, pattern=r'^[a-z0-9]+$')

class UsernameCheckResponse(BaseModel):
    available: bool
    message: str

# 본인인증 관련
class NiceAuthStartResponse(BaseModel):
    request_id: str
    enc_data: str  # NICE 요청 데이터 (암호화)
    # 모킹 모드에서는 더미 데이터

class NiceAuthCompleteRequest(BaseModel):
    request_id: str
    enc_data: str  # NICE 응답 데이터

class NiceAuthCompleteResponse(BaseModel):
    verification_token: str  # 10분 유효 임시 토큰
    expires_at: datetime
```

**Acceptance Criteria:**
- [ ] Shop 모델에 username, ci 필드 존재
- [ ] 스키마 유효성 검증 동작 (아이디 형식)
- [ ] 본인인증 관련 스키마 정의됨

---

#### TODO 2.2: NICE 본인인증 서비스 구현
**Priority:** Critical | **Estimate:** 1시간

**New File: `backend/app/services/nice_service.py`**
```python
from abc import ABC, abstractmethod
from typing import Protocol
import secrets
import hashlib
from datetime import datetime, timedelta
from ..config import settings

class NiceAuthResult:
    success: bool
    ci: str | None
    name: str | None
    error_message: str | None

class NiceAuthServiceProtocol(Protocol):
    def start_auth(self, request_id: str) -> dict:
        """인증 시작 - 암호화된 요청 데이터 반환"""
        ...

    def complete_auth(self, request_id: str, enc_data: str) -> NiceAuthResult:
        """인증 완료 - CI 값 추출"""
        ...

class MockNiceAuthService:
    """개발/테스트용 모킹 서비스"""

    def __init__(self):
        self._pending_requests: dict[str, dict] = {}

    def start_auth(self, request_id: str) -> dict:
        self._pending_requests[request_id] = {
            "created_at": datetime.utcnow(),
            "status": "pending"
        }
        return {
            "request_id": request_id,
            "enc_data": "MOCK_ENC_DATA_" + request_id,
            "mock_mode": True
        }

    def complete_auth(self, request_id: str, enc_data: str) -> NiceAuthResult:
        # 모킹: 항상 성공, 랜덤 CI 생성
        mock_ci = hashlib.sha256(
            f"mock_ci_{request_id}_{secrets.token_hex(8)}".encode()
        ).hexdigest()

        return NiceAuthResult(
            success=True,
            ci=mock_ci,
            name="테스트사용자",
            error_message=None
        )

class RealNiceAuthService:
    """실제 NICE API 연동 (나중에 구현)"""

    def __init__(self, site_code: str, site_pw: str):
        self.site_code = site_code
        self.site_pw = site_pw

    def start_auth(self, request_id: str) -> dict:
        # TODO: 실제 NICE API 호출
        raise NotImplementedError("NICE 계약 후 구현 예정")

    def complete_auth(self, request_id: str, enc_data: str) -> NiceAuthResult:
        # TODO: 실제 NICE 응답 파싱
        raise NotImplementedError("NICE 계약 후 구현 예정")

def get_nice_service() -> NiceAuthServiceProtocol:
    """환경변수에 따라 서비스 인스턴스 반환"""
    if settings.NICE_MODE == "production":
        return RealNiceAuthService(
            site_code=settings.NICE_SITE_CODE,
            site_pw=settings.NICE_SITE_PW
        )
    return MockNiceAuthService()
```

**`backend/app/config.py` 추가:**
```python
# NICE 설정
NICE_MODE: str = "mock"  # mock | production
NICE_SITE_CODE: str = ""
NICE_SITE_PW: str = ""
```

**Acceptance Criteria:**
- [ ] MockNiceAuthService가 정상 동작
- [ ] 환경변수로 모드 전환 가능
- [ ] RealNiceAuthService는 NotImplementedError 발생

---

#### TODO 2.3: 인증 라우터 수정
**Priority:** Critical | **Estimate:** 1.5시간

**File: `backend/app/routers/auth.py`**

**제거할 엔드포인트:**
- `POST /api/auth/naver/callback`
- `POST /api/auth/kakao/callback`
- `GET /api/auth/naver/url`
- `GET /api/auth/kakao/url`

**수정할 엔드포인트:**

```python
# 로그인 - 이메일 → 아이디
@router.post("/login")
async def login(request: LoginRequest):
    # 1. Turnstile 검증
    # 2. username으로 shop 조회
    # 3. 비밀번호 검증
    # 4. JWT 발급

# 회원가입 - 본인인증 토큰 검증 추가
@router.post("/register")
async def register(request: RegisterRequest):
    # 1. Turnstile 검증
    # 2. verification_token 검증 (CI 추출)
    # 3. CI 중복 확인
    # 4. username 중복 확인
    # 5. shop 생성 (username, ci 포함)
    # 6. JWT 발급
```

**추가할 엔드포인트:**

```python
# 아이디 중복 확인
@router.post("/check-username")
async def check_username(request: UsernameCheckRequest):
    exists = await shop_exists_by_username(request.username)
    return UsernameCheckResponse(
        available=not exists,
        message="사용 가능한 아이디입니다." if not exists else "이미 사용 중인 아이디입니다."
    )

# 본인인증 시작
@router.post("/nice/start")
async def nice_auth_start():
    request_id = secrets.token_urlsafe(32)
    nice_service = get_nice_service()
    result = nice_service.start_auth(request_id)
    return NiceAuthStartResponse(**result)

# 본인인증 완료
@router.post("/nice/complete")
async def nice_auth_complete(request: NiceAuthCompleteRequest):
    nice_service = get_nice_service()
    result = nice_service.complete_auth(request.request_id, request.enc_data)

    if not result.success:
        raise HTTPException(400, result.error_message)

    # CI 중복 확인
    if await shop_exists_by_ci(result.ci):
        raise HTTPException(409, "이미 가입된 정보입니다.")

    # 임시 토큰 발급 (CI 포함, 10분 유효)
    verification_token = create_verification_token(result.ci)

    return NiceAuthCompleteResponse(
        verification_token=verification_token,
        expires_at=datetime.utcnow() + timedelta(minutes=10)
    )
```

**`backend/app/services/auth_service.py` 추가:**
```python
def create_verification_token(ci: str) -> str:
    """본인인증 완료 임시 토큰 생성"""
    payload = {
        "ci": ci,
        "type": "verification",
        "exp": datetime.utcnow() + timedelta(minutes=10)
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm="HS256")

def verify_verification_token(token: str) -> str:
    """임시 토큰 검증 후 CI 반환"""
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=["HS256"])
        if payload.get("type") != "verification":
            raise ValueError("Invalid token type")
        return payload["ci"]
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "본인인증이 만료되었습니다. 다시 인증해주세요.")
```

**Acceptance Criteria:**
- [ ] 소셜 로그인 엔드포인트 제거됨
- [ ] 아이디 중복 확인 API 동작
- [ ] 본인인증 시작/완료 API 동작
- [ ] 회원가입 시 verification_token 검증
- [ ] CI 중복 시 409 에러 반환

---

### Phase 3: Frontend

#### TODO 3.1: 멀티스텝 회원가입 컴포넌트
**Priority:** Critical | **Estimate:** 2시간

**New/Modified Files:**

**`frontend/src/pages/Register.tsx`** (전체 재구성)
```typescript
// 4단계 회원가입 플로우
// Step 1: 아이디/비밀번호 입력
// Step 2: 상점 정보 입력
// Step 3: NICE 본인인증
// Step 4: 완료 (자동 로그인)
```

**`frontend/src/stores/registerStore.ts`** (신규)
```typescript
interface RegisterState {
  step: 1 | 2 | 3 | 4;
  username: string;
  password: string;
  shopName: string;
  verificationToken: string | null;

  setStep: (step: number) => void;
  setCredentials: (username: string, password: string) => void;
  setShopInfo: (name: string) => void;
  setVerificationToken: (token: string) => void;
  reset: () => void;
}
```

**컴포넌트 구조:**
```
Register.tsx
├── RegisterStep1.tsx  # 아이디/비밀번호
├── RegisterStep2.tsx  # 상점 정보
├── RegisterStep3.tsx  # NICE 본인인증
└── RegisterStep4.tsx  # 완료
```

**Step 1 주요 기능:**
- 아이디 입력 (실시간 유효성 검증)
- 중복 확인 버튼
- 비밀번호/비밀번호 확인

**Step 2 주요 기능:**
- 상점명 입력
- (추후 확장 가능)

**Step 3 주요 기능:**
- NICE 본인인증 시작 버튼
- 팝업/리다이렉트 처리
- 인증 완료 콜백 처리

**Step 4 주요 기능:**
- Turnstile 검증
- 최종 회원가입 API 호출
- 성공 시 자동 로그인

**Acceptance Criteria:**
- [ ] 4단계 플로우 정상 동작
- [ ] 각 단계 유효성 검증
- [ ] 이전 단계로 돌아가기 가능 (Step 3 이후 불가)
- [ ] 새로고침 시 처음부터 시작

---

#### TODO 3.2: 로그인 페이지 수정
**Priority:** High | **Estimate:** 30분

**File: `frontend/src/pages/Login.tsx`**

**Changes:**
- 이메일 입력 → 아이디 입력
- 소셜 로그인 버튼 제거
- placeholder: "아이디를 입력하세요"
- label: "아이디"

**Acceptance Criteria:**
- [ ] 아이디로 로그인 가능
- [ ] 소셜 로그인 버튼 없음

---

#### TODO 3.3: API 클라이언트 수정
**Priority:** High | **Estimate:** 30분

**File: `frontend/src/api/auth.ts`**

**제거:**
- `getNaverLoginUrl()`
- `getKakaoLoginUrl()`
- `naverCallback()`
- `kakaoCallback()`

**수정:**
```typescript
// 로그인
export const login = (username: string, password: string, turnstileToken: string) =>
  api.post('/auth/login', { username, password, turnstile_token: turnstileToken });

// 회원가입
export const register = (data: {
  username: string;
  password: string;
  name: string;
  verification_token: string;
  turnstile_token: string;
}) => api.post('/auth/register', data);
```

**추가:**
```typescript
// 아이디 중복 확인
export const checkUsername = (username: string) =>
  api.post('/auth/check-username', { username });

// 본인인증 시작
export const startNiceAuth = () =>
  api.post('/auth/nice/start');

// 본인인증 완료
export const completeNiceAuth = (requestId: string, encData: string) =>
  api.post('/auth/nice/complete', { request_id: requestId, enc_data: encData });
```

**Acceptance Criteria:**
- [ ] 소셜 로그인 관련 함수 제거됨
- [ ] 새 API 함수들 정상 동작

---

### Phase 4: Cleanup

#### TODO 4.1: 소셜 로그인 코드 완전 제거
**Priority:** Medium | **Estimate:** 30분

**Backend 제거 대상:**
- `backend/app/routers/auth.py` 내 소셜 로그인 핸들러
- `backend/app/services/` 내 소셜 관련 서비스 (있다면)

**Frontend 제거 대상:**
- 소셜 로그인 버튼 컴포넌트
- OAuth 콜백 페이지 (있다면)
- 관련 타입 정의

**Acceptance Criteria:**
- [ ] 소셜 로그인 관련 코드 0줄
- [ ] 빌드 에러 없음

---

#### TODO 4.2: 환경변수 정리
**Priority:** Medium | **Estimate:** 15분

**제거할 환경변수:**
- `NAVER_CLIENT_ID`
- `NAVER_CLIENT_SECRET`
- `KAKAO_CLIENT_ID`
- `KAKAO_CLIENT_SECRET`

**추가할 환경변수:**
- `NICE_MODE=mock`
- `NICE_SITE_CODE=` (나중에 설정)
- `NICE_SITE_PW=` (나중에 설정)

**Files:**
- `.env.example` 업데이트
- `backend/app/config.py` 업데이트
- `CLAUDE.md` 환경변수 섹션 업데이트

**Acceptance Criteria:**
- [ ] 소셜 로그인 환경변수 제거됨
- [ ] NICE 환경변수 추가됨
- [ ] 문서 업데이트됨

---

## Commit Strategy

| Phase | Commit Message |
|-------|----------------|
| 1 | `chore(db): migrate email to username and add ci column` |
| 2.1 | `refactor(backend): update shop model and auth schemas for username-based auth` |
| 2.2 | `feat(backend): implement NICE auth service with mock mode` |
| 2.3 | `feat(backend): add username check and NICE auth endpoints` |
| 3.1 | `feat(frontend): implement multi-step registration with NICE auth` |
| 3.2 | `refactor(frontend): update login page for username-based auth` |
| 3.3 | `refactor(frontend): update auth API client` |
| 4.1 | `chore: remove social login code` |
| 4.2 | `chore: update environment variables for NICE integration` |

---

## Success Criteria

### Functional
- [ ] 아이디 `cafeowner1` 형식으로 회원가입 가능
- [ ] 4단계 회원가입 플로우 정상 동작
- [ ] 모킹 환경에서 본인인증 테스트 가능
- [ ] 동일 CI 중복 가입 시 에러
- [ ] 아이디 중복 확인 동작
- [ ] 본인인증 세션 10분 후 만료

### Non-Functional
- [ ] 소셜 로그인 코드 완전 제거
- [ ] Turnstile 봇 방지 유지
- [ ] 에러 메시지 한글화
- [ ] 빌드 성공

### Security
- [ ] CI 값 외 개인정보 미저장
- [ ] verification_token 10분 만료
- [ ] SQL Injection 방지 (파라미터화 쿼리)

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| NICE 계약 지연 | 모킹 모드로 개발 완료, 실제 연동은 나중에 |
| 멀티스텝 상태 유실 | 명확한 UX로 안내 (새로고침 시 처음부터) |
| CI 중복 판단 오류 | UNIQUE 제약조건으로 DB 레벨 보장 |

---

## Next Steps

계획이 완료되었습니다. 구현을 시작하려면:

```
/start-work nice-auth-integration
```

또는 특정 Phase부터 시작하려면:

```
/start-work nice-auth-integration --phase 2
```
