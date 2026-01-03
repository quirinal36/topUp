"""
Vercel Serverless Function Entry Point
FastAPI 앱을 Vercel에서 실행하기 위한 핸들러
"""
import sys
import os

# backend 모듈을 import 할 수 있도록 경로 추가
backend_path = os.path.join(os.path.dirname(__file__), '..', 'backend')
sys.path.insert(0, backend_path)

# 디버그: 환경 변수 확인
print(f"PYTHONPATH: {os.environ.get('PYTHONPATH', 'not set')}")
print(f"Backend path: {backend_path}")
print(f"sys.path: {sys.path[:3]}")

try:
    from fastapi import FastAPI
    from fastapi.middleware.cors import CORSMiddleware
    from mangum import Mangum
    print("FastAPI, Mangum imported successfully")

    from app.config import get_settings
    print("config imported successfully")

    from app.routers import auth_router, customers_router, transactions_router, dashboard_router
    print("routers imported successfully")

    settings = get_settings()
    print(f"Settings loaded: app_env={settings.app_env}")
except Exception as e:
    print(f"Import error: {type(e).__name__}: {e}")
    import traceback
    traceback.print_exc()
    raise

# FastAPI 앱 생성
app = FastAPI(
    title="카페 선결제 관리 시스템 API",
    description="카페 선결제(예치금) 관리를 위한 REST API",
    version="1.0.0",
    docs_url="/api/docs",
    openapi_url="/api/openapi.json"
)

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 라우터 등록
app.include_router(auth_router)
app.include_router(customers_router)
app.include_router(transactions_router)
app.include_router(dashboard_router)


@app.get("/api")
async def root():
    """API 루트"""
    return {
        "message": "카페 선결제 관리 시스템 API",
        "version": "1.0.0",
        "docs": "/api/docs"
    }


@app.get("/api/health")
async def health_check():
    """헬스 체크"""
    return {"status": "healthy"}


# Vercel Serverless Handler
handler = Mangum(app, lifespan="off")
