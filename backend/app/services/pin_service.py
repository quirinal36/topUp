"""
PIN 서비스
PIN 검증, 잠금, 해시 처리 등을 담당
"""
from datetime import datetime, timedelta
from typing import Tuple, Optional
from passlib.context import CryptContext
from supabase import Client

# PIN 해시 설정
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# PIN 정책 상수
MAX_FAILED_ATTEMPTS = 5
LOCK_DURATION_MINUTES = 1


class PinService:
    """PIN 관련 서비스"""

    def __init__(self, db: Client):
        self.db = db

    @staticmethod
    def hash_pin(pin: str) -> str:
        """PIN 해시 생성"""
        return pwd_context.hash(pin)

    @staticmethod
    def verify_pin_hash(plain_pin: str, hashed_pin: str) -> bool:
        """PIN 해시 검증"""
        return pwd_context.verify(plain_pin, hashed_pin)

    async def verify_pin(self, shop_id: str, pin: str) -> Tuple[bool, Optional[int], Optional[datetime]]:
        """
        PIN 검증
        Returns: (verified, remaining_attempts, locked_until)
        """
        # 상점 정보 조회
        result = self.db.table("shops").select("*").eq("id", shop_id).single().execute()
        shop = result.data

        if not shop:
            return False, None, None

        # 잠금 상태 확인
        if shop.get("pin_locked_until"):
            locked_until = datetime.fromisoformat(shop["pin_locked_until"].replace("Z", "+00:00"))
            if datetime.now(locked_until.tzinfo) < locked_until:
                return False, 0, locked_until

            # 잠금 해제
            self.db.table("shops").update({
                "pin_failed_count": 0,
                "pin_locked_until": None
            }).eq("id", shop_id).execute()

        # PIN 검증
        if self.verify_pin_hash(pin, shop["pin_hash"]):
            # 성공 시 실패 횟수 초기화
            if shop.get("pin_failed_count", 0) > 0:
                self.db.table("shops").update({
                    "pin_failed_count": 0
                }).eq("id", shop_id).execute()
            return True, MAX_FAILED_ATTEMPTS, None

        # 실패 처리
        failed_count = shop.get("pin_failed_count", 0) + 1
        remaining = MAX_FAILED_ATTEMPTS - failed_count

        update_data = {"pin_failed_count": failed_count}

        # 최대 실패 시 잠금
        if failed_count >= MAX_FAILED_ATTEMPTS:
            locked_until = datetime.now() + timedelta(minutes=LOCK_DURATION_MINUTES)
            update_data["pin_locked_until"] = locked_until.isoformat()
            self.db.table("shops").update(update_data).eq("id", shop_id).execute()
            return False, 0, locked_until

        self.db.table("shops").update(update_data).eq("id", shop_id).execute()
        return False, remaining, None

    async def change_pin(self, shop_id: str, current_pin: str, new_pin: str) -> bool:
        """PIN 변경"""
        # 현재 PIN 검증
        verified, _, _ = await self.verify_pin(shop_id, current_pin)
        if not verified:
            return False

        # 새 PIN 저장
        new_hash = self.hash_pin(new_pin)
        self.db.table("shops").update({
            "pin_hash": new_hash,
            "updated_at": datetime.now().isoformat()
        }).eq("id", shop_id).execute()

        return True

    async def reset_pin(self, shop_id: str, new_pin: str) -> bool:
        """PIN 재설정 (소셜 로그인 재인증 후)"""
        new_hash = self.hash_pin(new_pin)
        self.db.table("shops").update({
            "pin_hash": new_hash,
            "pin_failed_count": 0,
            "pin_locked_until": None,
            "updated_at": datetime.now().isoformat()
        }).eq("id", shop_id).execute()

        return True
