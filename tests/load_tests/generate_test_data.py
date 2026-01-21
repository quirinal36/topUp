"""
대규모 테스트 데이터 생성 스크립트
10만건 이상의 고객/거래 데이터 생성

실행 방법:
1. pip install httpx python-dotenv
2. tests/.env 파일 생성 (tests/.env.example 참고)
3. python generate_test_data.py --customers 1000 --transactions 100000

주의: 실제 운영 환경에서 실행하지 마세요!
"""
import os
import sys
import asyncio
import httpx
import random
import string
import argparse
from datetime import datetime, timedelta
from typing import List
import time
from pathlib import Path

# .env 파일 로드
from dotenv import load_dotenv
env_path = Path(__file__).parent.parent / ".env"
load_dotenv(env_path)

# 설정
API_URL = os.getenv("TEST_API_URL", "http://localhost:8000")
TEST_USERNAME = os.getenv("TEST_USERNAME", "testuser")
TEST_PASSWORD = os.getenv("TEST_PASSWORD", "testpassword123")

# 동시 요청 제한
MAX_CONCURRENT = 10
BATCH_SIZE = 100


class TestDataGenerator:
    """테스트 데이터 생성기"""

    def __init__(self):
        self.token = None
        self.headers = {}
        self.customer_ids = []
        self.stats = {
            "customers_created": 0,
            "customers_failed": 0,
            "transactions_created": 0,
            "transactions_failed": 0,
            "start_time": None,
            "end_time": None
        }

    async def login(self) -> bool:
        """로그인 (username/password 방식)"""
        async with httpx.AsyncClient(base_url=API_URL, timeout=30.0) as client:
            try:
                response = await client.post("/api/auth/login", json={
                    "username": TEST_USERNAME,
                    "password": TEST_PASSWORD
                })
                if response.status_code == 200:
                    data = response.json()
                    self.token = data["access_token"]
                    self.headers = {"Authorization": f"Bearer {self.token}"}
                    print(f"로그인 성공: {data['shop']['name']}")
                    return True
                else:
                    print(f"로그인 실패: {response.status_code}")
                    return False
            except Exception as e:
                print(f"로그인 오류: {e}")
                return False

    async def load_existing_customers(self):
        """기존 고객 목록 로드"""
        async with httpx.AsyncClient(base_url=API_URL, timeout=30.0) as client:
            page = 1
            while True:
                response = await client.get(
                    f"/api/customers?page={page}&page_size=100",
                    headers=self.headers
                )
                if response.status_code == 200:
                    data = response.json()
                    customers = data["customers"]
                    if not customers:
                        break
                    self.customer_ids.extend([c["id"] for c in customers])
                    page += 1
                else:
                    break
            print(f"기존 고객 {len(self.customer_ids)}명 로드")

    async def create_customers(self, count: int):
        """고객 대량 생성"""
        print(f"\n고객 {count:,}명 생성 시작...")

        async with httpx.AsyncClient(base_url=API_URL, timeout=60.0) as client:
            semaphore = asyncio.Semaphore(MAX_CONCURRENT)

            async def create_one_customer(index: int) -> bool:
                async with semaphore:
                    suffix = f"{index:04d}"[-4:]
                    name = f"테스트고객_{index:05d}"

                    try:
                        response = await client.post(
                            "/api/customers",
                            json={
                                "name": name,
                                "phone_suffix": suffix
                            },
                            headers=self.headers
                        )
                        if response.status_code == 201:
                            data = response.json()
                            self.customer_ids.append(data["id"])
                            return True
                        return False
                    except Exception:
                        return False

            # 배치로 처리
            for batch_start in range(0, count, BATCH_SIZE):
                batch_end = min(batch_start + BATCH_SIZE, count)
                tasks = [create_one_customer(i) for i in range(batch_start, batch_end)]
                results = await asyncio.gather(*tasks)

                success = sum(1 for r in results if r)
                self.stats["customers_created"] += success
                self.stats["customers_failed"] += len(results) - success

                progress = (batch_end / count) * 100
                print(f"  진행률: {progress:.1f}% ({batch_end:,}/{count:,})")

        print(f"고객 생성 완료: 성공 {self.stats['customers_created']:,}, "
              f"실패 {self.stats['customers_failed']:,}")

    async def create_transactions(self, count: int):
        """거래 대량 생성"""
        if not self.customer_ids:
            print("고객이 없어 거래를 생성할 수 없습니다.")
            return

        print(f"\n거래 {count:,}건 생성 시작...")
        print(f"대상 고객: {len(self.customer_ids):,}명")

        # 먼저 각 고객에게 충전
        print("\n1단계: 초기 충전 진행...")
        async with httpx.AsyncClient(base_url=API_URL, timeout=60.0) as client:
            semaphore = asyncio.Semaphore(MAX_CONCURRENT)

            async def initial_charge(customer_id: str) -> bool:
                async with semaphore:
                    try:
                        response = await client.post(
                            "/api/transactions/charge",
                            json={
                                "customer_id": customer_id,
                                "actual_payment": 1000000,  # 100만원
                                "service_amount": 100000,   # 10만원 서비스
                                "payment_method": "CASH",
                                "note": "초기 테스트 충전"
                            },
                            headers=self.headers
                        )
                        return response.status_code == 201
                    except Exception:
                        return False

            # 배치로 초기 충전
            for batch_start in range(0, len(self.customer_ids), BATCH_SIZE):
                batch_end = min(batch_start + BATCH_SIZE, len(self.customer_ids))
                batch_customers = self.customer_ids[batch_start:batch_end]
                tasks = [initial_charge(cid) for cid in batch_customers]
                results = await asyncio.gather(*tasks)
                success = sum(1 for r in results if r)
                print(f"  초기 충전: {batch_end:,}/{len(self.customer_ids):,} 완료")

        # 랜덤 거래 생성
        print("\n2단계: 랜덤 거래 생성...")

        async with httpx.AsyncClient(base_url=API_URL, timeout=60.0) as client:
            semaphore = asyncio.Semaphore(MAX_CONCURRENT)

            async def create_random_transaction(index: int) -> bool:
                async with semaphore:
                    customer_id = random.choice(self.customer_ids)
                    tx_type = random.choices(
                        ["charge", "deduct"],
                        weights=[40, 60],  # 충전 40%, 차감 60%
                        k=1
                    )[0]

                    try:
                        if tx_type == "charge":
                            amount = random.randint(1, 10) * 10000
                            service = random.randint(0, 2) * 5000
                            payment = random.choice(["CARD", "CASH", "TRANSFER"])
                            response = await client.post(
                                "/api/transactions/charge",
                                json={
                                    "customer_id": customer_id,
                                    "actual_payment": amount,
                                    "service_amount": service,
                                    "payment_method": payment,
                                    "note": f"테스트 충전 #{index}"
                                },
                                headers=self.headers
                            )
                        else:
                            amount = random.randint(1, 5) * 5000
                            response = await client.post(
                                "/api/transactions/deduct",
                                json={
                                    "customer_id": customer_id,
                                    "amount": amount,
                                    "note": f"테스트 차감 #{index}"
                                },
                                headers=self.headers
                            )

                        # 성공 또는 비즈니스 오류 모두 "완료"로 처리
                        return response.status_code in [201, 400]
                    except Exception:
                        return False

            # 배치로 거래 생성
            for batch_start in range(0, count, BATCH_SIZE):
                batch_end = min(batch_start + BATCH_SIZE, count)
                tasks = [create_random_transaction(i) for i in range(batch_start, batch_end)]
                results = await asyncio.gather(*tasks)

                success = sum(1 for r in results if r)
                self.stats["transactions_created"] += success
                self.stats["transactions_failed"] += len(results) - success

                progress = (batch_end / count) * 100
                print(f"  진행률: {progress:.1f}% ({batch_end:,}/{count:,})")

        print(f"\n거래 생성 완료: 성공 {self.stats['transactions_created']:,}, "
              f"실패 {self.stats['transactions_failed']:,}")

    def print_summary(self):
        """결과 요약 출력"""
        duration = (self.stats["end_time"] - self.stats["start_time"]).total_seconds()

        print("\n" + "="*60)
        print("테스트 데이터 생성 완료")
        print("="*60)
        print(f"소요 시간: {duration:.1f}초")
        print(f"\n고객:")
        print(f"  - 생성 성공: {self.stats['customers_created']:,}")
        print(f"  - 생성 실패: {self.stats['customers_failed']:,}")
        print(f"  - 총 고객 수: {len(self.customer_ids):,}")
        print(f"\n거래:")
        print(f"  - 생성 성공: {self.stats['transactions_created']:,}")
        print(f"  - 생성 실패: {self.stats['transactions_failed']:,}")

        if duration > 0:
            tx_per_sec = self.stats['transactions_created'] / duration
            print(f"\n처리량: {tx_per_sec:.1f} 거래/초")
        print("="*60)


async def main():
    parser = argparse.ArgumentParser(description="테스트 데이터 생성")
    parser.add_argument("--customers", type=int, default=100,
                        help="생성할 고객 수 (기본: 100)")
    parser.add_argument("--transactions", type=int, default=10000,
                        help="생성할 거래 수 (기본: 10000)")
    parser.add_argument("--skip-customers", action="store_true",
                        help="고객 생성 건너뛰기 (기존 고객 사용)")
    args = parser.parse_args()

    generator = TestDataGenerator()

    # 로그인
    if not await generator.login():
        print("로그인 실패. 종료합니다.")
        sys.exit(1)

    generator.stats["start_time"] = datetime.now()

    # 기존 고객 로드
    await generator.load_existing_customers()

    # 고객 생성
    if not args.skip_customers and args.customers > 0:
        await generator.create_customers(args.customers)

    # 거래 생성
    if args.transactions > 0:
        await generator.create_transactions(args.transactions)

    generator.stats["end_time"] = datetime.now()
    generator.print_summary()


if __name__ == "__main__":
    asyncio.run(main())
