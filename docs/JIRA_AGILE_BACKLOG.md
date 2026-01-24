# Comings - Atlassian JIRA Agile Backlog

**프로젝트 키:** COMINGS (기존: TOPUP)
**문서 버전:** 1.0
**작성일:** 2025-12-31
**스프린트 주기:** 2주

---

## Epic 구조

| Epic Key | Epic Name | Status |
|----------|-----------|--------|
| TOPUP-E1 | 인증 및 보안 (Authentication & Security) | Done |
| TOPUP-E2 | 고객 관리 (Customer Management) | Done |
| TOPUP-E3 | 거래 관리 (Transaction Management) | Done |
| TOPUP-E4 | 대시보드 및 통계 (Dashboard & Analytics) | Done |
| TOPUP-E5 | UI/UX 개선 (UI/UX Enhancement) | In Progress |
| TOPUP-E6 | 보안 강화 (Security Hardening) | To Do |
| TOPUP-E7 | 기능 보완 (Feature Enhancement) | To Do |
| TOPUP-E8 | 외부 연동 (External Integration) | To Do |
| TOPUP-E9 | 품질 보증 (Quality Assurance) | In Progress |
| TOPUP-E10 | 배포 및 운영 (Deployment & Operations) | To Do |

---

## 완료된 스토리 (Done)

### Epic: TOPUP-E1 인증 및 보안

| Key | Type | Summary | Status | Story Points |
|-----|------|---------|--------|--------------|
| TOPUP-1 | Story | 네이버 OAuth 소셜 로그인 구현 | Done | 5 |
| TOPUP-2 | Story | 카카오 OAuth 소셜 로그인 구현 | Done | 5 |
| TOPUP-3 | Story | 복수 소셜 계정 연동 기능 | Done | 3 |
| TOPUP-4 | Story | JWT 기반 자동 로그인 유지 | Done | 3 |
| TOPUP-5 | Story | PIN 설정 및 변경 API | Done | 3 |
| TOPUP-6 | Story | PIN 검증 API (5회 실패 시 1분 잠금) | Done | 3 |
| TOPUP-7 | Story | PIN 재설정 (소셜 재인증) | Done | 2 |
| TOPUP-8 | Story | 비밀번호 재설정 이메일 발송 (Resend API) | Done | 5 |
| TOPUP-9 | Story | 비밀번호 재설정 인증번호 검증 | Done | 3 |

---

### Epic: TOPUP-E2 고객 관리

| Key | Type | Summary | Status | Story Points |
|-----|------|---------|--------|--------------|
| TOPUP-10 | Story | 신규 고객 등록 (이름 + 연락처 뒷자리) | Done | 3 |
| TOPUP-11 | Story | 중복 고객 등록 방지 검증 | Done | 2 |
| TOPUP-12 | Story | 고객 목록 조회 (페이지네이션) | Done | 3 |
| TOPUP-13 | Story | 고객 실시간 검색 필터링 | Done | 3 |
| TOPUP-14 | Story | 고객 상세 조회 (통계 + 거래내역) | Done | 5 |
| TOPUP-15 | Story | 고객 정보 수정 | Done | 2 |
| TOPUP-16 | Story | 고객 삭제 (잔액 0원 조건) | Done | 2 |

---

### Epic: TOPUP-E3 거래 관리

| Key | Type | Summary | Status | Story Points |
|-----|------|---------|--------|--------------|
| TOPUP-20 | Story | 선불 충전 기능 (실결제액 + 서비스금액) | Done | 5 |
| TOPUP-21 | Story | 결제수단 선택 (카드/현금/계좌이체) | Done | 2 |
| TOPUP-22 | Story | 충전 비고 입력 | Done | 1 |
| TOPUP-23 | Story | 서비스 이용 차감 (잔액 검증) | Done | 5 |
| TOPUP-24 | Story | 빠른 금액 버튼 (3K, 5K, 10K, 15K, 20K) | Done | 2 |
| TOPUP-25 | Story | 주문 메뉴 비고 입력 | Done | 1 |
| TOPUP-26 | Story | 거래 취소 (역거래 생성) | Done | 3 |

