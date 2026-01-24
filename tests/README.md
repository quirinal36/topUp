# 테스트 가이드

선결제 관리 플랫폼 커밍스(Comings)의 전체 테스트 가이드입니다.

## 테스트 구성

```
tests/
├── unit_tests/           # 유닛 테스트 (비즈니스 로직)
│   ├── test_auth_service.py    # 인증 서비스 테스트
│   ├── test_pin_service.py     # PIN 서비스 테스트
│   └── test_nice_service.py    # 본인인증 서비스 테스트
├── race_condition_tests/ # 동시성 테스트
│   └── test_balance_race.py    # 잔액 Race Condition 테스트
├── load_tests/           # 부하 테스트
│   ├── locustfile.py           # Locust 부하 테스트
│   └── generate_test_data.py   # 테스트 데이터 생성기
├── run_all_tests.sh      # 전체 테스트 실행 스크립트
├── requirements.txt      # 테스트 의존성
└── .env.example          # 환경 변수 템플릿
```

---

## 사전 준비

### 1. 테스트 의존성 설치

```bash
cd tests
pip install -r requirements.txt
```

### 2. 환경 변수 설정 (.env 파일)

```bash
# .env.example을 복사하여 .env 파일 생성
cp .env.example .env

# .env 파일을 편집하여 실제 값 입력
nano .env  # 또는 원하는 에디터 사용
```

`.env` 파일 내용:
```env
# API 서버 URL
TEST_API_URL=http://localhost:8000

# 테스트 계정 정보 (username/password 로그인 방식)
TEST_USERNAME=your_username_here
TEST_PASSWORD=your_password_here
```

---

## 빠른 시작 - 전체 테스트 실행

```bash
cd tests
./run_all_tests.sh
```

---

## 테스트 유형별 실행

### 1. 유닛 테스트

비즈니스 로직의 정확성을 검증합니다. **API 서버 없이 실행 가능합니다.**

```bash
# backend 디렉토리를 PYTHONPATH에 추가
export PYTHONPATH="${PYTHONPATH}:$(pwd)/../backend"

# 전체 유닛 테스트 실행
pytest unit_tests/ -v

# 특정 테스트 파일만 실행
pytest unit_tests/test_auth_service.py -v

# 커버리지 리포트 포함
pytest unit_tests/ -v --cov=../backend/app/services --cov-report=html
```

#### 테스트 항목

| 파일 | 테스트 범위 |
|------|-------------|
| `test_auth_service.py` | 비밀번호 해싱, JWT 토큰, 블랙리스트, 본인인증 토큰 |
| `test_pin_service.py` | PIN 해싱, 검증, 잠금, 변경/재설정 |
| `test_nice_service.py` | 요청 ID 생성, Mock 인증 서비스, 결과 처리 |

---

### 2. Race Condition 테스트

동시 요청 시 잔액 무결성을 검증합니다. **실행 중인 API 서버가 필요합니다.**

```bash
# 서버 먼저 실행
# (다른 터미널에서) ./start.sh

# 전체 테스트 실행
pytest race_condition_tests/test_balance_race.py -v -s

# 특정 테스트만 실행
pytest race_condition_tests/test_balance_race.py::TestBalanceRaceCondition::test_concurrent_deduct_insufficient_balance -v -s
```

#### 테스트 시나리오

| 테스트 | 설명 | 검증 사항 |
|--------|------|-----------|
| `test_concurrent_deduct_insufficient_balance` | 20개 동시 차감 요청 | 잔액이 음수가 되지 않음 |
| `test_concurrent_charge_consistency` | 20개 동시 충전 요청 | 충전 합계가 잔액과 일치 |
| `test_mixed_charge_deduct_consistency` | 충전/차감 혼합 동시 요청 | 최종 잔액 정확성 |
| `test_balance_equals_transaction_sum` | 모든 고객 잔액 정합성 | 저장된 잔액 = 거래 합계 |

---

### 3. 부하 테스트 (Locust)

대규모 트래픽 처리 능력을 검증합니다. **실행 중인 API 서버가 필요합니다.**

#### 테스트 데이터 생성 (선택)

```bash
# 고객 1,000명 + 거래 100,000건 생성
python load_tests/generate_test_data.py --customers 1000 --transactions 100000

# 기존 고객 사용하여 거래만 생성
python load_tests/generate_test_data.py --skip-customers --transactions 50000
```

