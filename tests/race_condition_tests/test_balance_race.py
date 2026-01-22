"""
Race Condition 테스트
동시 요청으로 인한 잔액 불일치 검증

실행 방법:
1. pip install pytest pytest-asyncio httpx python-dotenv
2. tests/.env 파일 생성 (tests/.env.example 참고)
3. pytest tests/race_condition_tests/test_balance_race.py -v

중요: 이 테스트는 실제 데이터를 생성하므로 테스트 환경에서만 실행할 것
"""
import os
import asyncio
import httpx
import pytest
import pytest_asyncio
from typing import List, Tuple
from datetime import datetime
import json
from pathlib import Path

# .env 파일 로드
from dotenv import load_dotenv
env_path = Path(__file__).parent.parent / ".env"
load_dotenv(env_path)

# pytest-asyncio 설정
pytestmark = pytest.mark.asyncio(loop_scope="class")

# 테스트 설정
API_URL = os.getenv("TEST_API_URL", "http://localhost:8000")
TEST_USERNAME = os.getenv("TEST_USERNAME", "testuser")
TEST_PASSWORD = os.getenv("TEST_PASSWORD", "testpassword123")

# 동시 요청 수
CONCURRENT_REQUESTS = 20


class TestBalanceRaceCondition:
    """잔액 Race Condition 테스트"""

    @pytest_asyncio.fixture(autouse=True)
    async def setup(self):
        """테스트 셋업 - 로그인 및 테스트 고객 생성"""
        async with httpx.AsyncClient(base_url=API_URL, timeout=30.0) as client:
            # 로그인 (username/password 방식)
            response = await client.post("/api/auth/login", json={
                "username": TEST_USERNAME,
                "password": TEST_PASSWORD
            })
            assert response.status_code == 200, f"Login failed: {response.text}"

            data = response.json()
            self.token = data["access_token"]
            self.headers = {"Authorization": f"Bearer {self.token}"}

            # 테스트용 고객 생성
            timestamp = datetime.now().strftime("%H%M%S")
            customer_response = await client.post(
                "/api/customers",
                json={
                    "name": f"RaceTest_{timestamp}",
                    "phone_suffix": timestamp[-4:]
                },
                headers=self.headers
            )

            if customer_response.status_code == 201:
                self.test_customer_id = customer_response.json()["id"]
            else:
                # 기존 고객 사용
                customers = await client.get("/api/customers?page_size=1", headers=self.headers)
                self.test_customer_id = customers.json()["customers"][0]["id"]

            # 초기 잔액 충전 (테스트용)
            await client.post(
                "/api/transactions/charge",
                json={
                    "customer_id": self.test_customer_id,
                    "actual_payment": 1000000,  # 100만원
                    "service_amount": 0,
                    "payment_method": "CASH",
                    "note": "Race condition test initial balance"
                },
                headers=self.headers
            )

            yield

            # 테스트 후 정리 (선택적)

    async def test_concurrent_deduct_insufficient_balance(self):
        """
        테스트: 동시 차감 시 잔액 부족 처리

        시나리오:
        1. 고객 잔액: 10만원
        2. 20개의 동시 차감 요청 (각 8만원)
        3. 기대 결과: 최대 1개만 성공, 나머지는 잔액 부족
        4. 검증: 잔액이 음수가 되지 않음
        """
        async with httpx.AsyncClient(base_url=API_URL, timeout=30.0) as client:
            # 1. 현재 잔액 확인
            customer = await client.get(
                f"/api/customers/{self.test_customer_id}",
                headers=self.headers
            )
            initial_balance = customer.json()["current_balance"]
            print(f"\n초기 잔액: {initial_balance:,}원")

            # 2. 동시 차감 요청 생성
            deduct_amount = initial_balance - 20000  # 잔액보다 약간 적게

            async def make_deduct_request(request_id: int) -> Tuple[int, bool, str]:
                """차감 요청 수행"""
                try:
                    response = await client.post(
                        "/api/transactions/deduct",
                        json={
                            "customer_id": self.test_customer_id,
                            "amount": deduct_amount,
                            "note": f"Race test deduct #{request_id}"
                        },
                        headers=self.headers
                    )
                    success = response.status_code == 201
                    return request_id, success, response.text
                except Exception as e:
                    return request_id, False, str(e)

            # 3. 동시에 모든 요청 실행
            tasks = [make_deduct_request(i) for i in range(CONCURRENT_REQUESTS)]
            results = await asyncio.gather(*tasks)

            # 4. 결과 분석
            successes = [r for r in results if r[1]]
            failures = [r for r in results if not r[1]]

            print(f"\n동시 요청 수: {CONCURRENT_REQUESTS}")
            print(f"성공: {len(successes)}")
            print(f"실패: {len(failures)}")

            # 5. 최종 잔액 확인
            final_customer = await client.get(
                f"/api/customers/{self.test_customer_id}",
                headers=self.headers
            )
            final_balance = final_customer.json()["current_balance"]
            print(f"최종 잔액: {final_balance:,}원")

            # 6. 검증
            # 잔액이 음수가 아님
            assert final_balance >= 0, f"잔액이 음수: {final_balance}"

            # 예상 잔액 계산
            expected_balance = initial_balance - (len(successes) * deduct_amount)

            # 잔액이 예상값과 일치
            assert final_balance == expected_balance, \
                f"잔액 불일치! 예상: {expected_balance}, 실제: {final_balance}"

            # 성공한 요청 수가 논리적으로 맞음 (최대 1개만 성공 가능)
            max_possible_successes = initial_balance // deduct_amount
            assert len(successes) <= max_possible_successes, \
                f"너무 많은 성공: {len(successes)} (최대 {max_possible_successes})"

    async def test_concurrent_charge_consistency(self):
        """
        테스트: 동시 충전 시 잔액 일관성

        시나리오:
        1. 20개의 동시 충전 요청 (각 1만원)
        2. 기대 결과: 모두 성공
        3. 검증: 잔액 = 초기잔액 + (성공 수 × 1만원)
        """
        async with httpx.AsyncClient(base_url=API_URL, timeout=30.0) as client:
            # 1. 현재 잔액 확인
            customer = await client.get(
                f"/api/customers/{self.test_customer_id}",
                headers=self.headers
            )
            initial_balance = customer.json()["current_balance"]
            print(f"\n초기 잔액: {initial_balance:,}원")

            charge_amount = 10000  # 1만원

            async def make_charge_request(request_id: int) -> Tuple[int, bool, str]:
                """충전 요청 수행"""
                try:
                    response = await client.post(
                        "/api/transactions/charge",
                        json={
                            "customer_id": self.test_customer_id,
                            "actual_payment": charge_amount,
                            "service_amount": 0,
                            "payment_method": "CASH",
                            "note": f"Race test charge #{request_id}"
                        },
                        headers=self.headers
                    )
                    success = response.status_code == 201
                    return request_id, success, response.text
                except Exception as e:
                    return request_id, False, str(e)

            # 2. 동시에 모든 요청 실행
            tasks = [make_charge_request(i) for i in range(CONCURRENT_REQUESTS)]
            results = await asyncio.gather(*tasks)

            # 3. 결과 분석
            successes = [r for r in results if r[1]]
            failures = [r for r in results if not r[1]]

            print(f"\n동시 요청 수: {CONCURRENT_REQUESTS}")
            print(f"성공: {len(successes)}")
            print(f"실패: {len(failures)}")

            # 4. 최종 잔액 확인
            final_customer = await client.get(
                f"/api/customers/{self.test_customer_id}",
                headers=self.headers
            )
            final_balance = final_customer.json()["current_balance"]
            print(f"최종 잔액: {final_balance:,}원")

            # 5. 검증
            expected_balance = initial_balance + (len(successes) * charge_amount)

            assert final_balance == expected_balance, \
                f"잔액 불일치! 예상: {expected_balance}, 실제: {final_balance}"

    async def test_mixed_charge_deduct_consistency(self):
        """
        테스트: 충전과 차감이 동시에 발생할 때 일관성

        시나리오:
        1. 10개 충전 요청 (각 5만원) + 10개 차감 요청 (각 3만원) 동시 실행
        2. 검증: 최종 잔액 = 초기잔액 + (충전성공×5만) - (차감성공×3만)
        """
        async with httpx.AsyncClient(base_url=API_URL, timeout=30.0) as client:
            # 1. 현재 잔액 확인
            customer = await client.get(
                f"/api/customers/{self.test_customer_id}",
                headers=self.headers
            )
            initial_balance = customer.json()["current_balance"]
            print(f"\n초기 잔액: {initial_balance:,}원")

            charge_amount = 50000  # 5만원
            deduct_amount = 30000  # 3만원

            charge_successes = []
            deduct_successes = []

            async def make_charge_request(request_id: int) -> Tuple[str, int, bool]:
                try:
                    response = await client.post(
                        "/api/transactions/charge",
                        json={
                            "customer_id": self.test_customer_id,
                            "actual_payment": charge_amount,
                            "service_amount": 0,
                            "payment_method": "CASH",
                            "note": f"Mixed test charge #{request_id}"
                        },
                        headers=self.headers
                    )
                    return "charge", request_id, response.status_code == 201
                except Exception:
                    return "charge", request_id, False

            async def make_deduct_request(request_id: int) -> Tuple[str, int, bool]:
                try:
                    response = await client.post(
                        "/api/transactions/deduct",
                        json={
                            "customer_id": self.test_customer_id,
                            "amount": deduct_amount,
                            "note": f"Mixed test deduct #{request_id}"
                        },
                        headers=self.headers
                    )
                    return "deduct", request_id, response.status_code == 201
                except Exception:
                    return "deduct", request_id, False

            # 2. 혼합 요청 동시 실행
            tasks = []
            for i in range(10):
                tasks.append(make_charge_request(i))
                tasks.append(make_deduct_request(i))

            results = await asyncio.gather(*tasks)

            # 3. 결과 분석
            for op_type, req_id, success in results:
                if success:
                    if op_type == "charge":
                        charge_successes.append(req_id)
                    else:
                        deduct_successes.append(req_id)

            print(f"\n충전 성공: {len(charge_successes)}")
            print(f"차감 성공: {len(deduct_successes)}")

            # 4. 최종 잔액 확인
            final_customer = await client.get(
                f"/api/customers/{self.test_customer_id}",
                headers=self.headers
            )
            final_balance = final_customer.json()["current_balance"]
            print(f"최종 잔액: {final_balance:,}원")

            # 5. 검증
            expected_balance = initial_balance + \
                (len(charge_successes) * charge_amount) - \
                (len(deduct_successes) * deduct_amount)

            assert final_balance == expected_balance, \
                f"잔액 불일치! 예상: {expected_balance}, 실제: {final_balance}"

            # 잔액이 음수가 아님
            assert final_balance >= 0, f"잔액이 음수: {final_balance}"


