#!/bin/bash

# 카페 선결제 관리 시스템 - 개발 서버 실행 스크립트

echo "🚀 카페 선결제 관리 시스템 시작..."

# 프로젝트 루트 디렉토리
ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
echo "$ROOT_DIR"

# 종료 시 모든 백그라운드 프로세스 종료
cleanup() {
    echo ""
    echo "👋 서버를 종료합니다..."
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    exit 0
}
trap cleanup SIGINT SIGTERM

# Backend 실행
echo "📦 Backend 서버 시작 (http://localhost:8000)..."
cd "$ROOT_DIR/backend"
source venv/bin/activate
python main.py &
BACKEND_PID=$!

# Frontend 실행
echo "🎨 Frontend 서버 시작 (http://localhost:5173)..."
cd "$ROOT_DIR/frontend"
npm run dev &
FRONTEND_PID=$!

echo ""
echo "✅ 서버가 실행되었습니다!"
echo "   - Frontend: http://localhost:5173"
echo "   - Backend:  http://localhost:8000"
echo "   - API Docs: http://localhost:8000/docs"
echo ""
echo "종료하려면 Ctrl+C를 누르세요."

# 백그라운드 프로세스가 끝날 때까지 대기
wait
