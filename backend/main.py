"""
선결제 관리 플랫폼 커밍스 (Comings) - FastAPI 메인 애플리케이션
"""
import os
import traceback
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.config import get_settings
from app.routers import auth_router, customers_router, transactions_router, dashboard_router, menus_router, onboarding_router

# Sentry 초기화 (DSN이 있을 때만)
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.starlette import StarletteIntegration

settings = get_settings()

if settings.sentry_dsn:
    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        environment=settings.app_env,
        integrations=[
            StarletteIntegration(transaction_style="endpoint"),
            FastApiIntegration(transaction_style="endpoint"),
        ],
        traces_sample_rate=0.1,
        send_default_pii=False,
    )

# Vercel 환경인지 확인
IS_VERCEL = os.environ.get("VERCEL", False)

# FastAPI 앱 생성
app = FastAPI(
    title="선결제 관리 플랫폼 커밍스 API",
    description="선결제(예치금) 관리를 위한 REST API - Comings",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

# CORS 설정 (개발 환경에서는 모든 origin 허용)
if settings.app_env == "development":
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,  # allow_origins=["*"]와 함께 사용 시 False 필요
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
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
app.include_router(menus_router)
app.include_router(onboarding_router)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """전역 예외 핸들러 - Sentry 연동"""
    if settings.sentry_dsn:
        sentry_sdk.capture_exception(exc)

    if settings.app_env == "production":
        return JSONResponse(
            status_code=500,
            content={"detail": "서버 오류가 발생했습니다."}
        )

    return JSONResponse(
        status_code=500,
        content={
            "detail": str(exc),
            "type": type(exc).__name__,
            "traceback": traceback.format_exc()
        }
    )


@app.get("/")
async def root():
    """API 루트"""
    return {
        "message": "선결제 관리 플랫폼 커밍스 API",
        "version": "1.0.0",
        "docs": "/docs"
    }


@app.get("/health")
async def health_check():
    """헬스 체크"""
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
