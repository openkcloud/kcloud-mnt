"""프로젝트 멤버 관리(포털) — OpenStack 멤버와 별개.

project_id = OpenStack Keystone 프로젝트 UUID. 멤버 = 포털 사용자(iam_user).
role = 포털 역할(owner|member|viewer).
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from ..db import get_db

router = APIRouter(tags=["iam_project_member"])

_ROLES = ("owner", "member", "viewer")


@router.get("/users")
def list_users(db: Session = Depends(get_db)):
    """포털 사용자 목록 — 멤버 추가 picker 용."""
    rows = db.execute(
        text("SELECT id, username, name, org, status FROM iam_user ORDER BY id")
    ).mappings().all()
    return {"items": [{"id": str(r["id"]), "username": r["username"], "name": r["name"],
                       "org": r["org"], "status": r["status"]} for r in rows]}


@router.get("/orgs")
def list_orgs(db: Session = Depends(get_db)):
    """조직 목록 — 신청 관리(관리자)의 조직 필터 등."""
    rows = db.execute(text("SELECT id, code, name FROM iam_org ORDER BY name")).mappings().all()
    return {"items": [{"id": str(r["id"]), "code": r["code"], "name": r["name"]} for r in rows]}


@router.get("/my-projects")
def my_projects(username: str, db: Session = Depends(get_db)):
    """해당 사용자가 멤버인 프로젝트 ID 목록(사용자 화면 스코프용)."""
    rows = db.execute(
        text("""SELECT pm.project_id FROM iam_project_member pm
                  JOIN iam_user u ON u.id = pm.user_id
                 WHERE u.username = :un"""),
        {"un": username},
    ).scalars().all()
    return {"projectIds": list(rows)}


@router.get("/projects/{project_id}/members")
def list_members(project_id: str, db: Session = Depends(get_db)):
    """프로젝트 멤버 목록(+사용자 정보)."""
    rows = db.execute(
        text("""
            SELECT pm.user_id, pm.role, pm.created_at, u.username, u.name, u.org, u.email
              FROM iam_project_member pm
              JOIN iam_user u ON u.id = pm.user_id
             WHERE pm.project_id = :p
             ORDER BY CASE pm.role WHEN 'owner' THEN 0 WHEN 'member' THEN 1 ELSE 2 END, u.name
        """),
        {"p": project_id},
    ).mappings().all()
    items = [{
        "userId": str(r["user_id"]), "username": r["username"], "name": r["name"],
        "org": r["org"], "email": r["email"], "role": r["role"],
        "createdAt": r["created_at"].isoformat() if r["created_at"] else "",
    } for r in rows]
    return {"items": items, "count": len(items)}


class AddMemberBody(BaseModel):
    userId: int
    role: str = "member"


@router.post("/projects/{project_id}/members", status_code=201)
def add_member(project_id: str, body: AddMemberBody, db: Session = Depends(get_db)):
    if body.role not in _ROLES:
        raise HTTPException(400, f"role은 {_ROLES} 중 하나")
    if not db.execute(text("SELECT 1 FROM iam_user WHERE id = :u"), {"u": body.userId}).first():
        raise HTTPException(404, "사용자를 찾을 수 없습니다")
    dup = db.execute(
        text("SELECT 1 FROM iam_project_member WHERE project_id = :p AND user_id = :u"),
        {"p": project_id, "u": body.userId},
    ).first()
    if dup:
        raise HTTPException(409, "이미 이 프로젝트의 멤버입니다")
    db.execute(
        text("INSERT INTO iam_project_member (project_id, user_id, role) VALUES (:p, :u, :r)"),
        {"p": project_id, "u": body.userId, "r": body.role},
    )
    db.commit()
    return list_members(project_id, db)


class UpdateMemberBody(BaseModel):
    role: str


@router.patch("/projects/{project_id}/members/{user_id}")
def update_member(project_id: str, user_id: int, body: UpdateMemberBody, db: Session = Depends(get_db)):
    if body.role not in _ROLES:
        raise HTTPException(400, f"role은 {_ROLES} 중 하나")
    res = db.execute(
        text("UPDATE iam_project_member SET role = :r WHERE project_id = :p AND user_id = :u"),
        {"r": body.role, "p": project_id, "u": user_id},
    )
    db.commit()
    if res.rowcount == 0:
        raise HTTPException(404, "멤버를 찾을 수 없습니다")
    return list_members(project_id, db)


@router.delete("/projects/{project_id}/members/{user_id}", status_code=204)
def remove_member(project_id: str, user_id: int, db: Session = Depends(get_db)):
    res = db.execute(
        text("DELETE FROM iam_project_member WHERE project_id = :p AND user_id = :u"),
        {"p": project_id, "u": user_id},
    )
    db.commit()
    if res.rowcount == 0:
        raise HTTPException(404, "멤버를 찾을 수 없습니다")
    return None
