# Vercel → Railway 백엔드 마이그레이션 가이드

## 개요

현재 Comings 프로젝트는 Vercel에서 프론트엔드와 백엔드가 함께 배포되어 있습니다.
이 문서는 백엔드를 Railway로 분리할 때 필요한 모든 변경 사항을 정리합니다.

---

## 현재 구조 (Vercel)

```
topUp/
├── api/
│   └── index.py          # Vercel serverless entry point
├── backend/
│   ├── main.py           # 로컬 개발용 entry point
│   ├── requirements.txt
│   └── app/
└── frontend/
    └── src/
        └── api/
            └── client.ts  # API_BASE_URL = '/api'
```

### Vercel 라우팅 (vercel.json)
- `/api/*` → `api/index.py` (백엔드)
- `/*` → `frontend/index.html` (프론트엔드 SPA)

### 현재 API 경로
| 엔드포인트 | Vercel (api/index.py) | Railway (main.py) |
|-----------|----------------------|-------------------|
| Swagger UI | `/api/docs` | `/docs` ⚠️ |
| OpenAPI JSON | `/api/openapi.json` | `/openapi.json` ⚠️ |
| Health Check | `/api/health` | `/health` |
| Auth | `/api/auth/*` | `/api/auth/*` ✅ |
| Customers | `/api/customers/*` | `/api/customers/*` ✅ |

> ⚠️ **문제**: Swagger UI 경로가 다릅니다. 수정 필요.

---

## 필수 변경 사항

### 1. backend/main.py 수정

**변경 전:**
```python
app = FastAPI(
    title="선결제 관리 플랫폼 커밍스 API",
    description="선결제(예치금) 관리를 위한 REST API - Comings",
    version="1.0.0",
)
```

**변경 후:**
```python
app = FastAPI(
    title="선결제 관리 플랫폼 커밍스 API",
    description="선결제(예치금) 관리를 위한 REST API - Comings",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)
```

> Vercel의 api/index.py와 동일한 경로를 사용하여 일관성 유지

---

### 2. backend/railway.toml 생성

```toml
[build]
builder = "nixpacks"

[deploy]
startCommand = "uvicorn main:app --host 0.0.0.0 --port $PORT"
healthcheckPath = "/health"
healthcheckTimeout = 100
restartPolicyType = "on_failure"
restartPolicyMaxRetries = 3
```

---

### 3. Railway 환경 변수 설정

Railway Variables 탭에서 설정 (RAW Editor로 붙여넣기 가능):

```env
# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_KEY=eyJhbG...
SUPABASE_SERVICE_KEY=eyJhbG...

# JWT
JWT_SECRET_KEY=your-jwt-secret-key

# App
APP_ENV=production
FRONTEND_URL=https://www.comings.co.kr
CORS_ORIGINS=https://www.comings.co.kr,https://comings.co.kr

# Email (Resend)
RESEND_API_KEY=re_xxx
RESEND_FROM_EMAIL=noreply@comings.co.kr
RESEND_FROM_NAME=커밍스

# Bot Protection (Cloudflare Turnstile)
TURNSTILE_SECRET_KEY=0x...

# NICE 본인인증
NICE_MODE=production
NICE_SITE_CODE=xxx
NICE_SITE_PW=xxx

# 국세청 API (선택)
NTS_API_KEY=xxx

# Sentry (선택)
SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
```

---

### 4. Railway 설정

| 설정 항목 | 값 |
|----------|-----|
| **Root Directory** | `backend` |
| **Watch Paths** | `/backend/**` (선택) |

---

### 5. Vercel 환경 변수 추가 (프론트엔드)

Railway 배포 완료 후, Vercel 프로젝트에 환경 변수 추가:

```env
VITE_API_URL=https://your-app.up.railway.app
```

또는 커스텀 도메인 사용 시:
```env
VITE_API_URL=https://api.comings.co.kr
```

> 프론트엔드의 [client.ts](../frontend/src/api/client.ts)가 이 환경 변수를 사용함

---

### 6. vercel.json 수정 (선택)

백엔드 완전 분리 후, API 라우팅 제거:

**변경 전:**
```json
{
  "builds": [
    { "src": "frontend/package.json", "use": "@vercel/static-build" },
    { "src": "api/index.py", "use": "@vercel/python" }
  ],
  "routes": [
    { "src": "/api/(.*)", "dest": "api/index.py" },
    { "src": "/(.*)", "dest": "frontend/index.html" }
  ]
}
```

**변경 후:**
```json
{
  "builds": [
    {
      "src": "frontend/package.json",
      "use": "@vercel/static-build",
      "config": { "distDir": "dist" }
    }
  ],
  "routes": [
    { "src": "/assets/(.*)", "dest": "frontend/assets/$1" },
    { "src": "/(.*)", "dest": "frontend/index.html" }
  ]
}
```

---

## 마이그레이션 체크리스트

### Railway 설정
- [ ] Railway 계정 생성/로그인
- [ ] GitHub 저장소 연결
- [ ] **Root Directory**: `backend` 설정
- [ ] 환경 변수 설정 (RAW Editor 사용)
- [ ] 배포 확인
- [ ] 도메인 설정 (선택)

### 코드 수정
- [ ] `backend/main.py`: docs_url, redoc_url, openapi_url 추가
- [ ] `backend/railway.toml`: 생성 완료 ✅

### Vercel (프론트엔드) 설정
- [ ] `VITE_API_URL` 환경 변수 추가
- [ ] 프론트엔드 재배포
- [ ] vercel.json에서 API 라우팅 제거 (선택)

### 검증
- [ ] Railway: `/health` 응답 확인
- [ ] Railway: `/api/docs` 접근 확인
- [ ] 프론트엔드: 로그인 테스트
- [ ] 프론트엔드: API 호출 정상 동작 확인

---

## 롤백 계획

문제 발생 시:
1. Vercel 환경 변수에서 `VITE_API_URL` 제거
2. 프론트엔드 재배포
3. 기존 Vercel API 자동 복구 (`/api/*` → `api/index.py`)

---

## 참고 파일

| 파일 | 설명 |
|------|------|
| [api/index.py](../api/index.py) | Vercel serverless entry point |
| [backend/main.py](../backend/main.py) | Railway entry point |
| [backend/railway.toml](../backend/railway.toml) | Railway 배포 설정 |
| [frontend/src/api/client.ts](../frontend/src/api/client.ts) | API 클라이언트 (VITE_API_URL 사용) |
| [vercel.json](../vercel.json) | Vercel 배포 설정 |
