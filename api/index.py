"""
Vercel Serverless Function Entry Point
FastAPI + Mangum
"""
import sys
import os

# backend 경로 추가
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from mangum import Mangum

app = FastAPI(
    title="카페 선결제 관리 시스템 API",
    docs_url="/api/docs",
    openapi_url="/api/openapi.json"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api")
async def root():
    return {"message": "카페 선결제 관리 시스템 API", "version": "1.0.0"}


@app.get("/api/health")
async def health_check():
    return {"status": "healthy"}


# 라우터 등록 시도
try:
    from app.config import get_settings
    from app.routers import auth_router, customers_router, transactions_router, dashboard_router

    settings = get_settings()

    app.include_router(auth_router)
    app.include_router(customers_router)
    app.include_router(transactions_router)
    app.include_router(dashboard_router)

    # CORS 업데이트
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
except Exception as e:
    print(f"Warning: Could not load routers: {e}")


# Vercel handler
handler = Mangum(app, lifespan="off")
