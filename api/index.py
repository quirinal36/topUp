"""
Vercel Serverless Function Entry Point
FastAPI 앱을 Vercel에서 실행하기 위한 핸들러
"""
import sys
import os

# backend 모듈을 import 할 수 있도록 경로 추가
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from mangum import Mangum

from app.config import get_settings
from app.routers import auth_router, customers_router, transactions_router, dashboard_router

settings = get_settings()

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
