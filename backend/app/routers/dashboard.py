"""
대시보드 및 통계 API 라우터
"""
from fastapi import APIRouter, Depends, Query
from typing import Optional
from datetime import datetime, date, timedelta
from collections import Counter

from ..database import get_db
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
    shop_id: str = Depends(get_current_shop),
    db=Depends(get_db)
):
    """대시보드 요약 정보"""
    # 해당 상점의 고객 목록
    customers = db.table("customers").select("id, current_balance").eq("shop_id", shop_id).execute()
    customer_ids = [c["id"] for c in customers.data]

    # 오늘 날짜 범위
    today = date.today()
    today_start = datetime.combine(today, datetime.min.time()).isoformat()
    today_end = datetime.combine(today, datetime.max.time()).isoformat()

    # 오늘 거래 조회
    if customer_ids:
        today_transactions = db.table("transactions").select("type, amount").in_(
            "customer_id", customer_ids
        ).gte("created_at", today_start).lte("created_at", today_end).execute()

        today_charge = sum(t["amount"] for t in today_transactions.data if t["type"] == "CHARGE")
        today_deduct = sum(t["amount"] for t in today_transactions.data if t["type"] == "DEDUCT")
    else:
        today_charge = 0
        today_deduct = 0

    # 전체 잔액 합계
    total_balance = sum(c["current_balance"] for c in customers.data)

    return DashboardSummary(
        today_total_charge=today_charge,
        today_total_deduct=today_deduct,
        total_balance=total_balance,
        total_customers=len(customers.data)
    )


@router.get("/analytics/period")
async def get_period_analytics(
    period_type: str = Query("daily", enum=["daily", "weekly", "monthly"]),
    start_date: Optional[str] = Query(None, description="시작일 (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="종료일 (YYYY-MM-DD)"),
    shop_id: str = Depends(get_current_shop),
    db=Depends(get_db)
):
    """기간별 매출 현황"""
    # 해당 상점의 고객 목록
    customers = db.table("customers").select("id").eq("shop_id", shop_id).execute()
    customer_ids = [c["id"] for c in customers.data]

    if not customer_ids:
        return []

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

    # 거래 조회
    transactions = db.table("transactions").select("type, amount, created_at").in_(
        "customer_id", customer_ids
    ).gte("created_at", start.isoformat()).lte("created_at", end.isoformat()).execute()

    # 기간별 집계
    period_data = {}
    for t in transactions.data:
        tx_date = datetime.fromisoformat(t["created_at"].replace("Z", "+00:00")).date()

        if period_type == "daily":
            key = tx_date.isoformat()
        elif period_type == "weekly":
            key = tx_date.strftime("%Y-W%W")
        else:
            key = tx_date.strftime("%Y-%m")

        if key not in period_data:
            period_data[key] = {"charge": 0, "deduct": 0, "count": 0}

        if t["type"] == "CHARGE":
            period_data[key]["charge"] += t["amount"]
        elif t["type"] == "DEDUCT":
            period_data[key]["deduct"] += t["amount"]
        period_data[key]["count"] += 1

    return [
        AnalyticsPeriod(
            period=key,
            charge_amount=data["charge"],
            deduct_amount=data["deduct"],
            transaction_count=data["count"]
        )
        for key, data in sorted(period_data.items())
    ]


@router.get("/analytics/top-customers")
async def get_top_customers(
    limit: int = Query(10, ge=1, le=50),
    shop_id: str = Depends(get_current_shop),
    db=Depends(get_db)
):
    """상위 충전 고객 순위"""
    # 해당 상점의 고객 목록
    customers = db.table("customers").select("id, name").eq("shop_id", shop_id).execute()
    customer_map = {c["id"]: c["name"] for c in customers.data}
    customer_ids = list(customer_map.keys())

    if not customer_ids:
        return []

    # 충전 거래 조회
    transactions = db.table("transactions").select("customer_id, amount").in_(
        "customer_id", customer_ids
    ).eq("type", "CHARGE").execute()

    # 고객별 집계
    customer_totals = {}
    customer_counts = Counter()
    for t in transactions.data:
        cid = t["customer_id"]
        if cid not in customer_totals:
            customer_totals[cid] = 0
        customer_totals[cid] += t["amount"]
        customer_counts[cid] += 1

    # 정렬 및 상위 N개
    sorted_customers = sorted(customer_totals.items(), key=lambda x: x[1], reverse=True)[:limit]

    return [
        TopCustomer(
            customer_id=cid,
            name=customer_map.get(cid, "Unknown"),
            total_charged=total,
            visit_count=customer_counts[cid]
        )
        for cid, total in sorted_customers
    ]


@router.get("/analytics/payment-methods")
async def get_payment_method_stats(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    shop_id: str = Depends(get_current_shop),
    db=Depends(get_db)
):
    """결제 수단별 현황"""
    customers = db.table("customers").select("id").eq("shop_id", shop_id).execute()
    customer_ids = [c["id"] for c in customers.data]

    if not customer_ids:
        return []

    # 충전 거래만 조회 (결제 수단이 있는 거래)
    query = db.table("transactions").select("payment_method, amount").in_(
        "customer_id", customer_ids
    ).eq("type", "CHARGE").not_.is_("payment_method", "null")

    if start_date:
        query = query.gte("created_at", start_date)
    if end_date:
        query = query.lte("created_at", end_date)

    transactions = query.execute()

    # 결제 수단별 집계
    method_stats = {}
    total_amount = 0
    for t in transactions.data:
        method = t["payment_method"]
        if method not in method_stats:
            method_stats[method] = {"count": 0, "amount": 0}
        method_stats[method]["count"] += 1
        method_stats[method]["amount"] += t["amount"]
        total_amount += t["amount"]

    # 비율 계산
    return [
        PaymentMethodStats(
            method=PaymentMethod(method),
            count=data["count"],
            amount=data["amount"],
            percentage=round(data["amount"] / total_amount * 100, 1) if total_amount > 0 else 0
        )
        for method, data in method_stats.items()
    ]


@router.get("/analytics/popular-menus")
async def get_popular_menus(
    limit: int = Query(10, ge=1, le=50),
    shop_id: str = Depends(get_current_shop),
    db=Depends(get_db)
):
    """인기 메뉴 분석 (비고 기반)"""
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
