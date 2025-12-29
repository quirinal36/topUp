"""
카페 선결제 관리 시스템 - FastAPI 메인 애플리케이션
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.config import get_settings
from app.routers import auth_router, customers_router, transactions_router, dashboard_router

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """애플리케이션 시작/종료 시 실행되는 작업"""
    # 시작 시
    print("🚀 카페 선결제 관리 시스템 시작")
    yield
    # 종료 시
    print("👋 카페 선결제 관리 시스템 종료")


# FastAPI 앱 생성
app = FastAPI(
    title="카페 선결제 관리 시스템 API",
    description="카페 선결제(예치금) 관리를 위한 REST API",
    version="1.0.0",
    lifespan=lifespan
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


@app.get("/")
async def root():
    """API 루트"""
    return {
        "message": "카페 선결제 관리 시스템 API",
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