---

### Epic: TOPUP-E4 대시보드 및 통계

| Key | Type | Summary | Status | Story Points |
|-----|------|---------|--------|--------------|
| TOPUP-30 | Story | 금일 충전/차감 합계 표시 | Done | 3 |
| TOPUP-31 | Story | 전체 예치금 현황 표시 | Done | 2 |
| TOPUP-32 | Story | 등록 고객 수 표시 | Done | 1 |
| TOPUP-33 | Story | 기간별 매출 차트 (일간/주간/월간) | Done | 5 |
| TOPUP-34 | Story | 상위 고객 순위 (Top 10) | Done | 3 |
| TOPUP-35 | Story | 결제수단별 비율 파이 차트 | Done | 3 |
| TOPUP-36 | Story | 인기 메뉴 분석 (단순 카운트) | Done | 3 |

---

### Epic: TOPUP-E5 UI/UX 개선 (완료 항목)

| Key | Type | Summary | Status | Story Points |
|-----|------|---------|--------|--------------|
| TOPUP-40 | Story | 반응형 레이아웃 (모바일/태블릿) | Done | 5 |
| TOPUP-41 | Story | 다크 모드 테마 전환 | Done | 3 |
| TOPUP-42 | Story | 카드 기반 UI 디자인 | Done | 3 |
| TOPUP-43 | Story | 로딩 상태 스피너 표시 | Done | 2 |
| TOPUP-44 | Story | 사용자 친화적 에러 메시지 | Done | 2 |
| TOPUP-45 | Story | 잔액 부족 경고 표시 | Done | 1 |

---

## 백로그 - To Do (우선순위별)

### Sprint Backlog - Priority: High (보안/안정성)

#### Epic: TOPUP-E6 보안 강화

| Key | Type | Summary | Description | Acceptance Criteria | Story Points | Priority |
|-----|------|---------|-------------|---------------------|--------------|----------|
| TOPUP-50 | Story | PIN 검증 UI 모달 구현 | 민감 작업(고객 수정/삭제, 거래 취소, 설정 변경) 시 PIN 입력 모달 표시 | - 민감 작업 전 PIN 모달 표시<br>- 4자리 숫자 입력 UI<br>- 5회 실패 시 잠금 표시<br>- 검증 성공 시 작업 진행 | 5 | High |
| TOPUP-51 | Story | 최초 로그인 PIN 설정 강제 | 신규 가입 시 PIN 미설정 상태면 설정 화면으로 리다이렉트 | - PIN 미설정 시 설정 페이지 강제 이동<br>- PIN 설정 완료 전 다른 페이지 접근 차단<br>- 설정 완료 후 대시보드 이동 | 3 | High |
| TOPUP-52 | Story | 거래 확인 다이얼로그 | 차감/취소 작업 전 확인 팝업 표시 | - 차감 시 금액/고객명 확인 팝업<br>- 취소 시 경고 문구 포함 확인 팝업<br>- 확인/취소 버튼 | 2 | High |
| TOPUP-53 | Story | 토스트 알림 시스템 구현 | 작업 성공/실패 시 화면 상단 토스트 알림 | - 성공 시 녹색 토스트<br>- 실패 시 빨간 토스트<br>- 3초 후 자동 사라짐<br>- 수동 닫기 가능 | 3 | High |

**Tasks for TOPUP-50 (PIN 검증 UI 모달):**

| Task Key | Summary | Description |
|----------|---------|-------------|
| TOPUP-50-1 | PinVerifyModal 컴포넌트 생성 | 4자리 PIN 입력 모달 UI 컴포넌트 |
| TOPUP-50-2 | PIN 검증 API 연동 | /api/auth/pin/verify 엔드포인트 연동 |
| TOPUP-50-3 | usePinVerify 훅 생성 | PIN 검증 로직 재사용 커스텀 훅 |
| TOPUP-50-4 | 민감 작업에 PIN 검증 적용 | 고객 삭제, 거래 취소 등에 적용 |

**Tasks for TOPUP-51 (최초 로그인 PIN 설정):**