class TestBalanceReconciliation:
    """잔액 정합성 검증 테스트"""

    @pytest_asyncio.fixture(autouse=True)
    async def setup(self):
        """테스트 셋업"""
        async with httpx.AsyncClient(base_url=API_URL, timeout=30.0) as client:
            response = await client.post("/api/auth/login", json={
                "username": TEST_USERNAME,
                "password": TEST_PASSWORD
            })
            assert response.status_code == 200

            data = response.json()
            self.token = data["access_token"]
            self.headers = {"Authorization": f"Bearer {self.token}"}
            yield

    async def test_balance_equals_transaction_sum(self):
        """
        테스트: 잔액이 거래 내역 합계와 일치하는지 검증

        검증: current_balance = SUM(CHARGE) - SUM(DEDUCT) ± CANCEL adjustments
        """
        async with httpx.AsyncClient(base_url=API_URL, timeout=60.0) as client:
            # 모든 고객 조회
            response = await client.get(
                "/api/customers?page_size=100",
                headers=self.headers
            )
            customers = response.json()["customers"]

            inconsistencies = []

            for customer in customers:
                customer_id = customer["id"]
                stored_balance = customer["current_balance"]

                # 해당 고객의 모든 거래 조회
                tx_response = await client.get(
                    f"/api/transactions?customer_id={customer_id}&page_size=1000",
                    headers=self.headers
                )

                # 응답 확인
                if tx_response.status_code != 200:
                    print(f"거래 조회 실패 (고객: {customer_id}): {tx_response.text}")
                    continue

                tx_data = tx_response.json()

                # 거래 합계 계산
                # CANCEL 트랜잭션의 원본을 추적하기 위해 모든 트랜잭션을 분석
                calculated_balance = 0
                transactions = tx_data.get("transactions", [])

                # 트랜잭션을 시간순으로 정렬 (오래된 것 먼저)
                sorted_transactions = sorted(transactions, key=lambda x: x["created_at"])

                # 원본 거래 매칭을 위한 자료구조
                # {amount: [(tx, index)]} - 같은 금액의 CHARGE/DEDUCT를 금액별로 그룹화
                charge_by_amount = {}  # 아직 취소되지 않은 CHARGE
                deduct_by_amount = {}  # 아직 취소되지 않은 DEDUCT

                # CANCEL 트랜잭션과 원본 유형 매핑
                cancel_to_original_type = {}  # {cancel_tx_id: "CHARGE" or "DEDUCT"}

                # 시간순으로 처리하면서 CANCEL의 원본 추적
                for tx in sorted_transactions:
                    tx_type = tx["type"]
                    amount = tx["amount"]
                    tx_id = tx["id"]
                    note = tx.get("note") or ""

                    if tx_type == "CHARGE":
                        # "[취소됨]" 마커가 없는 CHARGE만 후보로 등록
                        if "[취소됨]" not in note:
                            if amount not in charge_by_amount:
                                charge_by_amount[amount] = []
                            charge_by_amount[amount].append(tx)

                    elif tx_type == "DEDUCT":
                        # "[취소됨]" 마커가 없는 DEDUCT만 후보로 등록
                        if "[취소됨]" not in note:
                            if amount not in deduct_by_amount:
                                deduct_by_amount[amount] = []
                            deduct_by_amount[amount].append(tx)

                    elif tx_type == "CANCEL":
                        # CANCEL의 원본 찾기: 같은 금액의 가장 최근 CHARGE 또는 DEDUCT
                        # 우선순위: 1) "[취소됨]" 마커가 있는 원본, 2) 시간상 가장 가까운 원본

                        # 먼저 "[취소됨]" 마커로 매칭된 원본이 있는지 확인
                        found_original = False
                        for check_tx in sorted_transactions:
                            check_note = check_tx.get("note") or ""
                            if (check_tx["amount"] == amount and
                                check_tx["type"] in ("CHARGE", "DEDUCT") and
                                "[취소됨]" in check_note):
                                # 매칭된 원본 발견
                                cancel_to_original_type[tx_id] = check_tx["type"]
                                found_original = True
                                break

                        if not found_original:
                            # "[취소됨]" 마커가 없으면, 같은 금액의 후보 중 선택
                            # CHARGE를 먼저 확인 (일반적으로 충전 취소가 더 흔함)
                            if amount in charge_by_amount and charge_by_amount[amount]:
                                cancel_to_original_type[tx_id] = "CHARGE"
                                charge_by_amount[amount].pop(0)  # 사용된 후보 제거
                            elif amount in deduct_by_amount and deduct_by_amount[amount]:
                                cancel_to_original_type[tx_id] = "DEDUCT"
                                deduct_by_amount[amount].pop(0)  # 사용된 후보 제거
                            else:
                                # 매칭 실패 - 경고 출력
                                print(f"  경고: CANCEL 트랜잭션 매칭 실패 - "
                                      f"ID: {tx_id}, 금액: {amount:,}")

                # 잔액 계산
                for tx in sorted_transactions:
                    tx_type = tx["type"]
                    amount = tx["amount"]
                    tx_id = tx["id"]

                    if tx_type == "CHARGE":
                        calculated_balance += amount
                    elif tx_type == "DEDUCT":
                        calculated_balance -= amount
                    elif tx_type == "CANCEL":
                        original_type = cancel_to_original_type.get(tx_id)
                        if original_type == "CHARGE":
                            # 충전 취소 = 잔액 감소
                            calculated_balance -= amount
                        elif original_type == "DEDUCT":
                            # 차감 취소 = 잔액 증가
                            calculated_balance += amount
                        # 매칭 실패한 경우는 위에서 이미 경고 출력됨

                # 불일치 확인
                if stored_balance != calculated_balance:
                    inconsistencies.append({
                        "customer_id": customer_id,
                        "customer_name": customer["name"],
                        "stored_balance": stored_balance,
                        "calculated_balance": calculated_balance,
                        "difference": stored_balance - calculated_balance
                    })

            # 결과 출력
            print(f"\n검사한 고객 수: {len(customers)}")
            print(f"불일치 발견: {len(inconsistencies)}")

            if inconsistencies:
                print("\n불일치 목록:")
                for inc in inconsistencies:
                    print(f"  - {inc['customer_name']}: "
                          f"저장={inc['stored_balance']:,}, "
                          f"계산={inc['calculated_balance']:,}, "
                          f"차이={inc['difference']:,}")

            # 검증: 불일치가 없어야 함
            assert len(inconsistencies) == 0, \
                f"{len(inconsistencies)}건의 잔액 불일치 발견"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
