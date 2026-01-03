"""
Vercel Serverless Function Entry Point - Minimal Test Version
"""
from fastapi import FastAPI
from mangum import Mangum
import os

app = FastAPI(docs_url="/api/docs", openapi_url="/api/openapi.json")


@app.get("/api")
async def root():
    return {"message": "API is working!", "python_path": os.environ.get("PYTHONPATH", "not set")}


@app.get("/api/health")
async def health_check():
    return {"status": "healthy"}


@app.get("/api/env")
async def env_check():
    env_vars = ["SUPABASE_URL", "SUPABASE_KEY", "JWT_SECRET_KEY", "PYTHONPATH"]
    return {k: "set" if os.environ.get(k) else "missing" for k in env_vars}


handler = Mangum(app, lifespan="off")
