import re
import sqlite3
import numpy as np
import pandas as pd


REQUIRED = {
    "LATITUDE": "latitude",
    "LONGITUDE": "longitude",
    "ปีที่เกิดเหตุ": "year",
    "จังหวัด": "province",
    "สาเหตุ_มาตรฐาน": "cause",
}
LAT_RANGE = (5.0, 21.0)
LON_RANGE = (97.0, 106.0)
YEAR_RANGE = (2000, 2100)


def parse_hour(v):
    """แปลงค่าช่อง 'เวลา' เป็นชั่วโมง 0-23 (รองรับ '21:30', '21:30:00', '2130', 21.5 ชม., เศษส่วนของวันจาก Excel เช่น 0.375 หรือ '0.375', time/datetime) คืน None ถ้าอ่านไม่ได้"""
    if v is None:
        return None
    try:
        if pd.isna(v):
            return None
    except (TypeError, ValueError):
        pass
    if hasattr(v, "hour"):
        return int(v.hour)

    def from_fraction(x):
        return (int(round(x * 1440)) // 60) % 24

    if isinstance(v, (int, float, np.integer, np.floating)):
        x = float(v)
        if 0 <= x < 1:
            return from_fraction(x)
        if 0 <= x < 24:
            return int(x)
        if 100 <= x <= 2359:
            h = int(x) // 100
            return h if h < 24 else None
        return None
    t = str(v).strip()
    if re.match(r"^\d*\.?\d+$", t) and ":" not in t:
        return parse_hour(float(t))
    m = re.match(r"^(\d{1,2})\s*[:.]\s*(\d{2})", t)
    if m:
        h = int(m.group(1))
        return h if 0 <= h < 24 else None
    m = re.match(r"^(\d{3,4})$", t)
    if m:
        h = int(m.group(1)) // 100
        return h if 0 <= h < 24 else None
    return None


def clean_weather(v):
    if v is None:
        return None
    try:
        if pd.isna(v):
            return None
    except (TypeError, ValueError):
        pass
    t = str(v).strip()
    return t if t and t.lower() != "nan" else None


def read_table(path: str, filename: str) -> pd.DataFrame:
    name = filename.lower()
    if name.endswith(".xlsx"):
        return pd.read_excel(path, engine="openpyxl")
    if name.endswith(".csv"):
        for enc in ("utf-8-sig", "cp874"):
            try:
                return pd.read_csv(path, encoding=enc, low_memory=False)
            except UnicodeDecodeError:
                continue
        raise ValueError("อ่านตัวอักษรในไฟล์ CSV ไม่ได้ (ลองบันทึกเป็น UTF-8 หรือใช้ไฟล์ .xlsx)")
    raise ValueError("รองรับเฉพาะไฟล์ .xlsx และ .csv")


def validate(df: pd.DataFrame):
    """คืน (ข้อมูลที่ผ่านตรวจ, รายงาน). ถ้ารายงานมี errors แปลว่าใช้ไฟล์นี้ไม่ได้"""
    df = df.copy()
    df.columns = [str(c).strip() for c in df.columns]
    report = {"total_rows": int(len(df)), "errors": [], "invalid_reasons": {}}

    missing = [c for c in REQUIRED if c not in df.columns]
    if missing:
        report["errors"].append(
            "ไฟล์ไม่มีคอลัมน์: " + ", ".join(missing)
            + " (ต้องใช้ชื่อคอลัมน์เหมือนไฟล์ข้อมูลเดิม)")
        return None, report
    if len(df) == 0:
        report["errors"].append("ไฟล์ไม่มีข้อมูล")
        return None, report

    d = df[list(REQUIRED)].rename(columns=REQUIRED)
    d["latitude"] = pd.to_numeric(d["latitude"], errors="coerce")
    d["longitude"] = pd.to_numeric(d["longitude"], errors="coerce")
    y = pd.to_numeric(d["year"], errors="coerce")
    d["year"] = y.where(~(y > 2400), y - 543)
    d["province"] = d["province"].fillna("").astype(str).str.strip()
    d["cause"] = d["cause"].fillna("").astype(str).str.strip()
    d["accident_hour"] = df["เวลา"].map(parse_hour) if "เวลา" in df.columns else None
    d["weather"] = df["สภาพอากาศ"].map(clean_weather) if "สภาพอากาศ" in df.columns else None

    bad_coord = d["latitude"].isna() | d["longitude"].isna()
    out_range = ~bad_coord & ~(
        d["latitude"].between(*LAT_RANGE) & d["longitude"].between(*LON_RANGE))
    bad_year = d["year"].isna() | ~d["year"].between(*YEAR_RANGE)

    reasons = {
        "พิกัดว่างหรือไม่ใช่ตัวเลข": int(bad_coord.sum()),
        "พิกัดอยู่นอกประเทศไทย": int(out_range.sum()),
        "ปีว่างหรือไม่ถูกต้อง": int((bad_year & ~bad_coord & ~out_range).sum()),
    }
    report["invalid_reasons"] = {k: v for k, v in reasons.items() if v}

    ok = ~(bad_coord | out_range | bad_year)
    clean = d[ok].copy()
    clean["year"] = clean["year"].astype(int)
    report["valid_rows"] = int(len(clean))
    report["invalid_rows"] = int(len(d) - len(clean))
    if len(clean) == 0:
        report["errors"].append("ไม่มีแถวที่ใช้ได้เลย (พิกัดหรือปีไม่ถูกต้องทั้งหมด)")
        return None, report

    report["year_counts"] = {int(k): int(v) for k, v in clean["year"].value_counts().sort_index().items()}
    report["sample"] = [
        {"year": int(r.year), "province": r.province, "cause": r.cause,
         "latitude": round(float(r.latitude), 6), "longitude": round(float(r.longitude), 6)}
        for r in clean.head(6).itertuples()
    ]
    return clean.reset_index(drop=True), report


def existing_years(db_path: str) -> dict:
    con = sqlite3.connect(db_path)
    try:
        return {int(y): int(n) for y, n in
                con.execute("SELECT year, COUNT(*) FROM accident_events GROUP BY year")}
    finally:
        con.close()


def count_duplicates(db_path: str, df: pd.DataFrame) -> int:
    """นับแถวในไฟล์ที่ซ้ำกับข้อมูลเดิมในระบบ (พิกัด + ปี + สาเหตุเหมือนกัน)
    นับแบบจำนวนครั้ง: ถ้าไฟล์มี 3 แถวเหมือนกันและระบบมีอยู่แล้ว 2 แถว จะนับซ้ำ 2"""
    years = sorted(int(y) for y in df["year"].unique())
    qs = ",".join("?" * len(years))
    con = sqlite3.connect(db_path)
    try:
        db = pd.read_sql(
            f"SELECT latitude, longitude, year, cause FROM accident_events WHERE year IN ({qs})",
            con, params=years)
    finally:
        con.close()
    if db.empty:
        return 0

    def key(d):
        return pd.DataFrame({
            "a": d["latitude"].astype(float).round(6),
            "b": d["longitude"].astype(float).round(6),
            "y": d["year"].astype(int),
            "c": d["cause"].fillna("").astype(str),
        })
    f = key(df).groupby(["a", "b", "y", "c"]).size().rename("nf")
    e = key(db).groupby(["a", "b", "y", "c"]).size().rename("ne")
    j = pd.concat([f, e], axis=1, join="inner")
    return int(np.minimum(j["nf"], j["ne"]).sum())


def drop_existing(db_path: str, df: pd.DataFrame, replace_years=()):
    """Upsert: ตัดแถวที่ซ้ำกับข้อมูลเดิมออก (พิกัด + ปี + สาเหตุเหมือนกัน) เหลือเฉพาะแถวใหม่
    ถ้าไฟล์มี 3 แถวเหมือนกันและระบบมีอยู่แล้ว 2 แถว จะเพิ่มแค่ 1 แถว
    คืน (df ที่เหลือ, จำนวนแถวที่ข้ามเพราะซ้ำ)"""
    years = sorted(int(y) for y in df["year"].unique() if int(y) not in set(replace_years))
    if not years:
        return df, 0
    qs = ",".join("?" * len(years))
    con = sqlite3.connect(db_path)
    try:
        db = pd.read_sql(
            f"SELECT latitude, longitude, year, cause FROM accident_events WHERE year IN ({qs})",
            con, params=years)
    finally:
        con.close()
    if db.empty:
        return df, 0

    def key(d):
        return pd.DataFrame({
            "a": d["latitude"].astype(float).round(6).values,
            "b": d["longitude"].astype(float).round(6).values,
            "y": d["year"].astype(int).values,
            "c": d["cause"].fillna("").astype(str).values,
        }, index=d.index)
    kf = key(df)
    kf["n"] = kf.groupby(["a", "b", "y", "c"]).cumcount()
    ne = key(db).groupby(["a", "b", "y", "c"]).size().rename("ne").reset_index()
    kf = kf.merge(ne, on=["a", "b", "y", "c"], how="left")
    kf.index = df.index
    keep = kf["ne"].isna() | (kf["n"] >= kf["ne"])
    return df[keep.values].reset_index(drop=True), int((~keep).sum())


def ingest_events(db_path: str, df: pd.DataFrame, version_id: int, replace_years=()) -> int:
    """เพิ่มข้อมูลใน transaction เดียว (ถ้าพังกลางทาง ข้อมูลเดิมไม่เปลี่ยน). คืนจำนวนแถวที่เพิ่ม"""
    rows = [
        (float(r.latitude), float(r.longitude), r.province, int(r.year), r.cause, int(version_id),
         (None if getattr(r, "accident_hour", None) is None or pd.isna(r.accident_hour) else int(r.accident_hour)),
         (None if getattr(r, "weather", None) is None or pd.isna(r.weather) else str(r.weather)))
        for r in df.itertuples()
    ]
    con = sqlite3.connect(db_path)
    try:
        con.execute("BEGIN")
        if replace_years:
            qs = ",".join("?" * len(replace_years))
            con.execute(f"DELETE FROM accident_events WHERE year IN ({qs})", tuple(replace_years))
        con.executemany(
            "INSERT INTO accident_events (latitude, longitude, province, year, cause, version_id, accident_hour, weather) "
            "VALUES (?,?,?,?,?,?,?,?)", rows)
        con.commit()
        return len(rows)
    except Exception:
        con.rollback()
        raise
    finally:
        con.close()