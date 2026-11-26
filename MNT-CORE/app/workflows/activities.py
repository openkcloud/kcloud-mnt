"""CORE 워커가 실행하는 DB 기록 작업 — 진행 단계·상세 단계·티켓 상태(포털 DB 는 CORE 만 쓴다).

워크플로(vm_provision)가 이름으로 부른다. 재시도돼도 결과가 같도록(멱등) 작성한다.
"""
import json

from sqlalchemy import text
from temporalio import activity

from ..db import SessionLocal


@activity.defn(name="core.init_steps")
def init_steps(ticket_id: str, attempt: int, has_accelerator: bool, has_fip: bool) -> list[dict]:
    """회차의 단계 5개와 상세 단계를 waiting 으로 등록하고 진행 순서(plan)를 돌려준다 — 이미 등록돼 있으면 plan 만.
    단계·상세 단계와 순서는 공통코드(TKT_PROVISION_STEP_IAAS / TKT_PROVISION_SUBSTEP_IAAS) 기준.
    가속기 없는 스펙은 bind_accelerator = skipped(상세 단계 없음), Floating IP 가 없으면 attach_fip 제외."""
    with SessionLocal() as db:
        steps = db.execute(text("""SELECT code FROM cmn_code
                                    WHERE group_code = 'TKT_PROVISION_STEP_IAAS' AND is_active
                                    ORDER BY sort_order""")).scalars().all()
        subs = db.execute(text("""SELECT upper_code, code FROM cmn_code
                                   WHERE group_code = 'TKT_PROVISION_SUBSTEP_IAAS' AND is_active
                                   ORDER BY sort_order""")).all()
        registered = db.execute(
            text("SELECT 1 FROM tkt_provision_step WHERE request_id = :id AND attempt = :a LIMIT 1"),
            {"id": ticket_id, "a": attempt},
        ).first() is not None
        plan = []
        for seq, step in enumerate(steps, 1):
            skipped = step == "bind_accelerator" and not has_accelerator
            codes = [] if skipped else [c for up, c in subs if up == step and (has_fip or c != "attach_fip")]
            if not registered:
                step_id = db.execute(
                    text("""INSERT INTO tkt_provision_step (request_id, attempt, seq, step_code, status)
                            VALUES (:id, :a, :seq, :code, :st) RETURNING id"""),
                    {"id": ticket_id, "a": attempt, "seq": seq, "code": step, "st": "skipped" if skipped else "waiting"},
                ).scalar()
                for i, code in enumerate(codes, 1):
                    db.execute(text("INSERT INTO tkt_provision_substep (step_id, seq, substep_code) VALUES (:s, :i, :c)"),
                               {"s": step_id, "i": i, "c": code})
            plan += [{"step": step, "sub": code} for code in codes]
        db.commit()
        return plan


@activity.defn(name="core.init_steps_ainb")
def init_steps_ainb(ticket_id: str, attempt: int) -> list[dict]:
    """AI 워크스페이스 회차의 단계·상세 단계를 waiting 으로 등록하고 진행 순서(plan)를 돌려준다 — 이미 등록돼 있으면 plan 만.
    단계·상세 단계와 순서는 공통코드(TKT_PROVISION_STEP_AINB / TKT_PROVISION_SUBSTEP_AINB) 기준."""
    with SessionLocal() as db:
        steps = db.execute(text("""SELECT code FROM cmn_code
                                    WHERE group_code = 'TKT_PROVISION_STEP_AINB' AND is_active
                                    ORDER BY sort_order""")).scalars().all()
        subs = db.execute(text("""SELECT upper_code, code FROM cmn_code
                                   WHERE group_code = 'TKT_PROVISION_SUBSTEP_AINB' AND is_active
                                   ORDER BY sort_order""")).all()
        registered = db.execute(
            text("SELECT 1 FROM tkt_provision_step WHERE request_id = :id AND attempt = :a LIMIT 1"),
            {"id": ticket_id, "a": attempt},
        ).first() is not None
        plan = []
        for seq, step in enumerate(steps, 1):
            codes = [c for up, c in subs if up == step]
            if not registered:
                step_id = db.execute(
                    text("""INSERT INTO tkt_provision_step (request_id, attempt, seq, step_code, step_group_code, status)
                            VALUES (:id, :a, :seq, :code, 'TKT_PROVISION_STEP_AINB', 'waiting') RETURNING id"""),
                    {"id": ticket_id, "a": attempt, "seq": seq, "code": step},
                ).scalar()
                for i, code in enumerate(codes, 1):
                    db.execute(text("""INSERT INTO tkt_provision_substep (step_id, seq, substep_code, substep_group_code)
                                       VALUES (:s, :i, :c, 'TKT_PROVISION_SUBSTEP_AINB')"""),
                               {"s": step_id, "i": i, "c": code})
            plan += [{"step": step, "sub": code} for code in codes]
        db.commit()
        return plan


def _sets(change: dict, prefix: str, params: dict) -> list[str]:
    """변경 하나 → SET 절. 진행 중이 되면 시작 시각, 완료·실패면 종료 시각(이미 있으면 유지 — 재시도해도 같은 결과)."""
    sets = []
    status = change.get("status")
    if status:
        params["st"] = status
        sets.append("status = :st")
        sets.append(f"started_at = coalesce({prefix}started_at, now())")
        if status in ("done", "failed"):
            sets.append(f"ended_at = coalesce({prefix}ended_at, now())")
    if "error" in change:
        params["err"] = change["error"]
        sets.append("error_message = :err")
    if "value" in change:
        params["val"] = None if change["value"] is None else str(change["value"])[:255]
        sets.append("value = :val")
    return sets


@activity.defn(name="core.update_steps")
def update_steps(ticket_id: str, attempt: int, changes: list[dict]) -> None:
    """단계·상세 단계 변경 묶음을 한 트랜잭션으로 기록. 변경 = {"step": 코드 | "sub": 코드, "status"?, "value"?, "error"?}."""
    with SessionLocal() as db:
        for c in changes:
            params = {"id": ticket_id, "a": attempt, "code": c.get("sub") or c["step"]}
            if "sub" in c:
                sets = _sets(c, "ss.", params)
                db.execute(text(f"""UPDATE tkt_provision_substep ss SET {", ".join(sets)}
                                      FROM tkt_provision_step s
                                     WHERE ss.step_id = s.id AND s.request_id = :id AND s.attempt = :a
                                       AND ss.substep_code = :code"""), params)
            else:
                sets = _sets(c, "", params)
                db.execute(text(f"""UPDATE tkt_provision_step SET {", ".join(sets)}
                                     WHERE request_id = :id AND attempt = :a AND step_code = :code"""), params)
        db.commit()


@activity.defn(name="core.finish")
def finish(ticket_id: str, status: str, result: dict | None, error: str | None) -> None:
    """티켓 마감 — completed(결과 식별자) 또는 failed(오류 메시지). 생성 중(provisioning)인 티켓만 바꾼다."""
    with SessionLocal() as db:
        db.execute(
            text("""UPDATE tkt_request SET status = :st, result = CAST(:r AS jsonb), error_message = :e
                     WHERE id = :id AND status = 'provisioning'"""),
            {"id": ticket_id, "st": status, "r": json.dumps(result) if result else None, "e": error},
        )
        db.commit()


ALL = [init_steps, init_steps_ainb, update_steps, finish]