| Task Key | Summary | Description |
|----------|---------|-------------|
| TOPUP-51-1 | PIN 설정 상태 체크 로직 | 로그인 후 pin_hash 존재 여부 확인 |
| TOPUP-51-2 | PIN 설정 페이지 라우팅 | 미설정 시 /settings/pin 리다이렉트 |
| TOPUP-51-3 | ProtectedRoute 수정 | PIN 필수 설정 가드 추가 |

**Tasks for TOPUP-52 (거래 확인 다이얼로그):**

| Task Key | Summary | Description |
|----------|---------|-------------|
| TOPUP-52-1 | ConfirmDialog 컴포넌트 생성 | 재사용 가능한 확인 다이얼로그 |
| TOPUP-52-2 | 차감 확인 다이얼로그 적용 | 차감 버튼 클릭 시 확인 팝업 |
| TOPUP-52-3 | 취소 확인 다이얼로그 적용 | 거래 취소 시 경고 포함 팝업 |

**Tasks for TOPUP-53 (토스트 알림):**

| Task Key | Summary | Description |
|----------|---------|-------------|
| TOPUP-53-1 | Toast 컴포넌트 생성 | 성공/에러/경고 타입별 토스트 UI |
| TOPUP-53-2 | ToastProvider 컨텍스트 생성 | 전역 토스트 상태 관리 |
| TOPUP-53-3 | useToast 훅 생성 | 토스트 표시 편의 함수 |
| TOPUP-53-4 | 기존 alert 대체 | 모든 alert를 toast로 교체 |

---

### Sprint Backlog - Priority: Medium (기능 보완)

#### Epic: TOPUP-E7 기능 보완

| Key | Type | Summary | Description | Acceptance Criteria | Story Points | Priority |
|-----|------|---------|-------------|---------------------|--------------|----------|
| TOPUP-60 | Story | 소셜 계정 연동 해제 기능 | 연동된 소셜 계정을 해제할 수 있는 기능 | - 설정 페이지에서 연동 해제 버튼<br>- 주 계정은 해제 불가<br>- 해제 전 확인 팝업<br>- 최소 1개 계정 필수 유지 | 3 | Medium |
| TOPUP-61 | Story | 상점 프로필 수정 기능 | 상점명 등 기본 정보 수정 | - 상점명 수정<br>- 수정 전 PIN 검증<br>- 저장 성공/실패 알림 | 2 | Medium |
| TOPUP-62 | Story | 거래내역 검색 및 필터 | 고객 상세 페이지 내 거래내역 검색 | - 기간 필터 (오늘/이번주/이번달/전체)<br>- 거래 유형 필터 (충전/차감/취소)<br>- 금액 범위 검색 | 5 | Medium |
| TOPUP-63 | Story | 데이터 내보내기 (CSV) | 고객/거래 데이터 CSV 다운로드 | - 고객 목록 CSV 내보내기<br>- 거래내역 CSV 내보내기<br>- 기간 선택 후 내보내기<br>- 파일명에 날짜 포함 | 5 | Medium |
| TOPUP-64 | Story | 인기 메뉴 분석 고도화 | 비고 필드 분석으로 메뉴 통계 개선 | - 키워드 추출 알고리즘<br>- 상위 10개 메뉴 표시<br>- 기간별 메뉴 트렌드 | 5 | Medium |

**Tasks for TOPUP-60 (소셜 계정 연동 해제):**

| Task Key | Summary | Description |
|----------|---------|-------------|
| TOPUP-60-1 | 연동 해제 API 엔드포인트 | DELETE /api/auth/social-accounts/{id} |
| TOPUP-60-2 | 해제 버튼 UI 추가 | 설정 페이지 소셜 계정 목록에 해제 버튼 |
| TOPUP-60-3 | 해제 조건 검증 로직 | 주 계정 및 마지막 계정 해제 방지 |

**Tasks for TOPUP-62 (거래내역 검색/필터):**

