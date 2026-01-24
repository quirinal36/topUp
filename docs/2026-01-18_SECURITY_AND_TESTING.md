# 보안 강화 및 테스트 인프라 구축 - 작업 보고서

**작업일:** 2026-01-18
**목적:** 상용화를 위한 운영 안정성 확보

---

## 1. 개요

선결제 관리 플랫폼 커밍스(Comings)의 상용화를 앞두고, 10만건 이상의 데이터 처리 시 발생할 수 있는 치명적 결함을 사전에 식별하고 수정하였습니다.

---

## 2. 식별된 결함 및 수정 사항

### 2.1 Race Condition (동시성 문제) - Critical

**문제:** 기존 거래 처리 로직이 "읽기-수정-쓰기" 패턴으로 구현되어 동시 요청 시 잔액 불일치 발생 가능

**수정:** PostgreSQL RPC 함수를 사용한 원자적(Atomic) 트랜잭션으로 변경

| RPC 함수 | 용도 |
|----------|------|
| `charge_balance` | 충전 (FOR UPDATE 락 + 원자적 잔액 증가) |
| `deduct_balance` | 차감 (FOR UPDATE 락 + 잔액 검증) |
| `cancel_transaction` | 취소 (원거래 검증 + 역거래 생성) |
| `verify_pin_atomic` | PIN 검증 (실패 횟수 원자적 증가) |

**수정 파일:**
- `backend/app/routers/transactions.py`
- `backend/app/services/pin_service.py`

### 2.2 데이터베이스 인덱스 부재 - High

**수정:** 12개의 성능 최적화 인덱스 추가

| 테이블 | 인덱스 | 용도 |
|--------|--------|------|
| `customers` | `shop_id` | 상점별 고객 조회 |
| `customers` | `shop_id, name` | 고객 검색 |
| `customers` | `current_balance DESC` | 잔액 정렬 |
| `transactions` | `customer_id` | 고객별 거래내역 |
| `transactions` | `created_at DESC` | 날짜별 조회 |

### 2.3 데이터 무결성 제약 부재 - Medium

**수정:** CHECK 제약조건 추가

| 테이블 | 제약조건 |
|--------|----------|
| `customers` | `current_balance >= 0` |
| `transactions` | `amount > 0` |

---

## 3. 테스트 인프라 구축

### 3.1 디렉토리 구조

```
tests/
├── .env.example              # 테스트 환경 변수 템플릿
├── README.md                 # 테스트 가이드
├── requirements.txt          # 테스트 의존성
├── dashboard.html            # 테스트 대시보드 UI
├── run_dashboard.sh          # 대시보드 실행 스크립트
├── load_tests/
│   ├── locustfile.py         # Locust 부하 테스트
│   └── generate_test_data.py # 테스트 데이터 생성기
└── race_condition_tests/
    └── test_balance_race.py  # Race Condition 테스트
```

### 3.2 테스트 데이터 생성기

```bash
# 고객 1,000명 + 거래 100,000건 생성
python load_tests/generate_test_data.py --customers 1000 --transactions 100000
```

### 3.3 Race Condition 테스트

| 테스트 | 검증 사항 |
|--------|-----------|
| `test_concurrent_deduct_insufficient_balance` | 잔액이 음수가 되지 않음 |
| `test_concurrent_charge_consistency` | 충전 합계가 잔액과 일치 |
| `test_mixed_charge_deduct_consistency` | 최종 잔액이 예상값과 일치 |

### 3.4 부하 테스트 (Locust)

```bash
locust -f locustfile.py --host=http://localhost:8000
# 웹 UI: http://localhost:8089
```

### 3.5 테스트 대시보드

```bash
./run_dashboard.sh
# http://localhost:8080/dashboard.html
```

---

## 4. 성능 기준

| 지표 | 목표치 |
|------|--------|
| 응답 시간 (P95) | < 500ms |
| 오류율 | < 1% |
| 처리량 | > 100 RPS |
| 잔액 불일치 | 0건 |

---

## 5. 데이터베이스 마이그레이션

| 마이그레이션 | 내용 |
|-------------|------|
| `add_performance_indexes` | 12개 성능 인덱스 |
| `add_atomic_balance_functions` | 충전/차감/취소 RPC 함수 |
| `add_data_integrity_constraints` | CHECK 제약조건 |
| `add_atomic_pin_functions` | PIN 검증 RPC 함수 |

---

**최종 수정일:** 2026-01-18
