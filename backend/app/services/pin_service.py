"""
PIN 서비스
PIN 검증, 잠금, 해시 처리 등을 담당
"""
from datetime import datetime, timedelta
from typing import Tuple, Optional
import bcrypt
from supabase import Client

from ..database import get_supabase_admin_client

# PIN 정책 상수
MAX_FAILED_ATTEMPTS = 5
LOCK_DURATION_MINUTES = 1


class PinService:
    """PIN 관련 서비스"""

    def __init__(self, db: Client):
        self.db = db
        # RLS 우회를 위해 admin 클라이언트 사용
        self.admin_db = get_supabase_admin_client()

    @staticmethod
    def hash_pin(pin: str) -> str:
        """PIN 해시 생성"""
        return bcrypt.hashpw(pin.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

    @staticmethod
    def verify_pin_hash(plain_pin: str, hashed_pin: str) -> bool:
        """PIN 해시 검증"""
        if not hashed_pin:
            return False
        try:
            return bcrypt.checkpw(plain_pin.encode('utf-8'), hashed_pin.encode('utf-8'))
        except Exception:
            return False

    async def verify_pin(self, shop_id: str, pin: str) -> Tuple[bool, Optional[int], Optional[datetime]]:
        """
        PIN 검증 (원자적 처리로 Race Condition 방지)
        Returns: (verified, remaining_attempts, locked_until)
        """
        # 상점 정보 조회 (PIN 해시 확인용)
        result = self.admin_db.table("shops").select("pin_hash, pin_locked_until").eq("id", shop_id).maybe_single().execute()
        shop = result.data if result else None

        if not shop:
            return False, None, None

        # 잠금 상태 확인 (조기 확인, RPC에서도 다시 확인함)
        if shop.get("pin_locked_until"):
            locked_until = datetime.fromisoformat(shop["pin_locked_until"].replace("Z", "+00:00"))
            if datetime.now(locked_until.tzinfo) < locked_until:
                return False, 0, locked_until

        # PIN 검증
        pin_correct = self.verify_pin_hash(pin, shop["pin_hash"])

        # 원자적 PIN 시도 업데이트 (Race Condition 방지)
        rpc_result = self.admin_db.rpc("verify_and_update_pin_attempt", {
            "p_shop_id": shop_id,
            "p_success": pin_correct
        }).execute()

        if not rpc_result.data:
            return False, None, None

        result_data = rpc_result.data

        # RPC 결과 처리
        if result_data.get("error") == "SHOP_NOT_FOUND":
            return False, None, None

        if result_data.get("error") == "LOCKED":
            locked_until_str = result_data.get("locked_until")
            if locked_until_str:
                locked_until = datetime.fromisoformat(locked_until_str.replace("Z", "+00:00"))
                return False, 0, locked_until
            return False, 0, None

        if pin_correct and result_data.get("pin_verified"):
            return True, MAX_FAILED_ATTEMPTS, None

        # 실패 케이스
        if result_data.get("error") == "LOCKED_NOW":
            locked_until_str = result_data.get("locked_until")
            if locked_until_str:
                locked_until = datetime.fromisoformat(locked_until_str.replace("Z", "+00:00"))
                return False, 0, locked_until
            return False, 0, None

        remaining = result_data.get("remaining_attempts", 0)
        return False, remaining, None

    async def change_pin(self, shop_id: str, current_pin: str, new_pin: str) -> bool:
        """PIN 변경"""
        # 현재 PIN 검증
        verified, _, _ = await self.verify_pin(shop_id, current_pin)
        if not verified:
            return False

        # 새 PIN 저장
        new_hash = self.hash_pin(new_pin)
        self.admin_db.table("shops").update({
            "pin_hash": new_hash,
            "updated_at": datetime.now().isoformat()
        }).eq("id", shop_id).execute()

        return True

    async def reset_pin(self, shop_id: str, new_pin: str) -> bool:
        """PIN 재설정 (소셜 로그인 재인증 후)"""
        new_hash = self.hash_pin(new_pin)
        self.admin_db.table("shops").update({
            "pin_hash": new_hash,
            "pin_failed_count": 0,
            "pin_locked_until": None,
            "updated_at": datetime.now().isoformat()
        }).eq("id", shop_id).execute()

        return True
