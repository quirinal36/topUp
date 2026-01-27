"""
대시보드 및 통계 API 라우터
SQL RPC 함수로 최적화됨
"""
from fastapi import APIRouter, Depends, Query
from typing import Optional
from datetime import datetime, date, timedelta
from collections import Counter

from ..database import get_supabase_admin_client
from ..routers.auth import get_current_shop
from ..schemas.transaction import (
    DashboardSummary,
    AnalyticsPeriod,
    TopCustomer,
    PaymentMethodStats
)
from ..models.transaction import PaymentMethod

router = APIRouter(prefix="/api/dashboard", tags=["대시보드"])


@router.get("/summary", response_model=DashboardSummary)
async def get_dashboard_summary(
    shop_id: str = Depends(get_current_shop)
):
    """대시보드 요약 정보 (SQL 최적화)"""
    db = get_supabase_admin_client()

    # RPC 함수로 단일 쿼리 실행
    result = db.rpc("get_dashboard_summary", {"p_shop_id": shop_id}).execute()

    if result.data and len(result.data) > 0:
        data = result.data[0]
        return DashboardSummary(
            today_total_charge=data["today_total_charge"] or 0,
            today_total_deduct=data["today_total_deduct"] or 0,
            total_balance=data["total_balance"] or 0,
            total_customers=data["total_customers"] or 0
        )

    return DashboardSummary(
        today_total_charge=0,
        today_total_deduct=0,
        total_balance=0,
        total_customers=0
    )


@router.get("/analytics/period")
async def get_period_analytics(
    period_type: str = Query("daily", enum=["daily", "weekly", "monthly"]),
    start_date: Optional[str] = Query(None, description="시작일 (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="종료일 (YYYY-MM-DD)"),
    shop_id: str = Depends(get_current_shop)
):
    """기간별 매출 현황 (SQL 최적화)"""
    db = get_supabase_admin_client()

    # 기간 설정
    if not end_date:
        end = date.today()
    else:
        end = datetime.strptime(end_date, "%Y-%m-%d").date()

    if not start_date:
        if period_type == "daily":
            start = end - timedelta(days=7)
        elif period_type == "weekly":
            start = end - timedelta(weeks=4)
        else:
            start = end - timedelta(days=90)
    else:
        start = datetime.strptime(start_date, "%Y-%m-%d").date()

    # RPC 함수로 단일 쿼리 실행
    result = db.rpc("get_period_analytics", {
        "p_shop_id": shop_id,
        "p_period_type": period_type,
        "p_start_date": start.isoformat(),
        "p_end_date": end.isoformat()
    }).execute()

    return [
        AnalyticsPeriod(
            period=row["period"],
            charge_amount=row["charge_amount"] or 0,
            deduct_amount=row["deduct_amount"] or 0,
            transaction_count=row["transaction_count"] or 0
        )
        for row in result.data
    ]


@router.get("/analytics/top-customers")
async def get_top_customers(
    limit: int = Query(10, ge=1, le=50),
    shop_id: str = Depends(get_current_shop)
):
    """상위 충전 고객 순위 (SQL 최적화)"""
    db = get_supabase_admin_client()

    # RPC 함수로 단일 쿼리 실행
    result = db.rpc("get_top_customers", {
        "p_shop_id": shop_id,
        "p_limit": limit
    }).execute()

    return [
        TopCustomer(
            customer_id=row["customer_id"],
            name=row["name"] or "Unknown",
            total_charged=row["total_charged"] or 0,
            visit_count=row["visit_count"] or 0
        )
        for row in result.data
    ]


@router.get("/analytics/payment-methods")
async def get_payment_method_stats(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    shop_id: str = Depends(get_current_shop)
):
    """결제 수단별 현황 (SQL 최적화)"""
    db = get_supabase_admin_client()

    # RPC 함수로 단일 쿼리 실행
    result = db.rpc("get_payment_method_stats", {
        "p_shop_id": shop_id,
        "p_start_date": start_date,
        "p_end_date": end_date
    }).execute()

    return [
        PaymentMethodStats(
            method=PaymentMethod(row["method"]),
            count=row["count"] or 0,
            amount=row["amount"] or 0,
            percentage=float(row["percentage"] or 0)
        )
        for row in result.data
    ]


@router.get("/analytics/popular-menus")
async def get_popular_menus(
    limit: int = Query(10, ge=1, le=50),
    shop_id: str = Depends(get_current_shop)
):
    """인기 메뉴 분석 (비고 기반)"""
    # RLS 우회를 위해 admin 클라이언트 사용
    db = get_supabase_admin_client()

    customers = db.table("customers").select("id").eq("shop_id", shop_id).execute()
    customer_ids = [c["id"] for c in customers.data]

    if not customer_ids:
        return []

    # 차감 거래의 비고 조회
    transactions = db.table("transactions").select("note").in_(
        "customer_id", customer_ids
    ).eq("type", "DEDUCT").not_.is_("note", "null").execute()

    # 메뉴 카운트 (간단한 분석)
    menu_counter = Counter()
    for t in transactions.data:
        note = t.get("note", "")
        if note:
            # 쉼표로 분리하여 개별 메뉴로 카운트
            items = [item.strip() for item in note.split(",")]
            for item in items:
                if item:
                    menu_counter[item] += 1

    return [
        {"menu": menu, "count": count}
        for menu, count in menu_counter.most_common(limit)
    ]
