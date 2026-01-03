"""
Vercel Serverless Function Entry Point
FastAPI 앱을 Vercel에서 실행하기 위한 핸들러
"""
import sys
import os

# backend 모듈을 import 할 수 있도록 경로 추가
backend_path = os.path.join(os.path.dirname(__file__), '..', 'backend')
sys.path.insert(0, backend_path)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from mangum import Mangum

# 먼저 간단한 앱 생성
app = FastAPI(
    title="카페 선결제 관리 시스템 API",
    description="카페 선결제(예치금) 관리를 위한 REST API",
    version="1.0.0",
    docs_url="/api/docs",
    openapi_url="/api/openapi.json"
)

# 기본 CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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


@app.get("/api/debug")
async def debug_info():
    """디버그 정보"""
    import_status = {}

    # 환경 변수 확인
    env_vars = ["SUPABASE_URL", "SUPABASE_KEY", "JWT_SECRET_KEY"]
    env_status = {k: "set" if os.environ.get(k) else "missing" for k in env_vars}

    # 모듈 import 테스트
    try:
        from app.config import get_settings
        import_status["config"] = "ok"
        settings = get_settings()
        import_status["settings"] = f"ok (app_env={settings.app_env})"
    except Exception as e:
        import_status["config"] = f"error: {e}"

    try:
        from app.routers import auth_router
        import_status["routers"] = "ok"
    except Exception as e:
        import_status["routers"] = f"error: {e}"

    return {
        "sys_path": sys.path[:3],
        "backend_path": backend_path,
        "env_status": env_status,
        "import_status": import_status
    }


# 라우터 등록 시도
try:
    from app.config import get_settings
    from app.routers import auth_router, customers_router, transactions_router, dashboard_router

    settings = get_settings()

    # CORS 업데이트
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(auth_router)
    app.include_router(customers_router)
    app.include_router(transactions_router)
    app.include_router(dashboard_router)
except Exception as e:
    # 라우터 등록 실패해도 기본 엔드포인트는 작동
    print(f"Router registration failed: {e}")


# Vercel Serverless Handler
handler = Mangum(app, lifespan="off")