| Task Key | Summary | Description |
|----------|---------|-------------|
| TOPUP-62-1 | 필터 컴포넌트 생성 | 기간/유형 선택 필터 UI |
| TOPUP-62-2 | 거래내역 API 필터 파라미터 | start_date, end_date, type 쿼리 파라미터 |
| TOPUP-62-3 | 고객 상세 페이지 필터 연동 | 필터 변경 시 목록 재조회 |

**Tasks for TOPUP-63 (데이터 내보내기):**

| Task Key | Summary | Description |
|----------|---------|-------------|
| TOPUP-63-1 | CSV 생성 유틸리티 함수 | 객체 배열을 CSV 문자열로 변환 |
| TOPUP-63-2 | 다운로드 트리거 함수 | Blob 생성 및 다운로드 실행 |
| TOPUP-63-3 | 내보내기 버튼 UI | 고객/통계 페이지에 버튼 추가 |
| TOPUP-63-4 | 내보내기 API (선택적) | 서버 사이드 CSV 생성 |

---

### Sprint Backlog - Priority: Low (향후 로드맵)

#### Epic: TOPUP-E8 외부 연동

| Key | Type | Summary | Description | Acceptance Criteria | Story Points | Priority |
|-----|------|---------|-------------|---------------------|--------------|----------|
| TOPUP-70 | Story | 카카오 알림톡 연동 | 잔액 변동 시 카카오 알림톡 발송 | - 충전 완료 알림<br>- 잔액 부족 알림<br>- 장기 미방문 리마인드<br>- 알림 설정 on/off | 13 | Low |
| TOPUP-71 | Story | 블루투스 프린터 연동 | 거래 확인증 출력 기능 | - 프린터 페어링 UI<br>- 충전/차감 영수증 출력<br>- 영수증 템플릿 설정 | 8 | Low |
| TOPUP-72 | Story | 멀티 상점 지원 | 프랜차이즈 통합 관리 | - 상점 그룹 생성<br>- 통합 대시보드<br>- 상점별 권한 관리 | 21 | Low |

**Tasks for TOPUP-70 (카카오 알림톡):**

| Task Key | Summary | Description |
|----------|---------|-------------|
| TOPUP-70-1 | 카카오 비즈니스 채널 연동 | 비즈톡 API 키 설정 |
| TOPUP-70-2 | 알림톡 템플릿 등록 | 카카오 검수 통과 템플릿 |
| TOPUP-70-3 | 알림 발송 서비스 구현 | 백엔드 알림 발송 로직 |
| TOPUP-70-4 | 고객 전화번호 수집 동의 | 전화번호 전체 입력 및 동의 처리 |
| TOPUP-70-5 | 알림 설정 UI | 상점별 알림 on/off 설정 |

---

#### Epic: TOPUP-E9 품질 보증

| Key | Type | Summary | Description | Acceptance Criteria | Story Points | Priority |
|-----|------|---------|-------------|---------------------|--------------|----------|
| TOPUP-80 | Story | 백엔드 단위 테스트 작성 | pytest 기반 API 테스트 | - 인증 API 테스트<br>- 고객 CRUD 테스트<br>- 거래 API 테스트<br>- 커버리지 80% 이상 | 8 | Medium |
| TOPUP-81 | Story | 프론트엔드 컴포넌트 테스트 | Vitest + React Testing Library | - 주요 컴포넌트 테스트<br>- 커스텀 훅 테스트<br>- 스냅샷 테스트 | 5 | Medium |
| TOPUP-82 | Story | E2E 테스트 작성 | Playwright 기반 통합 테스트 | - 로그인 플로우 테스트<br>- 고객 등록/충전/차감 시나리오<br>- 크로스 브라우저 테스트 | 8 | Low |
| **TOPUP-83** | **Story** | **Race Condition 테스트 및 수정** | **동시성 문제 검증 및 수정** | - 동시 충전/차감 테스트<br>- 잔액 불일치 0건<br>- 원자적 트랜잭션 적용 | **8** | **High** |
| **TOPUP-84** | **Story** | **부하 테스트 인프라 구축** | **Locust 기반 부하 테스트** | - 10만건 데이터 처리<br>- P95 < 500ms<br>- 오류율 < 1% | **5** | **High** |
| **TOPUP-85** | **Story** | **데이터베이스 성능 최적화** | **인덱스 및 제약조건 추가** | - 12개 인덱스 추가<br>- CHECK 제약조건<br>- 쿼리 성능 개선 | **3** | **High** |

