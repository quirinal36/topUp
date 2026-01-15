# 프로젝트 개선 계획서 (Project Improvement Plan)

**생성일:** 2026-01-15
**프로젝트:** 카페 선결제 관리 시스템 (topUp)
**분석 범위:** 보안 취약점 + 성능 최적화

---

## 목차

1. [Executive Summary](#executive-summary)
2. [보안 취약점 분석](#보안-취약점-분석)
3. [성능 개선점 분석](#성능-개선점-분석)
4. [우선순위별 액션 플랜](#우선순위별-액션-플랜)
5. [에이전트 위임 계획](#에이전트-위임-계획)

---

## Executive Summary

### 전체 위험도 평가

| 영역 | 위험도 | 심각 이슈 | 높음 이슈 | 중간 이슈 |
|------|--------|-----------|-----------|-----------|
| **백엔드 보안** | HIGH | 4 | 6 | 7 |
| **프론트엔드 보안** | MEDIUM-HIGH | 3 | 4 | 3 |
| **성능** | HIGH | 4 | 7 | 9 |

### 즉시 조치 필요 항목 (CRITICAL)

1. **Wildcard CORS** - 모든 origin 허용 (CSRF 취약)
2. **Stack trace 노출** - 프로덕션에서 에러 상세 정보 노출
3. **Race condition** - 잔액 업데이트 시 동시성 문제
4. **JWT localStorage 저장** - XSS 공격에 취약

---

## 보안 취약점 분석

### CRITICAL (즉시 수정 필요)

#### 1. Wildcard CORS 설정
**파일:** `api/index.py:24`
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 모든 origin 허용
    allow_credentials=True,
)
```
**영향:** 악의적인 사이트에서 인증된 요청 수행 가능 (CSRF)
**해결:** 환경별 origin 화이트리스트 적용

#### 2. Stack Trace 노출
**파일:** `api/index.py:31-41`
```python
content={
    "detail": str(exc),
    "traceback": traceback.format_exc()  # 프로덕션에서 노출
}
```
**영향:** 내부 파일 경로, DB 연결 정보 노출
**해결:** 프로덕션에서는 일반 에러 메시지만 반환

#### 3. Race Condition (잔액 업데이트)
**파일:** `backend/app/routers/transactions.py:121-125`
```python
new_balance = customer.data["current_balance"] + total_amount
db.table("customers").update({"current_balance": new_balance})...
```
**영향:** 동시 요청 시 잔액 불일치 (이중 차감/충전)
**해결:** PostgreSQL atomic increment 사용

#### 4. Hardcoded Supabase URL
**파일:** `backend/.env.example:2`
```env
SUPABASE_URL=https://qvsmvvgvsklhkxryhxgv.supabase.co
```
**영향:** 공격자 대상 특정 가능
**해결:** 플레이스홀더로 교체, 키 로테이션

### HIGH (이번 주 내 수정)

| # | 취약점 | 파일 | 해결 방안 |
|---|--------|------|-----------|
| 5 | JWT 비밀키 검증 없음 | `config.py:19` | 32자 이상 강제 |
| 6 | DEBUG 로깅 활성화 | `auth.py:11` | 환경별 로그 레벨 |
| 7 | PIN 잠금 시간 1분 | `pin_service.py:14-15` | 15분으로 증가 |
| 8 | JWT 토큰 폐기 불가 | `auth_service.py:54-63` | 블랙리스트 구현 |
| 9 | SQL Injection 위험 | `customers.py:35` | 파라미터화 필터 |
| 10 | 타임존 불일치 | 여러 파일 | UTC 통일 |

### MEDIUM (이번 달 내 수정)

| # | 취약점 | 해결 방안 |
|---|--------|-----------|
| 11 | 인증 엔드포인트 Rate Limiting 없음 | slowapi 적용 |
| 12 | 비밀번호 정책 약함 | 12자+대문자+특수문자 |
| 13 | HTTPS 강제 없음 | HTTPSRedirectMiddleware |
| 14 | 요청 크기 제한 없음 | 1MB 제한 |
| 15 | 고객 삭제 시 거래 고아화 | 삭제 전 체크 |

### 프론트엔드 보안 이슈

| 심각도 | 이슈 | 파일 | 해결 방안 |
|--------|------|------|-----------|
| CRITICAL | JWT localStorage 저장 | `authStore.ts:32` | httpOnly 쿠키로 이전 |
| CRITICAL | 토큰 3중 저장 | `authStore.ts` | 단일 소스로 통합 |
| CRITICAL | CSRF 보호 없음 | `client.ts` | CSRF 토큰 구현 |
| HIGH | 토큰 만료 검증 없음 | `authStore.ts` | expiresAt 필드 추가 |
| HIGH | 에러 메시지 노출 | `Login.tsx:38` | 사용자 친화적 메시지 |
| MEDIUM | console.error 프로덕션 노출 | 여러 파일 | 환경 체크 추가 |

---

## 성능 개선점 분석

### CRITICAL (성능 킬러)

#### 1. N+1 쿼리 패턴 - 대시보드
**파일:** `backend/app/routers/dashboard.py:28-57`
```python
# 모든 고객 조회 → 모든 거래 조회
customers = db.table("customers").select("id").eq("shop_id", shop_id).execute()
transactions = db.table("transactions").in_("customer_id", customer_ids)...
```
**영향:** 고객 100명 + 거래 1000건 → 10초+ 응답 시간
**예상 개선:** SQL 집계 사용 시 80-90% 단축

#### 2. 데이터베이스 인덱스 누락
**필요한 인덱스:**
```sql
CREATE INDEX idx_customers_shop_id ON customers(shop_id);
CREATE INDEX idx_transactions_customer_id ON transactions(customer_id);
CREATE INDEX idx_transactions_created_at ON transactions(created_at DESC);
```
**예상 개선:** 쿼리 100-1000배 빠름

#### 3. 코드 스플리팅 없음
**파일:** `frontend/src/App.tsx:1-10`
```tsx
import Analytics from './pages/Analytics';  // Recharts 100KB 포함
```
**영향:** 초기 번들에 불필요한 코드 포함
**예상 개선:** 초기 로드 40-50% 단축

#### 4. useEffect 무한 루프 위험
**파일:** `frontend/src/components/customer/CustomerList.tsx:11-13`
```tsx
useEffect(() => {
  fetchCustomers();
}, [fetchCustomers]);  // 불안정한 참조
```
**영향:** 무한 API 호출 가능성

### HIGH (주요 병목)

| # | 이슈 | 파일 | 해결 방안 | 예상 효과 |
|---|------|------|-----------|-----------|
| 5 | 기간별 분석 N+1 | `dashboard.py:69-95` | SQL GROUP BY | 80% 빠름 |
| 6 | 거래 시 불필요한 조회 | `transactions.py:34-36` | JOIN 사용 | 50% 빠름 |
| 7 | Recharts 번들 크기 | `package.json` | lazy import | -100KB |
| 8 | 대시보드 이중 Effect | `Dashboard.tsx:51-62` | 통합 | API 호출 50% 감소 |
| 9 | 뮤테이션 후 전체 재조회 | `customerStore.ts:64-70` | 낙관적 업데이트 | 응답 80% 빠름 |

### MEDIUM (추가 최적화)

| # | 이슈 | 해결 방안 |
|---|------|-----------|
| 10 | Shop 정보 캐싱 없음 | Redis 5분 TTL |
| 11 | 요청 중복 제거 없음 | React Query 도입 |
| 12 | Vite 빌드 최적화 없음 | manualChunks 설정 |
| 13 | React.memo 없음 | 리스트 아이템 메모이제이션 |
| 14 | HTTP 캐싱 헤더 없음 | Cache-Control 추가 |

### 예상 성능 개선 효과

| 최적화 항목 | 로드 시간 | API 응답 | 번들 크기 |
|-------------|----------|----------|-----------|
| DB 인덱스 | - | **80-90% 빠름** | - |
| 코드 스플리팅 | **40-50% 빠름** | - | -45% |
| N+1 쿼리 수정 | - | **60-80% 빠름** | - |
| Vite 최적화 | 10-15% 빠름 | - | -20% |
| 요청 캐싱 | 20-30% 빠름 | 90% 캐시 히트 | - |

**종합 예상:** 초기 로드 50-60% 빠름, 대시보드 70-80% 빠름

---

## 우선순위별 액션 플랜

### Phase 1: IMMEDIATE (1주차) - Critical 수정

| 작업 | 예상 시간 | 담당 에이전트 |
|------|----------|--------------|
| Wildcard CORS 제거 | 1h | `sisyphus-junior` |
| Stack trace 숨김 | 1h | `sisyphus-junior` |
| Race condition 수정 | 4h | `sisyphus-junior-high` |
| DB 인덱스 추가 | 2h | `sisyphus-junior` |
| 코드 스플리팅 적용 | 4h | `frontend-engineer` |
| useEffect 의존성 수정 | 2h | `frontend-engineer-low` |

### Phase 2: SHORT-TERM (2-3주차) - High 수정

| 작업 | 예상 시간 | 담당 에이전트 |
|------|----------|--------------|
| JWT 토큰 httpOnly 쿠키 이전 | 8h | `sisyphus-junior-high` |
| PIN 잠금 시간 증가 | 1h | `sisyphus-junior-low` |
| Rate limiting 추가 | 4h | `sisyphus-junior` |
| N+1 쿼리 최적화 | 8h | `sisyphus-junior` |
| Vite 빌드 최적화 | 2h | `frontend-engineer-low` |
| 에러 메시지 정리 | 2h | `frontend-engineer-low` |

### Phase 3: MEDIUM-TERM (4주차+) - Medium 수정

| 작업 | 예상 시간 | 담당 에이전트 |
|------|----------|--------------|
| 비밀번호 정책 강화 | 2h | `sisyphus-junior-low` |
| HTTPS 강제 | 1h | `sisyphus-junior-low` |
| React Query 도입 | 16h | `frontend-engineer` |
| Redis 캐싱 구현 | 8h | `sisyphus-junior` |
| CSP 헤더 추가 | 2h | `frontend-engineer-low` |

---

## 에이전트 위임 계획

### 보안 작업

```
┌─────────────────────────────────────────────────────────────┐
│                    보안 취약점 수정                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [CRITICAL - Phase 1]                                       │
│  ├── CORS/Stack trace 수정 ──→ sisyphus-junior (2h)        │
│  ├── Race condition 수정 ────→ sisyphus-junior-high (4h)   │
│  └── Supabase URL 제거 ─────→ sisyphus-junior-low (0.5h)   │
│                                                             │
│  [HIGH - Phase 2]                                           │
│  ├── JWT httpOnly 이전 ─────→ sisyphus-junior-high (8h)    │
│  │   (백엔드 + 프론트엔드 동시 수정 필요)                     │
│  ├── Rate limiting ─────────→ sisyphus-junior (4h)         │
│  ├── PIN 보안 강화 ─────────→ sisyphus-junior-low (2h)     │
│  └── 타임존 UTC 통일 ───────→ sisyphus-junior (4h)         │
│                                                             │
│  [MEDIUM - Phase 3]                                         │
│  ├── 비밀번호 정책 ─────────→ sisyphus-junior-low (2h)     │
│  └── HTTPS/요청제한 ────────→ sisyphus-junior-low (2h)     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 성능 작업

```
┌─────────────────────────────────────────────────────────────┐
│                    성능 최적화                               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [백엔드 최적화]                                             │
│  ├── DB 인덱스 추가 ────────→ sisyphus-junior (2h)         │
│  ├── N+1 쿼리 수정 ─────────→ sisyphus-junior (8h)         │
│  └── Redis 캐싱 ────────────→ sisyphus-junior (8h)         │
│                                                             │
│  [프론트엔드 최적화]                                          │
│  ├── 코드 스플리팅 ─────────→ frontend-engineer (4h)       │
│  ├── useEffect 수정 ────────→ frontend-engineer-low (2h)   │
│  ├── Vite 빌드 최적화 ──────→ frontend-engineer-low (2h)   │
│  ├── 낙관적 업데이트 ───────→ frontend-engineer (4h)       │
│  └── React Query 도입 ──────→ frontend-engineer (16h)      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 에이전트 선택 기준

| 에이전트 | 모델 | 용도 | 사용 시점 |
|----------|------|------|-----------|
| `sisyphus-junior-low` | Haiku | 단순 수정 | 1-2개 파일, 명확한 변경 |
| `sisyphus-junior` | Sonnet | 표준 작업 | 3-5개 파일, 중간 복잡도 |
| `sisyphus-junior-high` | Opus | 복잡한 작업 | 아키텍처 변경, 다중 파일 |
| `frontend-engineer-low` | Haiku | UI 단순 수정 | 스타일, 단순 컴포넌트 |
| `frontend-engineer` | Sonnet | UI 표준 작업 | 컴포넌트 로직, 상태 관리 |
| `oracle` | Opus | 분석/디버깅 | 복잡한 문제 진단 |

---

## 예상 일정

```
Week 1: Critical 보안 + 성능 (14h)
├── Day 1-2: CORS, Stack trace, DB 인덱스
├── Day 3-4: Race condition 수정
└── Day 5: 코드 스플리팅, useEffect 수정

Week 2-3: High 우선순위 (26h)
├── JWT httpOnly 이전 (8h)
├── N+1 쿼리 최적화 (8h)
├── Rate limiting (4h)
├── PIN 보안 (2h)
└── Vite 최적화 + 에러 메시지 (4h)

Week 4+: Medium 우선순위 (30h)
├── React Query 도입 (16h)
├── Redis 캐싱 (8h)
└── 기타 보안 강화 (6h)
```

---

## 검증 체크리스트

### 보안 검증
- [ ] CORS: 허용된 origin만 접근 가능
- [ ] 에러: 프로덕션에서 stack trace 숨김
- [ ] 토큰: httpOnly 쿠키로 저장
- [ ] PIN: 5회 실패 시 15분 잠금
- [ ] Rate limit: 로그인 5회/분 제한

### 성능 검증
- [ ] 대시보드 로드: 2초 이내
- [ ] 고객 검색: 500ms 이내
- [ ] 초기 번들: 200KB 이내 (gzip)
- [ ] LCP: 2.5초 이내
- [ ] N+1 쿼리 없음 (DB 쿼리 모니터링)

---

## 참고 문서

- [OWASP Top 10](https://owasp.org/Top10/)
- [FastAPI Security](https://fastapi.tiangolo.com/tutorial/security/)
- [React Performance](https://react.dev/learn/thinking-in-react#step-4-identify-where-your-state-should-live)
- [Supabase Best Practices](https://supabase.com/docs/guides/database/best-practices)

---

**문서 작성:** Claude Sisyphus Orchestrator
**분석 에이전트:** oracle-medium (보안/성능 분석)
