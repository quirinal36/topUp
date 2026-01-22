"""
사업자등록번호 검증 서비스
국세청 공공데이터 API를 통한 사업자등록정보 상태조회
"""
import re
import logging
import httpx
from typing import Optional
from pydantic import BaseModel

from ..config import get_settings

logger = logging.getLogger(__name__)

# 국세청 사업자등록정보 상태조회 API 엔드포인트
NTS_API_BASE_URL = "https://api.odcloud.kr/api/nts-businessman/v1"


class BusinessVerificationResult(BaseModel):
    """사업자등록번호 검증 결과"""
    is_valid: bool  # 유효한 사업자번호인지
    status_code: str  # 01: 계속사업자, 02: 휴업자, 03: 폐업자
    status_name: str  # 상태명 (계속사업자, 휴업자, 폐업자)
    tax_type: str  # 과세유형
    message: str  # 추가 메시지


def validate_business_number_format(business_number: str) -> bool:
    """
    사업자등록번호 형식 및 검증번호 유효성 검사

    사업자등록번호 검증 알고리즘:
    - 10자리 숫자
    - 마지막 1자리는 검증번호
    """
    # 숫자만 추출
    digits = re.sub(r'[^0-9]', '', business_number)

    if len(digits) != 10:
        return False

    # 검증번호 계산 알고리즘
    # 가중치: 1, 3, 7, 1, 3, 7, 1, 3, 5
    weights = [1, 3, 7, 1, 3, 7, 1, 3, 5]

    total = 0
    for i in range(9):
        total += int(digits[i]) * weights[i]

    # 8번째 자리는 특별 처리 (5를 곱한 후 10으로 나눈 몫)
    total += int(int(digits[8]) * 5 / 10)

    # 검증번호 계산
    check_digit = (10 - (total % 10)) % 10

    return check_digit == int(digits[9])


async def verify_business_number(business_number: str) -> BusinessVerificationResult:
    """
    국세청 API를 통해 사업자등록번호 상태 조회

    Args:
        business_number: 사업자등록번호 (하이픈 포함/미포함 모두 가능)

    Returns:
        BusinessVerificationResult: 검증 결과
    """
    settings = get_settings()

    # 숫자만 추출
    digits = re.sub(r'[^0-9]', '', business_number)

    # 형식 검사
    if not validate_business_number_format(digits):
        return BusinessVerificationResult(
            is_valid=False,
            status_code="",
            status_name="",
            tax_type="",
            message="사업자등록번호 형식이 올바르지 않습니다"
        )

    # API 키 확인
    api_key = getattr(settings, 'nts_api_key', None) or ""

    if not api_key:
        # API 키가 없으면 형식 검증만 통과
        logger.warning("[BIZ_VERIFY] NTS API key not configured, skipping API verification")
        return BusinessVerificationResult(
            is_valid=True,
            status_code="",
            status_name="형식 검증 완료",
            tax_type="",
            message="사업자등록번호 형식이 유효합니다 (API 미연동)"
        )

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                f"{NTS_API_BASE_URL}/status",
                params={"serviceKey": api_key},
                headers={
                    "accept": "application/json",
                    "Content-Type": "application/json"
                },
                json={"b_no": [digits]}
            )

            response.raise_for_status()
            result = response.json()

            if result.get("status_code") != "OK":
                logger.error(f"[BIZ_VERIFY] API error: {result}")
                return BusinessVerificationResult(
                    is_valid=False,
                    status_code="",
                    status_name="",
                    tax_type="",
                    message="사업자등록번호 조회에 실패했습니다"
                )

            data = result.get("data", [{}])[0]
            b_stt_cd = data.get("b_stt_cd", "")
            b_stt = data.get("b_stt", "")
            tax_type = data.get("tax_type", "")

            # 상태코드 해석
            # 01: 계속사업자, 02: 휴업자, 03: 폐업자
            if b_stt_cd == "01":
                return BusinessVerificationResult(
                    is_valid=True,
                    status_code=b_stt_cd,
                    status_name=b_stt or "계속사업자",
                    tax_type=tax_type,
                    message="유효한 사업자등록번호입니다"
                )
            elif b_stt_cd == "02":
                return BusinessVerificationResult(
                    is_valid=False,
                    status_code=b_stt_cd,
                    status_name=b_stt or "휴업자",
                    tax_type=tax_type,
                    message="휴업 상태인 사업자입니다"
                )
            elif b_stt_cd == "03":
                return BusinessVerificationResult(
                    is_valid=False,
                    status_code=b_stt_cd,
                    status_name=b_stt or "폐업자",
                    tax_type=tax_type,
                    message="폐업한 사업자입니다"
                )
            else:
                # 등록되지 않은 사업자
                return BusinessVerificationResult(
                    is_valid=False,
                    status_code="",
                    status_name="",
                    tax_type=tax_type,  # 이 필드에 에러 메시지가 올 수 있음
                    message="국세청에 등록되지 않은 사업자등록번호입니다"
                )

    except httpx.TimeoutException:
        logger.error("[BIZ_VERIFY] API timeout")
        return BusinessVerificationResult(
            is_valid=False,
            status_code="",
            status_name="",
            tax_type="",
            message="사업자등록번호 조회 중 시간이 초과되었습니다"
        )
    except httpx.HTTPStatusError as e:
        logger.error(f"[BIZ_VERIFY] HTTP error: {e.response.status_code}")
        return BusinessVerificationResult(
            is_valid=False,
            status_code="",
            status_name="",
            tax_type="",
            message="사업자등록번호 조회 중 오류가 발생했습니다"
        )
    except Exception as e:
        logger.error(f"[BIZ_VERIFY] Unexpected error: {str(e)}")
        return BusinessVerificationResult(
            is_valid=False,
            status_code="",
            status_name="",
            tax_type="",
            message="사업자등록번호 조회 중 오류가 발생했습니다"
        )
