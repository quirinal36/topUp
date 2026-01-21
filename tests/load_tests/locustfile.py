"""
부하 테스트 스크립트 - Locust
10만건 이상의 데이터를 처리하며 시스템 안정성 검증

실행 방법:
1. pip install locust python-dotenv
2. tests/.env 파일 생성 (tests/.env.example 참고)
3. cd tests/load_tests
4. locust -f locustfile.py --host=http://localhost:8000

웹 UI: http://localhost:8089
"""
import os
import random
import string
from locust import HttpUser, task, between, events
from datetime import datetime
import json
from pathlib import Path

# .env 파일 로드
from dotenv import load_dotenv
env_path = Path(__file__).parent.parent / ".env"
load_dotenv(env_path)

# 환경 변수에서 테스트 설정 로드
TEST_USERNAME = os.getenv("TEST_USERNAME", "testuser")
TEST_PASSWORD = os.getenv("TEST_PASSWORD", "testpassword123")


class CafePrepaidUser(HttpUser):
    """카페 선결제 시스템 부하 테스트 사용자"""

    wait_time = between(0.5, 2)  # 요청 간 0.5-2초 대기

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.token = None
        self.shop_id = None
        self.customer_ids = []
        self.transaction_ids = []

    def on_start(self):
        """테스트 시작 시 로그인"""
        self.login()
        if self.token:
            self.load_customers()

    def login(self):
        """로그인하여 토큰 획득 (username/password 방식)"""
        with self.client.post("/api/auth/login", json={
            "username": TEST_USERNAME,
            "password": TEST_PASSWORD
        }, catch_response=True) as response:
            if response.status_code == 200:
                data = response.json()
                self.token = data.get("access_token")
                self.shop_id = data.get("shop", {}).get("id")
                response.success()
            else:
                response.failure(f"Login failed: {response.status_code}")

    def load_customers(self):
        """테스트에 사용할 고객 목록 로드"""
        headers = {"Authorization": f"Bearer {self.token}"}
        response = self.client.get(
            "/api/customers?page_size=100",
            headers=headers,
            name="/api/customers (load)"
        )

        if response.status_code == 200:
            data = response.json()
            self.customer_ids = [c["id"] for c in data.get("customers", [])]

    def get_auth_headers(self):
        """인증 헤더 반환"""
        return {"Authorization": f"Bearer {self.token}"} if self.token else {}

    @task(30)
    def list_customers(self):
        """고객 목록 조회 (가장 빈번한 작업)"""
        if not self.token:
            return

        page = random.randint(1, 10)
        response = self.client.get(
            f"/api/customers?page={page}&page_size=20",
            headers=self.get_auth_headers(),
            name="/api/customers"
        )

    @task(20)
    def list_transactions(self):
        """거래 내역 조회"""
        if not self.token:
            return

        page = random.randint(1, 10)
        response = self.client.get(
            f"/api/transactions?page={page}&page_size=20",
            headers=self.get_auth_headers(),
            name="/api/transactions"
        )

    @task(15)
    def get_customer_detail(self):
        """고객 상세 조회"""
        if not self.token or not self.customer_ids:
            return

        customer_id = random.choice(self.customer_ids)
        response = self.client.get(
            f"/api/customers/{customer_id}",
            headers=self.get_auth_headers(),
            name="/api/customers/[id]"
        )

    @task(10)
    def charge_customer(self):
        """고객 충전 (중요 트랜잭션)"""
        if not self.token or not self.customer_ids:
            return

        customer_id = random.choice(self.customer_ids)
        amount = random.randint(1, 10) * 10000  # 1만~10만원
        service = random.randint(0, 2) * 5000   # 0~1만원 서비스
        payment_method = random.choice(["CARD", "CASH", "TRANSFER"])

        with self.client.post(
            "/api/transactions/charge",
            json={
                "customer_id": customer_id,
                "actual_payment": amount,
                "service_amount": service,
                "payment_method": payment_method,
                "note": f"Load test charge {datetime.now().isoformat()}"
            },
            headers=self.get_auth_headers(),
            name="/api/transactions/charge",
            catch_response=True
        ) as response:
            if response.status_code == 201:
                data = response.json()
                self.transaction_ids.append(data.get("id"))
                response.success()
            elif response.status_code in [400, 401, 403, 404]:
                response.success()  # 비즈니스 오류는 성공으로 처리
            else:
                response.failure(f"Charge failed: {response.status_code}")

    @task(10)
    def deduct_customer(self):
        """고객 차감 (중요 트랜잭션)"""
        if not self.token or not self.customer_ids:
            return

        customer_id = random.choice(self.customer_ids)
        amount = random.randint(1, 5) * 5000  # 5천~2만5천원

        with self.client.post(
            "/api/transactions/deduct",
            json={
                "customer_id": customer_id,
                "amount": amount,
                "note": f"Load test deduct {datetime.now().isoformat()}"
            },
            headers=self.get_auth_headers(),
            name="/api/transactions/deduct",
            catch_response=True
        ) as response:
            if response.status_code == 201:
                data = response.json()
                self.transaction_ids.append(data.get("id"))
                response.success()
            elif response.status_code in [400, 401, 403, 404]:
                response.success()  # 잔액 부족 등 비즈니스 오류는 성공으로 처리
            else:
                response.failure(f"Deduct failed: {response.status_code}")

    @task(5)
    def dashboard_summary(self):
        """대시보드 요약 조회"""
        if not self.token:
            return

        response = self.client.get(
            "/api/dashboard/summary",
            headers=self.get_auth_headers(),
            name="/api/dashboard/summary"
        )

    @task(3)
    def dashboard_analytics(self):
        """대시보드 분석 데이터 조회"""
        if not self.token:
            return

        period = random.choice(["daily", "weekly", "monthly"])
        response = self.client.get(
            f"/api/dashboard/analytics/period?period={period}",
            headers=self.get_auth_headers(),
            name="/api/dashboard/analytics/period"
        )

    @task(2)
    def create_customer(self):
        """새 고객 생성"""
        if not self.token:
            return

        random_suffix = ''.join(random.choices(string.digits, k=4))
        random_name = f"테스트_{random_suffix}"

        with self.client.post(
            "/api/customers",
            json={
                "name": random_name,
                "phone_suffix": random_suffix
            },
            headers=self.get_auth_headers(),
            name="/api/customers (create)",
            catch_response=True
        ) as response:
            if response.status_code == 201:
                data = response.json()
                self.customer_ids.append(data.get("id"))
                response.success()
            elif response.status_code in [400, 409]:
                response.success()  # 중복 등 비즈니스 오류
            else:
                response.failure(f"Create customer failed: {response.status_code}")

    @task(1)
    def cancel_transaction(self):
        """거래 취소 (가장 드문 작업)"""
        if not self.token or not self.transaction_ids:
            return

        # 가장 최근 트랜잭션 중 하나 선택
        if len(self.transaction_ids) > 10:
            transaction_id = self.transaction_ids.pop(random.randint(-10, -1))
        else:
            return

        with self.client.post(
            "/api/transactions/cancel",
            json={
                "transaction_id": transaction_id,
                "reason": "Load test cancellation"
            },
            headers=self.get_auth_headers(),
            name="/api/transactions/cancel",
            catch_response=True
        ) as response:
            if response.status_code == 201:
                response.success()
            elif response.status_code in [400, 401, 403, 404]:
                response.success()  # 비즈니스 오류
            else:
                response.failure(f"Cancel failed: {response.status_code}")


class HighLoadUser(CafePrepaidUser):
    """높은 부하 시뮬레이션 - 동시 충전/차감 집중"""

    wait_time = between(0.1, 0.5)  # 더 짧은 대기 시간

    @task(40)
    def charge_customer(self):
        """고객 충전 (집중)"""
        super().charge_customer()

    @task(40)
    def deduct_customer(self):
        """고객 차감 (집중)"""
        super().deduct_customer()

    @task(10)
    def list_customers(self):
        """고객 목록 조회 (감소)"""
        super().list_customers()

    @task(10)
    def list_transactions(self):
        """거래 내역 조회 (감소)"""
        super().list_transactions()


# 테스트 이벤트 핸들러
@events.test_start.add_listener
def on_test_start(environment, **kwargs):
    """테스트 시작 시"""
    print("="*60)
    print("부하 테스트 시작")
    print(f"테스트 대상: {environment.host}")
    print("="*60)


@events.test_stop.add_listener
def on_test_stop(environment, **kwargs):
    """테스트 종료 시"""
    print("="*60)
    print("부하 테스트 완료")
    print("="*60)
