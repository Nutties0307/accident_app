import re
import sqlite3
import sys

import numpy as np
import pandas as pd

import database  # ให้ migration เพิ่มคอลัมน์ก่อน

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
        # ปัดเป็นนาทีก่อน กัน 16.9999 ถูกตัดเป็น 16
        return (int(round(x * 1440)) // 60) % 24

    if isinstance(v, (int, float, np.integer, np.floating)):
        x = float(v)
        if 0 <= x < 1:          # Excel เก็บเวลาเป็นเศษส่วนของวัน
            return from_fraction(x)
        if 0 <= x < 24:
            return int(x)
        if 100 <= x <= 2359:    # 2130
            h = int(x) // 100
            return h if h < 24 else None
        return None
    t = str(v).strip()
    if re.match(r"^\d*\.?\d+$", t) and ":" not in t:   # ตัวเลขในรูปข้อความ เช่น '0.375' (เศษส่วนของวัน), '0.5', '0'
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



NEED = ["LATITUDE", "LONGITUDE", "ปีที่เกิดเหตุ", "สาเหตุ_มาตรฐาน", "เวลา", "สภาพอากาศ"]


def is_exact_midnight(v):
    """เวลา 00:00 เป๊ะ (นาทีเป็น 0 ด้วย) — มักเป็นค่าเริ่มต้นของแถวที่ไม่มีเวลาจริง"""
    try:
        if pd.isna(v):
            return False
    except (TypeError, ValueError):
        pass
    if hasattr(v, "hour"):
        return int(v.hour) == 0 and int(getattr(v, "minute", 0)) == 0
    if isinstance(v, (int, float, np.integer, np.floating)):
        return float(v) == 0.0
    t = str(v).strip()
    return re.match(r"^0{1,2}\s*[:.]\s*00(\s*[:.]\s*00)?\s*$", t) is not None or re.match(r"^0(\.0+)?$", t) is not None


def key_frame(lat, lon, year, cause):
    y = pd.to_numeric(year, errors="coerce")
    y = y.where(~(y > 2400), y - 543)
    return pd.DataFrame({
        "a": pd.to_numeric(lat, errors="coerce").round(6).values,
        "b": pd.to_numeric(lon, errors="coerce").round(6).values,
        "y": y.values,
        "c": pd.Series(cause).fillna("").astype(str).str.strip().values,
    })


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    dry = "--dry-run" in sys.argv
    if not args:
        sys.exit(__doc__)

    df = None
    for enc in ("utf-8-sig", "cp874"):
        try:
            df = pd.read_csv(args[0], encoding=enc, low_memory=False)
            break
        except UnicodeDecodeError:
            continue
    if df is None:
        sys.exit("อ่านไฟล์ CSV ไม่ได้")
    df.columns = [str(c).strip() for c in df.columns]
    missing = [c for c in NEED if c not in df.columns]
    if missing:
        sys.exit(f"ไฟล์นี้ไม่มีคอลัมน์: {missing}\nคอลัมน์ที่มี: {list(df.columns)}")

    f = key_frame(df["LATITUDE"], df["LONGITUDE"], df["ปีที่เกิดเหตุ"], df["สาเหตุ_มาตรฐาน"])
    f["hour"] = df["เวลา"].map(parse_hour).values
    keep_midnight = "--keep-midnight" in sys.argv
    midnight = df["เวลา"].map(is_exact_midnight).values
    hour0 = (f["hour"] == 0).sum()
    print(f"ชั่วโมง 0 ทั้งหมด {int(hour0):,} แถว เป็น 00:00 เป๊ะ {int(midnight.sum()):,} แถว "
          f"(ชั่วโมง 1 มี {int((f['hour'] == 1).sum()):,} แถว)")
    print("ชนิดข้อมูลคอลัมน์เวลา:", df["เวลา"].dtype)
    raw0 = df.loc[(f["hour"] == 0).reindex(df.index, fill_value=False), "เวลา"]
    print("ค่าดิบที่ถูกแปลงเป็นชั่วโมง 0 (บ่อยสุด 12 ค่า):", raw0.astype(str).value_counts().head(12).to_dict())
    print("ตัวอย่างค่าดิบทั่วไป (10 ค่าแรก):", df["เวลา"].astype(str).head(10).tolist())
    if not keep_midnight:
        f.loc[midnight, "hour"] = np.nan   # ถือว่าไม่ทราบเวลา (ใส่ --keep-midnight ถ้าต้องการเก็บ)
        print("ตั้ง 00:00 เป๊ะ เป็น 'ไม่ทราบเวลา' (ใส่ --keep-midnight ถ้าไม่ต้องการ)")
    f["weather"] = df["สภาพอากาศ"].map(clean_weather).values
    f = f.dropna(subset=["a", "b", "y"])
    f["y"] = f["y"].astype(int)
    f["n"] = f.groupby(["a", "b", "y", "c"]).cumcount()   # ลำดับของแถวที่ key เหมือนกัน

    con = sqlite3.connect(database.DATABASE_URL.replace("sqlite:///", ""), timeout=60)
    try:
        cols = [r[1] for r in con.execute("PRAGMA table_info(accident_events)").fetchall()]
        if "accident_hour" not in cols:
            con.execute("ALTER TABLE accident_events ADD COLUMN accident_hour INTEGER")
        if "weather" not in cols:
            con.execute("ALTER TABLE accident_events ADD COLUMN weather TEXT")
        con.commit()
        ev = pd.read_sql_query(
            "SELECT id, latitude, longitude, year, cause FROM accident_events ORDER BY id", con)
        k = key_frame(ev["latitude"], ev["longitude"], ev["year"], ev["cause"])
        k["id"] = ev["id"].values
        k["y"] = k["y"].astype(int)
        k["n"] = k.groupby(["a", "b", "y", "c"]).cumcount()

        m = k.merge(f[["a", "b", "y", "c", "n", "hour", "weather"]],
                    on=["a", "b", "y", "c", "n"], how="left")
        total = len(m)
        got_h = int(m["hour"].notna().sum())
        got_w = int(m["weather"].notna().sum())
        print(f"แถวในระบบ {total:,} | ได้ชั่วโมง {got_h:,} ({got_h/total:.1%}) | ได้สภาพอากาศ {got_w:,} ({got_w/total:.1%})")
        print("สภาพอากาศที่พบ:", m["weather"].value_counts().head(8).to_dict())
        print("จำนวนตามชั่วโมง:", m["hour"].dropna().astype(int).value_counts().sort_index().to_dict())
        if dry:
            print("--dry-run: ยังไม่บันทึก")
            return
        if got_h == 0 and got_w == 0:
            sys.exit("จับคู่ไม่ได้เลย จึงไม่บันทึก (ตรวจว่าใช้ไฟล์ CSV ตัวเดียวกับที่นำเข้าหรือไม่)")

        rows = [
            (None if pd.isna(r.hour) else int(r.hour),
             None if r.weather is None or (isinstance(r.weather, float) and pd.isna(r.weather)) else str(r.weather),
             int(r.id))
            for r in m.itertuples()
        ]
        con.execute("BEGIN")
        con.executemany("UPDATE accident_events SET accident_hour=?, weather=? WHERE id=?", rows)
        con.commit()
        print("บันทึกเรียบร้อย")
    except Exception:
        con.rollback()
        raise
    finally:
        con.close()


if __name__ == "__main__":
    main()