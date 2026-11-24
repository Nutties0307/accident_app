import json, os, re, threading, datetime, time, uuid
from pathlib import Path
import numpy as np
import pandas as pd
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session
from auth import get_db, require_admin
from database import (User, RiskPoint, DataVersion, AccidentEvent, AppSetting,
                      SessionLocal, DATABASE_URL)
from risk_recompute import recompute_risk_points
import ingest
import map_matching

router = APIRouter(prefix="/api/admin", tags=["admin"])
DB_PATH = DATABASE_URL.replace("sqlite:///", "")
on_risk_points_changed = None  # main.py ตั้งเป็น load_risk_points_cache
_lock = threading.Lock()

UPLOAD_DIR = Path("./uploads_tmp")
MAX_UPLOAD_BYTES = 60 * 1024 * 1024  # 60 MB
_ID_RE = re.compile(r"^[0-9a-f]{32}$")


def _active_years(db) -> list:
    s = db.get(AppSetting, "active_years")
    return [int(x) for x in s.value.split(",")] if s and s.value else []


@router.get("/overview")
def overview(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    yrs = dict(db.query(AccidentEvent.year, func.count()).group_by(AccidentEvent.year).all())
    levels = dict(db.query(RiskPoint.risk_level, func.count()).group_by(RiskPoint.risk_level).all())
    last = db.query(DataVersion).filter(DataVersion.status == "done", DataVersion.is_rolled_back == False) \
        .order_by(DataVersion.id.desc()).first()
    return {"events_by_year": yrs, "total_events": sum(yrs.values()),
            "risk_points": sum(levels.values()), "levels": levels,
            "active_years": _active_years(db),
            "last_update": last.finished_at.isoformat() if last and last.finished_at else None}


class SettingsIn(BaseModel):
    active_years: list[int]


@router.put("/settings")
def set_settings(body: SettingsIn, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    if not body.active_years:
        raise HTTPException(400, "ต้องเลือกอย่างน้อย 1 ปี")
    yrs = ",".join(str(y) for y in sorted(set(body.active_years)))
    row = db.get(AppSetting, "active_years")
    if row:
        row.value = yrs
    else:
        db.add(AppSetting(key="active_years", value=yrs))
    v = DataVersion(kind="recompute", created_by=admin.id, status="queued", active_years=yrs,
                    message="เปลี่ยนช่วงปีที่ใช้คำนวณ")
    db.add(v); db.commit()
    vid = v.id
    threading.Thread(target=_run_recompute, args=(vid,), daemon=True).start()
    return {"version_id": vid}


def _run_recompute(version_id: int):
    db = SessionLocal()
    try:
        v = db.get(DataVersion, version_id)
        if not _lock.acquire(blocking=False):
            v.status, v.message = "failed", "มีงานประมวลผลอื่นกำลังทำอยู่"
            db.commit(); return
        try:
            v.status = "running"; db.commit()

            def prog(p, m=""):
                v.progress, v.message = p, m or v.message
                db.commit()

            res = recompute_risk_points(DB_PATH, [int(x) for x in v.active_years.split(",")], prog)
            if on_risk_points_changed:
                on_risk_points_changed()
            v.status, v.progress = "done", 100
            v.summary_json = json.dumps(res, ensure_ascii=False)
            v.finished_at = datetime.datetime.utcnow()
            db.commit()
        finally:
            _lock.release()
    except Exception as e:
        db.rollback()
        v = db.get(DataVersion, version_id)
        v.status, v.message = "failed", f"ล้มเหลว: {e}"
        db.commit()
    finally:
        db.close()


@router.get("/versions")
def versions(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    rows = db.query(DataVersion).order_by(DataVersion.id.desc()).limit(100).all()
    return [{"id": r.id, "kind": r.kind, "filename": r.filename, "status": r.status,
             "progress": r.progress, "message": r.message, "rows_added": r.rows_added,
             "active_years": r.active_years, "is_rolled_back": r.is_rolled_back,
             "created_at": r.created_at.isoformat() if r.created_at else None} for r in rows]


@router.get("/versions/{vid}")
def version(vid: int, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    r = db.get(DataVersion, vid)
    if not r:
        raise HTTPException(404, "ไม่พบรายการ")
    return {"id": r.id, "status": r.status, "progress": r.progress, "message": r.message,
            "summary": json.loads(r.summary_json) if r.summary_json else None}


@router.get("/admins")
def list_admins(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    return [{"id": u.id, "name": u.name, "email": u.email}
            for u in db.query(User).filter(User.is_admin == True).all()]


class AdminIn(BaseModel):
    email: str


@router.post("/admins")
def add_admin(body: AdminIn, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    u = db.query(User).filter(User.email == body.email).first()
    if not u:
        raise HTTPException(404, "ไม่พบผู้ใช้อีเมลนี้ (ต้องสมัครสมาชิกก่อน)")
    u.is_admin = True; db.commit()
    return {"ok": True}


@router.delete("/admins/{uid}")
def remove_admin(uid: int, db: Session = Depends(get_db), me: User = Depends(require_admin)):
    if uid == me.id:
        raise HTTPException(400, "ไม่สามารถถอนสิทธิ์ตัวเองได้")
    if db.query(User).filter(User.is_admin == True).count() <= 1:
        raise HTTPException(400, "ต้องมีแอดมินอย่างน้อย 1 คน")
    u = db.get(User, uid)
    if not u:
        raise HTTPException(404, "ไม่พบผู้ใช้")
    u.is_admin = False; db.commit()
    return {"ok": True}


# =========================================================
# อัปโหลดข้อมูลใหม่ (.xlsx / .csv) -> ตรวจสอบ/พรีวิว -> ยืนยัน -> ประมวลผลเบื้องหลัง
# =========================================================

def _cleanup_old_uploads(max_age_hours: int = 24):
    if not UPLOAD_DIR.exists():
        return
    limit = time.time() - max_age_hours * 3600
    for f in UPLOAD_DIR.iterdir():
        try:
            if f.stat().st_mtime < limit:
                f.unlink()
        except OSError:
            pass


@router.post("/uploads")
def upload_file(file: UploadFile = File(...), db: Session = Depends(get_db),
                admin: User = Depends(require_admin)):
    name = (file.filename or "").strip()
    if not name.lower().endswith((".xlsx", ".csv")):
        raise HTTPException(400, "รองรับเฉพาะไฟล์ .xlsx และ .csv")

    data = file.file.read(MAX_UPLOAD_BYTES + 1)
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, "ไฟล์ใหญ่เกิน 60 MB")

    UPLOAD_DIR.mkdir(exist_ok=True)
    _cleanup_old_uploads()
    upload_id = uuid.uuid4().hex
    ext = ".xlsx" if name.lower().endswith(".xlsx") else ".csv"
    raw_path = UPLOAD_DIR / f"{upload_id}{ext}"
    raw_path.write_bytes(data)

    try:
        try:
            df = ingest.read_table(str(raw_path), name)
        except ValueError as e:
            raise HTTPException(400, str(e))
        except Exception:
            raise HTTPException(400, "เปิดไฟล์ไม่ได้ ไฟล์อาจเสียหรือไม่ใช่รูปแบบ Excel/CSV ที่ถูกต้อง")

        clean, report = ingest.validate(df)
        if report["errors"]:
            raise HTTPException(400, " / ".join(report["errors"]))

        clean.to_csv(UPLOAD_DIR / f"{upload_id}.clean.csv", index=False, encoding="utf-8")
        (UPLOAD_DIR / f"{upload_id}.json").write_text(
            json.dumps({"filename": name, "report": report}, ensure_ascii=False), encoding="utf-8")
    finally:
        raw_path.unlink(missing_ok=True)

    existing = ingest.existing_years(DB_PATH)
    upload_years = [int(y) for y in report["year_counts"]]
    overlap = sorted(y for y in upload_years if y in existing)
    all_years = sorted(set(existing) | set(upload_years))

    return {
        "upload_id": upload_id,
        "filename": name,
        **report,
        "existing_years": {str(k): v for k, v in existing.items()},
        "overlap_years": overlap,
        "duplicate_rows": ingest.count_duplicates(DB_PATH, clean) if overlap else 0,
        "default_active_years": all_years[-2:],
    }


class ConfirmUploadIn(BaseModel):
    upload_id: str
    replace_existing: bool = False
    append_existing: bool = False  # เพิ่มต่อจากข้อมูลเดิม ไม่ลบอะไร


@router.post("/uploads/confirm")
def confirm_upload(body: ConfirmUploadIn, db: Session = Depends(get_db),
                   admin: User = Depends(require_admin)):
    if not _ID_RE.match(body.upload_id):
        raise HTTPException(400, "รหัสไฟล์ไม่ถูกต้อง")
    clean_path = UPLOAD_DIR / f"{body.upload_id}.clean.csv"
    meta_path = UPLOAD_DIR / f"{body.upload_id}.json"
    if not clean_path.exists() or not meta_path.exists():
        raise HTTPException(404, "ไม่พบไฟล์ที่อัปโหลด (อาจหมดอายุ) กรุณาอัปโหลดใหม่")
    meta = json.loads(meta_path.read_text(encoding="utf-8"))
    upload_years = [int(y) for y in meta["report"]["year_counts"]]
    existing = ingest.existing_years(DB_PATH)
    overlap = sorted(y for y in upload_years if y in existing)
    # ใช้ช่วงปีที่ตั้งไว้ในระบบอยู่แล้ว (เปลี่ยนช่วงปีทำที่ส่วนอื่น ไม่เกี่ยวกับการนำเข้า)
    current_active = _active_years(db)
    if not current_active:
        raise HTTPException(400, "ยังไม่ได้ตั้งช่วงปีที่ใช้คำนวณ กรุณาตั้งค่าที่ส่วน 'ช่วงปีที่ใช้คำนวณความเสี่ยง' ก่อน")
    if overlap and not body.replace_existing and not body.append_existing:
        raise HTTPException(
            409, "มีข้อมูลปี " + ", ".join(str(y + 543) for y in overlap)
            + " ในระบบอยู่แล้ว กรุณายืนยันการแทนที่ หรือยกเลิก")

    yrs = ",".join(str(y) for y in current_active)
    v = DataVersion(kind="upload", filename=meta["filename"], created_by=admin.id,
                    status="queued", active_years=yrs, rows_in_file=meta["report"]["total_rows"],
                    year_min=min(upload_years), year_max=max(upload_years),
                    message="รอเริ่มประมวลผล")
    db.add(v); db.commit()
    vid = v.id
    threading.Thread(
        target=_run_upload,
        args=(vid, body.upload_id, overlap if body.replace_existing else []),
        daemon=True).start()
    return {"version_id": vid}


def _run_upload(version_id: int, upload_id: str, replace_years: list):
    db = SessionLocal()
    try:
        v = db.get(DataVersion, version_id)
        if not _lock.acquire(blocking=False):
            v.status, v.message = "failed", "มีงานประมวลผลอื่นกำลังทำอยู่ กรุณารอให้เสร็จก่อน"
            db.commit(); return
        try:
            v.status = "running"; db.commit()

            def prog(p, m=""):
                v.progress, v.message = int(p), (m or v.message)
                db.commit()

            active = [int(x) for x in v.active_years.split(",")]
            df = pd.read_csv(UPLOAD_DIR / f"{upload_id}.clean.csv", encoding="utf-8")
            df[["province", "cause"]] = df[["province", "cause"]].fillna("")
            rows_in = len(df)

            # Upsert: ข้ามแถวที่ซ้ำกับข้อมูลเดิม (เพิ่มซ้ำต้องไม่เกิดเป็น 2 แถว)
            df, skipped = ingest.drop_existing(DB_PATH, df, replace_years)
            if len(df) == 0:
                res = {"rows_in_file": rows_in, "rows_added": 0, "rows_dropped_by_matching": 0,
                       "rows_skipped_duplicate": skipped, "replaced_years": []}
                v.rows_added, v.status, v.progress = 0, "done", 100
                v.message = f"ไม่มีแถวใหม่ (ซ้ำกับข้อมูลเดิมทั้งหมด {skipped:,} แถว) ไม่มีอะไรถูกเพิ่ม"
                v.summary_json = json.dumps(res, ensure_ascii=False)
                v.finished_at = datetime.datetime.utcnow()
                db.commit()
                for f in UPLOAD_DIR.glob(f"{upload_id}*"):
                    f.unlink(missing_ok=True)
                return

            prog(3, f"กำลังจับคู่พิกัด {rows_in:,} แถวกับถนน")
            matched = map_matching.match_points(df, lambda p, m="": prog(3 + p * 0.6, m))
            dropped = len(df) - len(matched)

            prog(65, f"กำลังบันทึก {len(matched):,} แถวเข้าระบบ")
            added = ingest.ingest_events(DB_PATH, matched, version_id, replace_years)

            res = recompute_risk_points(DB_PATH, active, lambda p, m="": prog(70 + p * 0.3, m))
            if on_risk_points_changed:
                on_risk_points_changed()

            res["rows_in_file"], res["rows_added"], res["rows_dropped_by_matching"] = rows_in, added, dropped
            res["rows_skipped_duplicate"] = skipped
            res["replaced_years"] = [int(y) for y in replace_years]  # ใช้ตัดสินว่าย้อนกลับได้ไหม
            v.rows_added, v.status, v.progress = added, "done", 100
            v.message = (f"เพิ่ม {added:,} แถว (ข้ามเพราะซ้ำกับข้อมูลเดิม {skipped:,}, "
                         f"ตัดทิ้งเพราะอยู่ไกลถนน {dropped:,})")
            v.summary_json = json.dumps(res, ensure_ascii=False)
            v.finished_at = datetime.datetime.utcnow()
            db.commit()

            for f in UPLOAD_DIR.glob(f"{upload_id}*"):
                f.unlink(missing_ok=True)
        finally:
            _lock.release()
    except map_matching.MapMatchingNotReady as e:
        db.rollback()
        v = db.get(DataVersion, version_id)
        v.status, v.message = "failed", str(e)
        db.commit()
    except Exception as e:
        db.rollback()
        v = db.get(DataVersion, version_id)
        v.status, v.message = "failed", f"ล้มเหลว: {e}"
        db.commit()
    finally:
        db.close()


# =========================================================
# นำข้อมูลของไฟล์ที่อัปโหลดออก (ย้อนกลับ)
# =========================================================

# ---------------------------------------------------------------
# เพิ่มอุบัติเหตุทีละจุด (จิ้มบนแผนที่ในหน้าแอดมิน)
# ---------------------------------------------------------------

def _nearest_risk_point(db, lat: float, lon: float, radius_m: float = 150):
    dlat, dlon = radius_m / 111000, radius_m / 108000
    rows = db.query(RiskPoint).filter(
        RiskPoint.latitude.between(lat - dlat, lat + dlat),
        RiskPoint.longitude.between(lon - dlon, lon + dlon)).all()
    best, bd = None, 1e18
    for r in rows:
        d = (((r.latitude - lat) * 111000) ** 2 + ((r.longitude - lon) * 108000) ** 2) ** 0.5
        if d <= radius_m and d < bd:
            best, bd = r, d
    return best


def _high_threshold(db) -> float:
    vals = [v for (v,) in db.query(RiskPoint.total_count).filter(RiskPoint.is_still_active == True).all()]
    return float(np.percentile(vals, 75)) if vals else 0.0


@router.get("/point-info")
def point_info(lat: float, lon: float, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    p75 = _high_threshold(db)
    need_total = int(np.floor(p75)) + 1  # ต้องมากกว่า P75 ถึงเป็นระดับสูง
    r = _nearest_risk_point(db, lat, lon)
    if r is None:
        return {"nearby": False, "need_for_high": need_total}
    cur = int(r.total_count) if r.is_still_active else 0
    return {"nearby": True, "level": r.risk_level, "count": int(r.total_count),
            "province": r.province, "top_cause": r.top_cause,
            "need_for_high": max(need_total - cur, 0)}


@router.get("/causes")
def causes(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    rows = (db.query(AccidentEvent.cause, func.count().label("n"))
            .filter(AccidentEvent.cause.isnot(None), AccidentEvent.cause != "")
            .group_by(AccidentEvent.cause).order_by(func.count().desc()).limit(10).all())
    return [c for c, _n in rows]


class ManualIn(BaseModel):
    latitude: float
    longitude: float
    year: int
    cause: str
    count: int = 1


@router.post("/events/manual")
def add_manual_event(body: ManualIn, db: Session = Depends(get_db),
                     admin: User = Depends(require_admin)):
    if not (ingest.LAT_RANGE[0] <= body.latitude <= ingest.LAT_RANGE[1]
            and ingest.LON_RANGE[0] <= body.longitude <= ingest.LON_RANGE[1]):
        raise HTTPException(400, "พิกัดอยู่นอกประเทศไทย")
    if not (1 <= body.count <= 100):
        raise HTTPException(400, "จำนวนครั้งต้องอยู่ระหว่าง 1 ถึง 100")
    if not body.cause.strip():
        raise HTTPException(400, "กรุณาเลือกสาเหตุ")

    near = _nearest_risk_point(db, body.latitude, body.longitude, 300)
    province = near.province if near else ""
    if not province:
        any_pt = db.query(RiskPoint).filter(
            RiskPoint.latitude.between(body.latitude - 0.5, body.latitude + 0.5),
            RiskPoint.longitude.between(body.longitude - 0.5, body.longitude + 0.5)).first()
        province = any_pt.province if any_pt else ""

    # ถ้าซ้ำกับของเดิมเป๊ะ ระบบ Upsert จะข้ามให้เอง จึงใช้พิกัดที่กดตามจริง
    df = pd.DataFrame({
        "latitude": [body.latitude] * body.count, "longitude": [body.longitude] * body.count,
        "year": [body.year] * body.count, "province": [province] * body.count,
        "cause": [body.cause.strip()] * body.count})

    UPLOAD_DIR.mkdir(exist_ok=True)
    upload_id = uuid.uuid4().hex
    df.to_csv(UPLOAD_DIR / f"{upload_id}.clean.csv", index=False, encoding="utf-8")
    report = {"total_rows": len(df), "valid_rows": len(df), "invalid_rows": 0,
              "year_counts": {str(body.year): len(df)}}
    (UPLOAD_DIR / f"{upload_id}.json").write_text(
        json.dumps({"filename": f"เพิ่มด้วยมือ {body.count} ครั้ง", "report": report}, ensure_ascii=False),
        encoding="utf-8")
    return confirm_upload(ConfirmUploadIn(upload_id=upload_id, append_existing=True), db, admin)


@router.post("/versions/{vid}/rollback")
def rollback_version(vid: int, db: Session = Depends(get_db),
                     admin: User = Depends(require_admin)):
    t = db.get(DataVersion, vid)
    if not t:
        raise HTTPException(404, "ไม่พบรายการ")
    if t.kind != "upload":
        raise HTTPException(400, "นำออกได้เฉพาะรายการ 'อัปโหลดไฟล์' เท่านั้น")
    if t.status != "done":
        raise HTTPException(400, "รายการนี้ยังไม่สำเร็จ ไม่มีข้อมูลให้นำออก")
    if t.is_rolled_back:
        raise HTTPException(400, "รายการนี้ถูกนำออกไปแล้ว")

    summary = json.loads(t.summary_json) if t.summary_json else {}
    if summary.get("replaced_years"):
        raise HTTPException(
            400, "ไฟล์นี้เคยแทนที่ข้อมูลเดิมของปี "
            + ", ".join(str(y + 543) for y in summary["replaced_years"])
            + " จึงนำออกไม่ได้ เพราะข้อมูลเดิมที่ถูกแทนที่กู้คืนไม่ได้")

    v = DataVersion(kind="rollback", filename=t.filename, created_by=admin.id,
                    status="queued", active_years=",".join(str(y) for y in _active_years(db)),
                    message=f"กำลังนำข้อมูลจากไฟล์ {t.filename} ออก")
    db.add(v); db.commit()
    vid_new = v.id
    threading.Thread(target=_run_rollback, args=(vid_new, vid), daemon=True).start()
    return {"version_id": vid_new}


def _run_rollback(version_id: int, target_id: int):
    import sqlite3
    db = SessionLocal()
    try:
        v = db.get(DataVersion, version_id)
        if not _lock.acquire(blocking=False):
            v.status, v.message = "failed", "มีงานประมวลผลอื่นกำลังทำอยู่ กรุณารอให้เสร็จก่อน"
            db.commit(); return
        try:
            v.status = "running"; db.commit()

            def prog(p, m=""):
                v.progress, v.message = int(p), (m or v.message)
                db.commit()

            con = sqlite3.connect(DB_PATH)
            try:
                remaining = [int(y) for (y,) in con.execute(
                    "SELECT DISTINCT year FROM accident_events "
                    "WHERE version_id IS NULL OR version_id != ? ORDER BY year", (target_id,))]
                if not remaining:
                    raise ValueError("ถ้านำไฟล์นี้ออก ระบบจะไม่เหลือข้อมูลเลย")
                n = con.execute("SELECT COUNT(*) FROM accident_events WHERE version_id = ?",
                                (target_id,)).fetchone()[0]
                prog(10, f"กำลังนำข้อมูล {n:,} แถวออก")
                con.execute("BEGIN")
                con.execute("DELETE FROM accident_events WHERE version_id = ?", (target_id,))
                con.commit()
            finally:
                con.close()

            # ปีที่ใช้คำนวณต้องมีข้อมูลอยู่จริง ถ้าไม่เหลือเลย ใช้ 2 ปีล่าสุดที่มี
            active = [y for y in _active_years(db) if y in remaining]
            note = ""
            if not active:
                active = remaining[-2:]
                note = f" (ปรับช่วงปีที่ใช้คำนวณเป็น {', '.join(str(y + 543) for y in active)})"
            yrs = ",".join(str(y) for y in active)
            row = db.get(AppSetting, "active_years")
            if row:
                row.value = yrs
            else:
                db.add(AppSetting(key="active_years", value=yrs))
            v.active_years = yrs
            db.commit()

            res = recompute_risk_points(DB_PATH, active, lambda p, m="": prog(30 + p * 0.7, m))
            if on_risk_points_changed:
                on_risk_points_changed()

            target = db.get(DataVersion, target_id)
            target.is_rolled_back = True
            v.status, v.progress = "done", 100
            v.message = f"นำข้อมูล {n:,} แถวออกแล้ว{note}"
            v.summary_json = json.dumps(res, ensure_ascii=False)
            v.finished_at = datetime.datetime.utcnow()
            db.commit()
        finally:
            _lock.release()
    except Exception as e:
        db.rollback()
        v = db.get(DataVersion, version_id)
        v.status, v.message = "failed", f"ล้มเหลว: {e}"
        db.commit()
    finally:
        db.close()