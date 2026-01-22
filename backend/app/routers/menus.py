"""
메뉴 관리 API 라우터
"""
import logging
from fastapi import APIRouter, Depends, HTTPException, status

from ..database import get_supabase_admin_client
from ..utils import now_seoul_iso
from ..routers.auth import get_current_shop
from ..schemas.menu import (
    MenuCreate,
    MenuUpdate,
    MenuResponse,
    MenuListResponse,
    MenuReorderRequest,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/menus", tags=["메뉴 관리"])


@router.get("", response_model=MenuListResponse)
async def get_menus(
    shop_id: str = Depends(get_current_shop),
    include_inactive: bool = False
):
    """메뉴 목록 조회"""
    admin_db = get_supabase_admin_client()

    query = admin_db.table("menus").select("*").eq("shop_id", shop_id)

    if not include_inactive:
        query = query.eq("is_active", True)

    result = query.order("display_order", desc=False).order("created_at", desc=False).execute()

    menus = result.data or []

    return MenuListResponse(
        menus=[
            MenuResponse(
                id=m["id"],
                name=m["name"],
                price=m["price"],
                is_active=m["is_active"],
                display_order=m["display_order"],
                created_at=m["created_at"]
            )
            for m in menus
        ],
        total=len(menus)
    )


@router.post("", response_model=MenuResponse, status_code=status.HTTP_201_CREATED)
async def create_menu(
    menu: MenuCreate,
    shop_id: str = Depends(get_current_shop)
):
    """메뉴 생성"""
    admin_db = get_supabase_admin_client()

    # 현재 최대 display_order 조회
    max_order_result = admin_db.table("menus").select("display_order").eq("shop_id", shop_id).order("display_order", desc=True).limit(1).execute()

    next_order = 0
    if max_order_result.data:
        next_order = (max_order_result.data[0]["display_order"] or 0) + 1

    # 메뉴 생성
    result = admin_db.table("menus").insert({
        "shop_id": shop_id,
        "name": menu.name,
        "price": menu.price,
        "is_active": True,
        "display_order": next_order
    }).execute()

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="메뉴 생성에 실패했습니다"
        )

    m = result.data[0]
    logger.info(f"[MENU] 메뉴 생성 - shop_id: {shop_id[:8]}..., name: {menu.name}")

    return MenuResponse(
        id=m["id"],
        name=m["name"],
        price=m["price"],
        is_active=m["is_active"],
        display_order=m["display_order"],
        created_at=m["created_at"]
    )


@router.get("/{menu_id}", response_model=MenuResponse)
async def get_menu(
    menu_id: str,
    shop_id: str = Depends(get_current_shop)
):
    """메뉴 상세 조회"""
    admin_db = get_supabase_admin_client()

    result = admin_db.table("menus").select("*").eq("id", menu_id).eq("shop_id", shop_id).maybe_single().execute()

    if not result or not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="메뉴를 찾을 수 없습니다"
        )

    m = result.data
    return MenuResponse(
        id=m["id"],
        name=m["name"],
        price=m["price"],
        is_active=m["is_active"],
        display_order=m["display_order"],
        created_at=m["created_at"]
    )


@router.put("/{menu_id}", response_model=MenuResponse)
async def update_menu(
    menu_id: str,
    menu: MenuUpdate,
    shop_id: str = Depends(get_current_shop)
):
    """메뉴 수정"""
    admin_db = get_supabase_admin_client()

    # 메뉴 존재 확인
    existing = admin_db.table("menus").select("id").eq("id", menu_id).eq("shop_id", shop_id).maybe_single().execute()

    if not existing or not existing.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="메뉴를 찾을 수 없습니다"
        )

    # 업데이트할 필드만 추출
    update_data = {}
    if menu.name is not None:
        update_data["name"] = menu.name
    if menu.price is not None:
        update_data["price"] = menu.price
    if menu.is_active is not None:
        update_data["is_active"] = menu.is_active
    if menu.display_order is not None:
        update_data["display_order"] = menu.display_order

    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="수정할 내용이 없습니다"
        )

    update_data["updated_at"] = now_seoul_iso()

    result = admin_db.table("menus").update(update_data).eq("id", menu_id).eq("shop_id", shop_id).execute()

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="메뉴 수정에 실패했습니다"
        )

    m = result.data[0]
    logger.info(f"[MENU] 메뉴 수정 - shop_id: {shop_id[:8]}..., menu_id: {menu_id[:8]}...")

    return MenuResponse(
        id=m["id"],
        name=m["name"],
        price=m["price"],
        is_active=m["is_active"],
        display_order=m["display_order"],
        created_at=m["created_at"]
    )


@router.delete("/{menu_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_menu(
    menu_id: str,
    shop_id: str = Depends(get_current_shop)
):
    """메뉴 삭제"""
    admin_db = get_supabase_admin_client()

    # 메뉴 존재 확인
    existing = admin_db.table("menus").select("id").eq("id", menu_id).eq("shop_id", shop_id).maybe_single().execute()

    if not existing or not existing.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="메뉴를 찾을 수 없습니다"
        )

    admin_db.table("menus").delete().eq("id", menu_id).eq("shop_id", shop_id).execute()

    logger.info(f"[MENU] 메뉴 삭제 - shop_id: {shop_id[:8]}..., menu_id: {menu_id[:8]}...")


@router.put("/reorder", status_code=status.HTTP_200_OK)
async def reorder_menus(
    request: MenuReorderRequest,
    shop_id: str = Depends(get_current_shop)
):
    """메뉴 순서 변경"""
    admin_db = get_supabase_admin_client()

    # 각 메뉴의 display_order 업데이트
    for index, menu_id in enumerate(request.menu_ids):
        admin_db.table("menus").update({
            "display_order": index,
            "updated_at": now_seoul_iso()
        }).eq("id", menu_id).eq("shop_id", shop_id).execute()

    logger.info(f"[MENU] 메뉴 순서 변경 - shop_id: {shop_id[:8]}..., count: {len(request.menu_ids)}")

    return {"message": "메뉴 순서가 변경되었습니다"}
