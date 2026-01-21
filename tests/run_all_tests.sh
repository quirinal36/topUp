#!/bin/bash
# 전체 테스트 실행 스크립트

set -e

echo "============================================"
echo "카페 선결제 시스템 - 전체 테스트 실행"
echo "============================================"

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 테스트 디렉토리로 이동
cd "$(dirname "$0")"

# 환경 변수 확인
if [ ! -f .env ]; then
    echo -e "${YELLOW}경고: .env 파일이 없습니다. .env.example을 복사하세요.${NC}"
    echo "cp .env.example .env"
    echo "그리고 테스트 계정 정보를 입력하세요."
    exit 1
fi

# 가상환경 활성화 (있는 경우)
if [ -d "../.venv" ]; then
    source ../.venv/bin/activate
elif [ -d "../venv" ]; then
    source ../venv/bin/activate
fi

# 의존성 설치 확인
echo ""
echo -e "${YELLOW}[1/4] 의존성 확인 중...${NC}"
pip install -q -r requirements.txt

# 유닛 테스트 실행
echo ""
echo -e "${YELLOW}[2/4] 유닛 테스트 실행 중...${NC}"
echo "----------------------------------------"

# backend 디렉토리를 PYTHONPATH에 추가
export PYTHONPATH="${PYTHONPATH}:$(pwd)/../backend"

pytest unit_tests/ -v --tb=short 2>&1 || {
    echo -e "${RED}유닛 테스트 실패!${NC}"
    exit 1
}

echo -e "${GREEN}유닛 테스트 완료!${NC}"

# Race Condition 테스트 실행
echo ""
echo -e "${YELLOW}[3/4] Race Condition 테스트 실행 중...${NC}"
echo "----------------------------------------"
echo "참고: 이 테스트는 실행 중인 API 서버가 필요합니다."
read -p "API 서버가 실행 중입니까? (y/n) " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
    pytest race_condition_tests/ -v -s --tb=short 2>&1 || {
        echo -e "${RED}Race Condition 테스트 실패!${NC}"
        exit 1
    }
    echo -e "${GREEN}Race Condition 테스트 완료!${NC}"
else
    echo -e "${YELLOW}Race Condition 테스트 건너뜀${NC}"
fi

# 부하 테스트 안내
echo ""
echo -e "${YELLOW}[4/4] 부하 테스트 안내${NC}"
echo "----------------------------------------"
echo "부하 테스트는 별도로 실행해야 합니다:"
echo ""
echo "  # 웹 UI 모드 (http://localhost:8089)"
echo "  cd load_tests && locust -f locustfile.py --host=http://localhost:8000"
echo ""
echo "  # 커맨드 라인 모드 (100 사용자, 5분)"
echo "  cd load_tests && locust -f locustfile.py --host=http://localhost:8000 \\"
echo "      --users 100 --spawn-rate 10 --run-time 5m --headless"
echo ""

# 결과 요약
echo ""
echo "============================================"
echo -e "${GREEN}테스트 완료!${NC}"
echo "============================================"
echo ""
echo "다음 단계:"
echo "  1. 부하 테스트 실행 (위 명령어 참고)"
echo "  2. 수동 테스트 시나리오 진행"
echo "     docs/MANUAL_TEST_SCENARIOS.md 참고"
echo ""
