"""
유닛 테스트 설정
테스트 실행 전 필요한 환경 변수와 모킹을 설정합니다.
"""
import os
import sys
from unittest.mock import MagicMock, patch

# 테스트용 환경 변수 설정 (Settings 로딩 전에 반드시 실행)
os.environ["SUPABASE_URL"] = "https://test.supabase.co"
os.environ["SUPABASE_KEY"] = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRlc3QiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTYxNjk2MjY1OCwiZXhwIjoxOTMyNTM4NjU4fQ.test"
os.environ["SUPABASE_SERVICE_KEY"] = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRlc3QiLCJyb2xlIjoic2VydmljZV9yb2xlIiwiaWF0IjoxNjE2OTYyNjU4LCJleHAiOjE5MzI1Mzg2NTh9.test"
os.environ["JWT_SECRET_KEY"] = "test-jwt-secret-key-for-unit-testing-only-32chars"
os.environ["RESEND_API_KEY"] = "re_test_key"
os.environ["RESEND_FROM_EMAIL"] = "test@example.com"
os.environ["RESEND_FROM_NAME"] = "Test Sender"

# 프로젝트 루트 추가
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'backend'))

# Supabase 모듈 모킹 - import 전에 실행
mock_supabase_client = MagicMock()
mock_supabase_client.table.return_value.select.return_value.eq.return_value.execute.return_value = MagicMock(data=[])
mock_supabase_client.table.return_value.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value = MagicMock(data=None)
mock_supabase_client.table.return_value.insert.return_value.execute.return_value = MagicMock(data=[{"id": 1}])
mock_supabase_client.table.return_value.update.return_value.eq.return_value.execute.return_value = MagicMock(data=[{"id": 1}])
mock_supabase_client.rpc.return_value.execute.return_value = MagicMock(data=[{
    "success": True,
    "remaining_attempts": 5,
    "locked_until": None
}])

# supabase.create_client 모킹
sys.modules['supabase'] = MagicMock()
sys.modules['supabase'].create_client = MagicMock(return_value=mock_supabase_client)

import pytest

@pytest.fixture
def mock_db():
    """테스트용 Mock DB 클라이언트"""
    return mock_supabase_client
