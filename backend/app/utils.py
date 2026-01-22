"""
유틸리티 함수 모듈
"""
from datetime import datetime, timezone, timedelta

# 서울 시간대 (UTC+9)
SEOUL_TIMEZONE = timezone(timedelta(hours=9))


def now_seoul() -> datetime:
    """현재 서울 시간 반환 (UTC+9)"""
    return datetime.now(SEOUL_TIMEZONE)


def now_seoul_iso() -> str:
    """현재 서울 시간을 ISO 형식 문자열로 반환"""
    return now_seoul().isoformat()
