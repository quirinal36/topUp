# Comings (커밍스) 개선 로드맵

**작성일:** 2026-01-18
**목적:** 미완료 Jira 이슈 완료를 위한 구체적 실행 계획

---

## 1. 현황 요약

### 완료된 작업 (2026-01-18)
| Jira Key | Summary | 비고 |
|----------|---------|------|
| TOP-36 | 데이터베이스 인덱스 추가 | ✅ 마이그레이션 완료 |
| TOP-43 | Race Condition 테스트 및 수정 | ✅ RPC 함수 적용 |
| TOP-44 | 부하 테스트 인프라 구축 | ✅ Locust 설정 완료 |
| TOP-45 | 데이터베이스 성능 최적화 | ✅ 인덱스/제약조건 추가 |

### 미완료 작업 현황

| Epic | 하위 작업 수 | 우선순위 |
|------|-------------|----------|
| TOP-6 (보안 강화) | 4개 | High |
| TOP-7 (기능 보완) | 4개 | Medium |
| TOP-25 (온보딩 워크플로우) | 3개 | Medium |
| TOP-30 (보안 취약점 개선) | 2개 | High |
| TOP-31 (성능 최적화 개선) | 4개 | High |

---

## 2. 스프린트별 실행 계획

### Sprint A: 보안 강화 (우선순위 High) - 예상 2주

#### Phase 1: 핵심 보안 (TOP-30 하위 + TOP-6 하위)

| 순서 | Jira Key | Summary | 작업 내용 | 예상 시간 |
|------|----------|---------|-----------|-----------|
| 1 | TOP-39 | JWT 토큰 폐기 + 타임존 통일 | - jti claim 추가<br>- 토큰 블랙리스트 테이블<br>- datetime.now(timezone.utc) 통일 | 6h |
| 2 | TOP-42 | 비밀번호 정책 강화 | - 12자 이상 + 대문자 + 특수문자<br>- HTTPSRedirectMiddleware | 3h |
| 3 | TOP-11 | PIN 검증 UI 모달 | - PinVerifyModal 컴포넌트<br>- usePinVerify 훅<br>- 민감 작업에 적용 | 5h |
| 4 | TOP-12 | 최초 로그인 PIN 설정 강제 | - PIN 미설정 시 리다이렉트<br>- ProtectedRoute 수정 | 3h |
| 5 | TOP-13 | 거래 확인 다이얼로그 | - ConfirmDialog 컴포넌트<br>- 차감/취소 시 확인 팝업 | 2h |
| 6 | TOP-14 | 토스트 알림 시스템 | - Toast 컴포넌트<br>- ToastProvider 컨텍스트<br>- useToast 훅 | 3h |

**Phase 1 총 예상 시간: 22시간**

---

### Sprint B: 성능 최적화 (TOP-31 하위) - 예상 1.5주

| 순서 | Jira Key | Summary | 작업 내용 | 예상 시간 |
|------|----------|---------|-----------|-----------|
| 1 | TOP-37 | N+1 쿼리 최적화 | - 대시보드 SQL GROUP BY 집계<br>- RPC 함수로 최적화 | 8h |
| 2 | TOP-38 | 코드 스플리팅 + useEffect 수정 | - React.lazy() 적용<br>- Suspense 래핑<br>- useCallback 메모이제이션 | 6h |
| 3 | TOP-40 | Vite 빌드 최적화 | - manualChunks 설정<br>- terser 적용<br>- 낙관적 업데이트 | 6h |
| 4 | TOP-41 | React Query + Redis (선택) | - TanStack Query 도입<br>- 캐시/중복 제거 | 16h |

**Sprint B 총 예상 시간: 36시간 (TOP-41 포함 시)**

---

### Sprint C: 기능 보완 (TOP-7 하위) - 예상 1주

| 순서 | Jira Key | Summary | 작업 내용 | 예상 시간 |
|------|----------|---------|-----------|-----------|
| 1 | TOP-16 | 상점 프로필 수정 | - PUT /api/shops/profile API<br>- 설정 페이지 수정 폼 | 2h |
| 2 | TOP-17 | 거래내역 검색/필터 | - 기간/유형 필터 UI<br>- API 쿼리 파라미터 추가 | 5h |
| 3 | TOP-18/19 | 데이터 내보내기 (CSV) | - CSV 생성 유틸리티<br>- 다운로드 버튼 UI | 5h |
| 4 | TOP-15 | 소셜 계정 연동 해제 | - DELETE API<br>- 해제 조건 검증 | 3h |

**Sprint C 총 예상 시간: 15시간**

---

### Sprint D: 온보딩 워크플로우 (TOP-25 하위) - 예상 1.5주