**Tasks for TOPUP-80 (백엔드 단위 테스트):**

| Task Key | Summary | Description |
|----------|---------|-------------|
| TOPUP-80-1 | pytest 설정 | conftest.py, pytest.ini 구성 |
| TOPUP-80-2 | 테스트 DB 설정 | 테스트용 Supabase 또는 Mock 구성 |
| TOPUP-80-3 | 인증 API 테스트 | auth_service 테스트 케이스 |
| TOPUP-80-4 | 고객 API 테스트 | customers router 테스트 케이스 |
| TOPUP-80-5 | 거래 API 테스트 | transactions router 테스트 케이스 |

**Tasks for TOPUP-83 (Race Condition 테스트 및 수정) - Done:**

| Task Key | Summary | Description | Status |
|----------|---------|-------------|--------|
| TOPUP-83-1 | Race Condition 테스트 코드 작성 | pytest-asyncio 기반 동시성 테스트 | ✅ Done |
| TOPUP-83-2 | 원자적 충전 RPC 함수 | charge_balance PostgreSQL 함수 | ✅ Done |
| TOPUP-83-3 | 원자적 차감 RPC 함수 | deduct_balance PostgreSQL 함수 | ✅ Done |
| TOPUP-83-4 | 원자적 취소 RPC 함수 | cancel_transaction PostgreSQL 함수 | ✅ Done |
| TOPUP-83-5 | 원자적 PIN 검증 RPC 함수 | verify_pin_atomic PostgreSQL 함수 | ✅ Done |
| TOPUP-83-6 | transactions.py RPC 호출 적용 | 기존 코드를 RPC 호출로 변경 | ✅ Done |
| TOPUP-83-7 | pin_service.py RPC 호출 적용 | PIN 검증 로직 RPC 적용 | ✅ Done |

**Tasks for TOPUP-84 (부하 테스트 인프라 구축) - Done:**

| Task Key | Summary | Description | Status |
|----------|---------|-------------|--------|
| TOPUP-84-1 | Locust 테스트 스크립트 작성 | locustfile.py 부하 테스트 시나리오 | ✅ Done |
| TOPUP-84-2 | 테스트 데이터 생성기 | generate_test_data.py 대량 데이터 생성 | ✅ Done |
| TOPUP-84-3 | 테스트 대시보드 UI | dashboard.html 웹 기반 테스트 UI | ✅ Done |
| TOPUP-84-4 | 테스트 환경 설정 | .env.example, requirements.txt | ✅ Done |
| TOPUP-84-5 | 테스트 가이드 문서 | tests/README.md 사용법 문서 | ✅ Done |

**Tasks for TOPUP-85 (데이터베이스 성능 최적화) - Done:**

| Task Key | Summary | Description | Status |
|----------|---------|-------------|--------|
| TOPUP-85-1 | 성능 인덱스 추가 | 12개 인덱스 마이그레이션 | ✅ Done |
| TOPUP-85-2 | 데이터 무결성 제약조건 | CHECK 제약조건 추가 | ✅ Done |

---

#### Epic: TOPUP-E10 배포 및 운영

| Key | Type | Summary | Description | Acceptance Criteria | Story Points | Priority |
|-----|------|---------|-------------|---------------------|--------------|----------|
| TOPUP-90 | Story | Frontend Vercel 배포 | React 앱 Vercel 배포 | - 프로덕션 빌드<br>- 환경변수 설정<br>- 커스텀 도메인 연결 | 3 | High |
| TOPUP-91 | Story | Backend Railway 배포 | FastAPI 앱 Railway 배포 | - Docker 컨테이너화<br>- 환경변수 설정<br>- HTTPS 설정 | 5 | High |
| TOPUP-92 | Story | CI/CD 파이프라인 구축 | GitHub Actions 자동 배포 | - PR 시 테스트 실행<br>- main 브랜치 자동 배포<br>- 배포 알림 | 5 | Medium |
| TOPUP-93 | Story | 모니터링 및 로깅 설정 | 에러 모니터링 도구 연동 | - Sentry 에러 트래킹<br>- 성능 모니터링<br>- 로그 수집 | 5 | Medium |

