# Comings - 상점 선결제 관리 시스템

소규모 카페를 위한 고객 예치금 관리 솔루션입니다. 기존 스프레드시트 장부의 휴먼 에러를 방지하고, 실시간 잔액 조회 및 편리한 인터페이스를 제공합니다.

## 주요 기능

- **고객 관리** - 이름/연락처 기반 고객 등록 및 실시간 검색
- **충전/차감** - 선불 충전, 서비스 이용 차감, 거래 취소 지원
- **대시보드** - 일일 요약, 전체 예치금 현황, 통계 분석
- **보안** - 소셜 로그인(네이버/카카오) + PIN 기반 민감 작업 보호
- **멀티테넌트** - 상점별 데이터 격리

## 기술 스택

| 영역 | 기술 |
|------|------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, Zustand |
| Backend | FastAPI, Pydantic v2, Python 3.11+ |
| Database | Supabase (PostgreSQL) |
| Deployment | Vercel (Serverless) |

## 시작하기

### 사전 요구사항

- Node.js 18+
- Python 3.11+
- Supabase 프로젝트

### 환경 변수 설정

`backend/.env` 파일 생성:

```env
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_anon_key
SUPABASE_SERVICE_KEY=your_supabase_service_key
JWT_SECRET_KEY=your_jwt_secret

NAVER_CLIENT_ID=your_naver_client_id
NAVER_CLIENT_SECRET=your_naver_client_secret
KAKAO_CLIENT_ID=your_kakao_client_id
KAKAO_CLIENT_SECRET=your_kakao_client_secret

FRONTEND_URL=http://localhost:5173
```

### 설치 및 실행

```bash
# 저장소 클론
git clone https://github.com/your-username/topUp.git
cd topUp

# 백엔드 의존성 설치
cd backend
pip install -r requirements.txt

# 프론트엔드 의존성 설치
cd ../frontend
npm install

# 전체 실행 (루트 디렉토리에서)
cd ..
./start.sh
```

개발 서버:
- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- API 문서: http://localhost:8000/docs

## 프로젝트 구조

```
topUp/
├── api/                    # Vercel serverless 진입점
├── backend/
│   └── app/
│       ├── models/         # 데이터 모델
│       ├── schemas/        # 요청/응답 스키마
│       ├── routers/        # API 엔드포인트
│       └── services/       # 비즈니스 로직
├── frontend/
│   └── src/
│       ├── pages/          # 페이지 컴포넌트
│       ├── components/     # 재사용 UI 컴포넌트
│       ├── api/            # API 클라이언트
│       └── stores/         # Zustand 상태 관리
└── docs/                   # 프로젝트 문서
```

## API 엔드포인트

| 경로 | 설명 |
|------|------|
| `/api/auth/*` | 소셜 로그인, PIN 관리 |
| `/api/customers/*` | 고객 CRUD, 잔액 조회 |
| `/api/transactions/*` | 충전/차감, 거래 취소 |
| `/api/dashboard/*` | 통계 및 요약 |

## 라이선스

MIT License