#### 웹 UI 모드

```bash
cd load_tests
locust -f locustfile.py --host=http://localhost:8000
```

브라우저에서 http://localhost:8089 접속:
- **Number of users**: 동시 사용자 수 (예: 100)
- **Spawn rate**: 초당 사용자 증가 수 (예: 10)

#### 커맨드 라인 모드

```bash
# 100명 사용자, 10분간 테스트
locust -f locustfile.py --host=http://localhost:8000 \
    --users 100 --spawn-rate 10 --run-time 10m --headless

# 높은 부하 테스트 (HighLoadUser 클래스 사용)
locust -f locustfile.py --host=http://localhost:8000 \
    --users 50 --spawn-rate 5 --run-time 5m --headless \
    HighLoadUser

# HTML 리포트 생성
locust -f locustfile.py --host=http://localhost:8000 \
    --users 100 --spawn-rate 10 --run-time 5m --headless \
    --html=report.html
```

#### 부하 테스트 태스크 가중치

| 태스크 | 가중치 | 설명 |
|--------|--------|------|
| `list_customers` | 30 | 고객 목록 조회 |
| `list_transactions` | 20 | 거래 내역 조회 |
| `get_customer_detail` | 15 | 고객 상세 조회 |
| `charge_customer` | 10 | 충전 |
| `deduct_customer` | 10 | 차감 |
| `dashboard_summary` | 5 | 대시보드 요약 |
| `dashboard_analytics` | 3 | 분석 데이터 |
| `create_customer` | 2 | 고객 생성 |
| `cancel_transaction` | 1 | 거래 취소 |

---

### 4. 수동 테스트

UI 플로우를 사람이 직접 검증합니다.

**📄 테스트 시나리오 문서:** `docs/MANUAL_TEST_SCENARIOS.md`

주요 시나리오:
- 회원가입 4단계 플로우
- 로그인/로그아웃 및 세션 관리
- 고객 CRUD 및 검색
- 충전/차감 트랜잭션
- 거래 취소
- PIN 관리
- 비밀번호 재설정

---

## 성능 기준

| 지표 | 목표치 | 설명 |
|------|--------|------|
| 응답 시간 (P95) | < 500ms | 95% 요청이 500ms 이내 |
| 오류율 | < 1% | 전체 요청의 1% 미만 오류 |
| 처리량 | > 100 RPS | 초당 100건 이상 처리 |
| 잔액 불일치 | 0건 | Race Condition으로 인한 불일치 없음 |

---

## 테스트 결과 해석

### Locust 결과

- **RPS (Requests Per Second)**: 초당 처리 요청 수
- **Response Time**: 평균/중앙값/95번째 백분위수
- **Failure %**: 실패율 (1% 이하 유지)

### Race Condition 테스트 결과

- 모든 테스트 PASSED → 동시성 안전
- `AssertionError: 잔액이 음수` → Race Condition 발생, DB 트랜잭션 확인 필요

---

## 트러블슈팅

### 로그인 실패

```bash
# 환경 변수 확인
cat .env
echo "TEST_USERNAME: $TEST_USERNAME"
```

### 모듈 import 오류

```bash
# PYTHONPATH에 backend 추가
export PYTHONPATH="${PYTHONPATH}:$(pwd)/../backend"
```

### 타임아웃 오류

Locust 설정에서 timeout 증가:
```python
wait_time = between(1, 3)  # 대기 시간 증가
```

### 연결 오류

```bash
# 서버 상태 확인
curl http://localhost:8000/api/auth/me

# 서버 로그 확인
# (서버 실행 터미널에서 확인)
```

---

## 주의 사항

1. **테스트 환경 분리**: 테스트 데이터는 별도의 테스트 환경에서만 생성
2. **리소스 모니터링**: 부하 테스트 전 서버 CPU/메모리 모니터링 설정
3. **데이터 정리**: 테스트 후 테스트 데이터 정리 권장
4. **운영 환경 금지**: 운영 DB에서 테스트 스크립트 실행 금지

---

## 관련 문서

- [수동 테스트 시나리오](../docs/MANUAL_TEST_SCENARIOS.md)
- [프로젝트 요구사항 (PRD)](../PRD.md)
- [API 문서](http://localhost:8000/docs)
