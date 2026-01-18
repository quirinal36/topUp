# 테스트 가이드

카페 선결제 시스템의 부하 테스트 및 Race Condition 테스트 가이드입니다.

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

# 테스트 계정 정보
TEST_EMAIL=your_email@example.com
TEST_PASSWORD=your_password
```

## 테스트 실행

### 1. 테스트 데이터 생성

대규모 테스트를 위해 먼저 데이터를 생성합니다:

```bash
# 고객 1,000명 + 거래 100,000건 생성
python load_tests/generate_test_data.py --customers 1000 --transactions 100000

# 기존 고객 사용하여 거래만 생성
python load_tests/generate_test_data.py --skip-customers --transactions 50000
```

### 2. Race Condition 테스트

잔액 동시성 문제를 검증합니다:

```bash
# 전체 테스트 실행
pytest race_condition_tests/test_balance_race.py -v -s

# 특정 테스트만 실행
pytest race_condition_tests/test_balance_race.py::TestBalanceRaceCondition::test_concurrent_deduct_insufficient_balance -v -s
```

### 3. 부하 테스트 (Locust)

#### 웹 UI 모드

```bash
cd load_tests
locust -f locustfile.py --host=http://localhost:8000
```

브라우저에서 http://localhost:8089 접속하여 테스트 설정:
- Number of users: 동시 사용자 수 (예: 100)
- Spawn rate: 초당 사용자 증가 수 (예: 10)

#### 커맨드 라인 모드

```bash
# 100명 사용자, 10분간 테스트
locust -f locustfile.py --host=http://localhost:8000 \
    --users 100 --spawn-rate 10 --run-time 10m --headless

# 높은 부하 테스트 (HighLoadUser 사용)
locust -f locustfile.py --host=http://localhost:8000 \
    --users 50 --spawn-rate 5 --run-time 5m --headless \
    HighLoadUser
```

## 테스트 시나리오

### Race Condition 테스트

| 테스트 | 설명 | 검증 사항 |
|--------|------|-----------|
| `test_concurrent_deduct_insufficient_balance` | 동시 차감 시 잔액 부족 처리 | 잔액이 음수가 되지 않음 |
| `test_concurrent_charge_consistency` | 동시 충전 일관성 | 충전 합계가 잔액과 일치 |
| `test_mixed_charge_deduct_consistency` | 충전/차감 혼합 일관성 | 최종 잔액이 예상값과 일치 |
| `test_balance_equals_transaction_sum` | 잔액 정합성 | 저장된 잔액 = 거래 합계 |

### 부하 테스트 태스크

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

## 성능 기준

| 지표 | 목표치 | 설명 |
|------|--------|------|
| 응답 시간 (P95) | < 500ms | 95% 요청이 500ms 이내 |
| 오류율 | < 1% | 전체 요청의 1% 미만 오류 |
| 처리량 | > 100 RPS | 초당 100건 이상 처리 |
| 잔액 불일치 | 0건 | Race Condition으로 인한 불일치 없음 |

## 결과 분석

### Locust 결과 해석

- **RPS**: 초당 처리 요청 수
- **Response Time**: 평균/중앙값/95번째 백분위수
- **Failure %**: 실패율

### 주의 사항

1. 테스트 데이터는 별도의 테스트 환경에서만 생성
2. 부하 테스트 전 서버 리소스 모니터링 설정
3. 테스트 후 테스트 데이터 정리 권장

## 트러블슈팅

### 로그인 실패

```
환경 변수가 올바르게 설정되었는지 확인:
echo $TEST_EMAIL
echo $TEST_PASSWORD
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
```