**Tasks for TOPUP-90 (Frontend 배포):**

| Task Key | Summary | Description |
|----------|---------|-------------|
| TOPUP-90-1 | Vercel 프로젝트 연결 | GitHub 레포 연동 |
| TOPUP-90-2 | 환경변수 설정 | VITE_API_URL 등 설정 |
| TOPUP-90-3 | 빌드 설정 확인 | vite build 설정 최적화 |
| TOPUP-90-4 | 도메인 설정 | 커스텀 도메인 연결 (선택) |

**Tasks for TOPUP-91 (Backend 배포):**

| Task Key | Summary | Description |
|----------|---------|-------------|
| TOPUP-91-1 | Dockerfile 작성 | FastAPI 컨테이너 이미지 |
| TOPUP-91-2 | Railway 프로젝트 생성 | 서비스 연결 및 설정 |
| TOPUP-91-3 | 환경변수 설정 | DB, OAuth 키 등 설정 |
| TOPUP-91-4 | 헬스체크 엔드포인트 | /health API 추가 |

---

## 스프린트 계획 제안

### Sprint 1: 보안 강화 (High Priority)
- TOPUP-50: PIN 검증 UI 모달 구현
- TOPUP-51: 최초 로그인 PIN 설정 강제
- TOPUP-52: 거래 확인 다이얼로그
- TOPUP-53: 토스트 알림 시스템

**총 Story Points:** 13

---

### Sprint 2: 배포 준비
- TOPUP-90: Frontend Vercel 배포
- TOPUP-91: Backend Railway 배포
- TOPUP-61: 상점 프로필 수정

**총 Story Points:** 10

---

### Sprint 3: 기능 보완
- TOPUP-60: 소셜 계정 연동 해제
- TOPUP-62: 거래내역 검색 및 필터
- TOPUP-63: 데이터 내보내기 (CSV)

**총 Story Points:** 13

---

### Sprint 4: 품질 개선
- TOPUP-80: 백엔드 단위 테스트
- TOPUP-81: 프론트엔드 컴포넌트 테스트
- TOPUP-92: CI/CD 파이프라인

**총 Story Points:** 18

---

## Labels

| Label | Description | Color |
|-------|-------------|-------|
| `frontend` | 프론트엔드 작업 | Blue |
| `backend` | 백엔드 작업 | Green |
| `security` | 보안 관련 | Red |
| `ui-ux` | UI/UX 개선 | Purple |
| `api` | API 관련 | Yellow |
| `testing` | 테스트 관련 | Orange |
| `devops` | 배포/인프라 | Gray |
| `documentation` | 문서화 | Light Blue |

---

## Components

| Component | Lead | Description |
|-----------|------|-------------|
| Frontend - Auth | - | 로그인, PIN 관련 컴포넌트 |
| Frontend - Customer | - | 고객 관리 페이지 |
| Frontend - Transaction | - | 거래 관련 컴포넌트 |
| Frontend - Dashboard | - | 대시보드, 통계 |
| Frontend - Common | - | 공통 컴포넌트 (Modal, Toast 등) |
| Backend - Auth | - | 인증 서비스, OAuth |
| Backend - Customer | - | 고객 CRUD API |
| Backend - Transaction | - | 거래 API |
| Backend - Analytics | - | 통계 API |

---

## Definition of Done (DoD)

- [ ] 코드 리뷰 완료
- [ ] 단위 테스트 통과 (해당 시)
- [ ] 기능 테스트 완료
- [ ] 브라우저 호환성 확인 (Chrome, Safari, Mobile)
- [ ] 반응형 디자인 확인
- [ ] 에러 핸들링 구현
- [ ] 로딩 상태 처리
- [ ] PR 머지 완료

---

**최종 수정일:** 2026-01-18