| 순서 | Jira Key | Summary | 작업 내용 | 예상 시간 |
|------|----------|---------|-----------|-----------|
| 1 | TOP-26 | 상점 기본 정보 입력 | - business_number 컬럼 추가<br>- OnboardingStep1.tsx<br>- 사업자번호 마스크 입력 | 6h |
| 2 | TOP-27 | 메뉴 등록 페이지 | - menus 테이블 생성<br>- CRUD API<br>- OnboardingStep2.tsx | 8h |
| 3 | TOP-28 | 고객 데이터 가져오기 | - Excel 파싱 (openpyxl)<br>- POST /api/customers/import<br>- 파일 업로드 UI | 10h |

**Sprint D 총 예상 시간: 24시간**

---

## 3. 우선순위별 권장 순서

```
[Critical/High - 즉시 수행]
├── TOP-39: JWT 토큰 폐기 메커니즘
├── TOP-37: N+1 쿼리 최적화
├── TOP-38: 코드 스플리팅
└── TOP-11: PIN 검증 UI

[High - 1주 내]
├── TOP-42: 비밀번호 정책 강화
├── TOP-40: Vite 빌드 최적화
├── TOP-12: 최초 PIN 설정 강제
└── TOP-13: 거래 확인 다이얼로그

[Medium - 2주 내]
├── TOP-14: 토스트 알림
├── TOP-16: 상점 프로필 수정
├── TOP-17: 거래내역 필터
├── TOP-18/19: CSV 내보내기
└── TOP-15: 소셜 연동 해제

[Low - 향후]
├── TOP-26: 온보딩 Step 1
├── TOP-27: 온보딩 Step 2
├── TOP-28: 온보딩 Step 3
└── TOP-41: React Query + Redis
```

---

## 4. 기술적 세부 사항

### 4.1 JWT 토큰 폐기 (TOP-39)

```python
# 1. 토큰 블랙리스트 테이블
CREATE TABLE token_blacklist (
    jti UUID PRIMARY KEY,
    shop_id UUID REFERENCES shops(id),
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

# 2. JWT 생성 시 jti 추가
payload = {
    "sub": shop_id,
    "jti": str(uuid.uuid4()),
    "exp": datetime.now(timezone.utc) + timedelta(minutes=30)
}

# 3. 토큰 검증 시 블랙리스트 확인
def verify_token(token):
    payload = jwt.decode(token, ...)
    if is_blacklisted(payload["jti"]):
        raise InvalidToken()
```

### 4.2 코드 스플리팅 (TOP-38)

```typescript
// App.tsx
const Analytics = lazy(() => import('./pages/Analytics'));
const CustomerDetail = lazy(() => import('./pages/CustomerDetail'));
const Settings = lazy(() => import('./pages/Settings'));

<Suspense fallback={<LoadingSpinner />}>
  <Routes>
    <Route path="/analytics" element={<Analytics />} />
    ...
  </Routes>
</Suspense>
```

### 4.3 N+1 쿼리 최적화 (TOP-37)

```sql
-- 기존: Python에서 모든 데이터 로드 후 집계
-- 개선: SQL에서 직접 집계

CREATE OR REPLACE FUNCTION get_dashboard_summary(p_shop_id UUID, p_date DATE)
RETURNS TABLE(
    total_charge BIGINT,
    total_deduct BIGINT,
    transaction_count INT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COALESCE(SUM(CASE WHEN t.type = 'CHARGE' THEN t.amount END), 0),
        COALESCE(SUM(CASE WHEN t.type = 'DEDUCT' THEN t.amount END), 0),
        COUNT(*)::INT
    FROM transactions t
    JOIN customers c ON t.customer_id = c.id
    WHERE c.shop_id = p_shop_id
      AND DATE(t.created_at) = p_date;
END;
$$ LANGUAGE plpgsql;
```

---

## 5. 의존성 관계

```
TOP-11 (PIN 모달) ──┬──> TOP-12 (PIN 강제)
                   └──> TOP-13 (확인 다이얼로그)

TOP-38 (코드 스플리팅) ──> TOP-40 (Vite 최적화) ──> TOP-41 (React Query)

TOP-26 (온보딩 1) ──> TOP-27 (온보딩 2) ──> TOP-28 (온보딩 3)
```

---

## 6. 예상 총 작업량

| 카테고리 | 예상 시간 | 예상 일수 (8h/day) |
|----------|-----------|-------------------|
| 보안 강화 | 22h | 3일 |
| 성능 최적화 | 36h | 4.5일 |
| 기능 보완 | 15h | 2일 |
| 온보딩 | 24h | 3일 |
| **합계** | **97h** | **약 12일** |

---

**최종 수정일:** 2026-01-18
