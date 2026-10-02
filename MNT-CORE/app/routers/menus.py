"""역할별 메뉴 조회 — DB(mnu_menu·mnu_role_menu)에서 LNB 트리를 만들어 준다.

프론트 nav.ts 의 정적 정의를 DB로 옮긴 형태. 역할별 노출·정렬·라벨은
mnu_role_menu(sort_order, label_override)가 결정한다.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from ..db import get_db

router = APIRouter(tags=["mnu_menu"])


@router.get("/menus")
def get_menus(role: str, db: Session = Depends(get_db)):
    """role(admin|user)에 노출되는 메뉴 트리."""
    rows = db.execute(
        text(
            """
            SELECT m.id, m.parent_id, m.menu_type, m.code,
                   COALESCE(rm.label_override, m.label) AS label,
                   m.path, m.icon,
                   COALESCE(rm.sort_order, m.sort_order) AS sort_order
              FROM mnu_role_menu rm
              JOIN mnu_menu m ON m.id = rm.menu_id AND m.is_active
              JOIN iam_role r ON r.id = rm.role_id
             WHERE r.code = :role
             ORDER BY sort_order, m.id
            """
        ),
        {"role": role},
    ).mappings().all()

    if not rows:
        raise HTTPException(404, f"role '{role}' 메뉴 없음")

    by_id = {r["id"]: dict(r, children=[]) for r in rows}
    roots: list[dict] = []
    for item in by_id.values():
        parent = by_id.get(item["parent_id"])
        (parent["children"] if parent else roots).append(item)

    def strip(node: dict) -> dict:
        out = {k: node[k] for k in ("code", "label", "path", "icon", "menu_type")}
        if node["children"]:
            out["children"] = [strip(c) for c in node["children"]]
        return out

    return {"role": role, "sections": [strip(n) for n in roots]}
