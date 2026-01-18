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
from typing import List, Tuple
from datetime import datetime
import json
from pathlib import Path

# .env 파일 로드
from dotenv import load_dotenv
env_path = Path(__file__).parent.parent / ".env"
load_dotenv(env_path)

# 테스트 설정
API_URL = os.getenv("TEST_API_URL", "http://localhost:8000")
TEST_EMAIL = os.getenv("TEST_EMAIL", "test@example.com")
TEST_PASSWORD = os.getenv("TEST_PASSWORD", "testpassword123")

# 동시 요청 수
CONCURRENT_REQUESTS = 20


class TestBalanceRaceCondition:
    """잔액 Race Condition 테스트"""

    @pytest.fixture(autouse=True)
    async def setup(self):
        """테스트 셋업 - 로그인 및 테스트 고객 생성"""
        async with httpx.AsyncClient(base_url=API_URL, timeout=30.0) as client:
            # 로그인
            response = await client.post("/api/auth/login", json={
                "email": TEST_EMAIL,
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

    @pytest.mark.asyncio
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

    @pytest.mark.asyncio
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

    @pytest.mark.asyncio
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

    @pytest.fixture(autouse=True)
    async def setup(self):
        """테스트 셋업"""
        async with httpx.AsyncClient(base_url=API_URL, timeout=30.0) as client:
            response = await client.post("/api/auth/login", json={
                "email": TEST_EMAIL,
                "password": TEST_PASSWORD
            })
            assert response.status_code == 200

            data = response.json()
            self.token = data["access_token"]
            self.headers = {"Authorization": f"Bearer {self.token}"}
            yield

    @pytest.mark.asyncio
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
                tx_data = tx_response.json()

                # 거래 합계 계산
                calculated_balance = 0
                for tx in tx_data["transactions"]:
                    if tx["type"] == "CHARGE":
                        calculated_balance += tx["amount"]
                    elif tx["type"] == "DEDUCT":
                        calculated_balance -= tx["amount"]
                    elif tx["type"] == "CANCEL":
                        # CANCEL은 원본 거래 유형에 따라 다름
                        # 간단화를 위해 거래 내역에서 직접 추적하지 않음
                        # (실제로는 원본 거래 조회 필요)
                        pass

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
