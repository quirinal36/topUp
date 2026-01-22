"""
선결제 관리 플랫폼 커밍스 (Comings) - FastAPI 메인 애플리케이션
"""
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import get_settings
from app.routers import auth_router, customers_router, transactions_router, dashboard_router, menus_router, onboarding_router

settings = get_settings()

# Vercel 환경인지 확인
IS_VERCEL = os.environ.get("VERCEL", False)

# FastAPI 앱 생성 (Vercel에서는 lifespan 비활성화)
app = FastAPI(
    title="선결제 관리 플랫폼 커밍스 API",
    description="선결제(예치금) 관리를 위한 REST API - Comings",
    version="1.0.0",
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
