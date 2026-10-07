"""포털 계정 로그인 — iam_user 비밀번호(bcrypt, pgcrypto crypt) 확인.

토큰 발급·요청별 검증은 하지 않는다(Keycloak 도입 시 대체). 확인된 사용자 정보만 돌려준다.
역할은 iam_user_role 기준 — admin 역할이 있으면 admin, 아니면 user.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from ..db import get_db

router = APIRouter(tags=["auth"])


class LoginBody(BaseModel):
    username: str
    password: str


@router.post("/auth/login")
def login(body: LoginBody, db: Session = Depends(get_db)):
    row = db.execute(
        text("""
            SELECT u.id, u.username, u.name, u.email, u.org, u.status,
                   u.password_hash = crypt(:pw, u.password_hash) AS password_ok,
                   array_remove(array_agg(r.code), NULL) AS roles
              FROM iam_user u
              LEFT JOIN iam_user_role ur ON ur.user_id = u.id
              LEFT JOIN iam_role r ON r.id = ur.role_id
             WHERE u.username = :un
             GROUP BY u.id
        """),
        {"un": body.username.strip(), "pw": body.password},
    ).mappings().first()
    if not row or not row["password_ok"]:
        raise HTTPException(401, "아이디 또는 비밀번호가 올바르지 않습니다.")
    if row["status"] != "active":
        raise HTTPException(403, "사용할 수 없는 계정입니다. 관리자에게 문의하세요.")
    if not row["roles"]:
        raise HTTPException(403, "권한(역할)이 지정되지 않은 계정입니다. 관리자에게 문의하세요.")

    db.execute(text("UPDATE iam_user SET last_login_at = now() WHERE id = :id"), {"id": row["id"]})
    db.commit()
    return {
        "id": str(row["id"]),
        "username": row["username"],
        "name": row["name"],
        "email": row["email"],
        "org": row["org"],
        "role": "admin" if "admin" in row["roles"] else "user",
    }
