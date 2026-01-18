#!/bin/bash
# 테스트 대시보드 실행 스크립트

PORT=${1:-8080}
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "============================================"
echo "  카페 선결제 시스템 - 테스트 대시보드"
echo "============================================"
echo ""
echo "서버 시작 중... (포트: $PORT)"
echo ""
echo "브라우저에서 아래 주소로 접속하세요:"
echo ""
echo "  http://localhost:$PORT/dashboard.html"
echo ""
echo "종료하려면 Ctrl+C를 누르세요."
echo "============================================"
echo ""

cd "$DIR"
python3 -m http.server $PORT
