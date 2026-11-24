import json
import re
import sqlite3
import sys
import urllib.parse
import urllib.request

import database

# ขอบเขตประเทศไทยโดยประมาณ
BBOX = (5.5, 97.3, 20.5, 105.7)
OVERPASS_MIRRORS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]


def parse_speed(v):
    if v is None:
        return None
    try:
        if v != v:  # NaN
            return None
    except Exception:
        pass
    m = re.match(r"^\s*(\d{2,3})(?:\.0+)?\s*(km/h)?\s*$", str(v))
    if not m:
        return None
    n = int(m.group(1))
    return n if 20 <= n <= 150 else None


def parse_overpass(data: dict) -> list:
    out = []
    for e in data.get("elements", []):
        lat = e.get("lat", (e.get("center") or {}).get("lat"))
        lon = e.get("lon", (e.get("center") or {}).get("lon"))
        if lat is None or lon is None:
            continue
        t = e.get("tags") or {}
        name = t.get("name:th") or t.get("name") or t.get("ref")
        out.append((float(lat), float(lon), name, parse_speed(t.get("maxspeed"))))
    return out


def outside_thailand(lat: float, lon: float) -> bool:
    """กันจุดของมาเลเซีย/กัมพูชาที่หลุดเข้ากรอบสี่เหลี่ยม (กฎหยาบๆ ตามแนวชายแดน)"""
    if lat < 6.3 and lon < 101:      # มาเลเซียฝั่งตะวันตก
        return True
    if lon > 104 and lat < 14:       # กัมพูชา
        return True
    return False


def _post(url: str, q: str) -> dict:
    req = urllib.request.Request(
        url, data=urllib.parse.urlencode({"data": q}).encode(),
        headers={"User-Agent": "SafeRoute-student-project"})
    with urllib.request.urlopen(req, timeout=150) as r:
        return json.loads(r.read().decode("utf-8"))


def fetch_osm() -> list:
    s, w, n, e = BBOX
    # แบบหลัก: ค้นเฉพาะในพื้นที่ประเทศไทย (ISO3166-1 = TH) แบบสำรอง: กรอบสี่เหลี่ยม แล้วกรองนอกประเทศออก
    q_area = (
        '[out:json][timeout:120];area["ISO3166-1"="TH"][admin_level=2]->.th;('
        'node["highway"="speed_camera"](area.th);'
        'node["enforcement"="maxspeed"](area.th););out tags center;'
    )
    q_bbox = (
        f'[out:json][timeout:120];('
        f'node["highway"="speed_camera"]({s},{w},{n},{e});'
        f'node["enforcement"="maxspeed"]({s},{w},{n},{e});'
        f');out tags center;'
    )
    last = None
    for label, q in (("พื้นที่ประเทศไทย", q_area), ("กรอบสี่เหลี่ยม", q_bbox)):
        for url in OVERPASS_MIRRORS:
            try:
                rows = parse_overpass(_post(url, q))
            except Exception as ex:  # ลองเซิร์ฟเวอร์สำรอง
                last = ex
                print(f"ดึงจาก {url} ({label}) ไม่ได้: {ex}")
                continue
            before = len(rows)
            rows = [r for r in rows if not outside_thailand(r[0], r[1])]
            if before != len(rows):
                print(f"ตัดจุดนอกประเทศไทยออก {before - len(rows)} จุด")
            if rows:
                print(f"ใช้ผลแบบ: {label}")
                return rows
    sys.exit(f"ดึงข้อมูลจาก OpenStreetMap ไม่สำเร็จ: {last}")


def read_csv(path: str) -> list:
    import pandas as pd
    df = None
    for enc in ("utf-8-sig", "cp874"):
        try:
            df = pd.read_csv(path, encoding=enc)
            break
        except UnicodeDecodeError:
            continue
    if df is None:
        sys.exit("อ่านไฟล์ CSV ไม่ได้")
    cols = {c.strip().lower(): c for c in df.columns}
    la = cols.get("latitude") or cols.get("lat")
    lo = cols.get("longitude") or cols.get("lon") or cols.get("lng")
    if not la or not lo:
        sys.exit(f"ไฟล์ต้องมีคอลัมน์ latitude และ longitude (ที่มี: {list(df.columns)})")
    nm = cols.get("name") or cols.get("ชื่อ")
    sp = cols.get("speed_limit") or cols.get("maxspeed")
    out = []
    for _, r in df.iterrows():
        try:
            lat, lon = float(r[la]), float(r[lo])
        except (TypeError, ValueError):
            continue
        if not (5 <= lat <= 21 and 97 <= lon <= 106):
            continue
        name = None if nm is None or pd.isna(r[nm]) else str(r[nm]).strip()
        out.append((lat, lon, name, parse_speed(None if sp is None else r[sp])))
    return out


def dedupe(rows: list) -> list:
    seen, out = set(), []
    for lat, lon, name, sp in rows:
        k = (round(lat, 4), round(lon, 4))  # ~11 เมตร
        if k in seen:
            continue
        seen.add(k)
        out.append((lat, lon, name, sp))
    return out


def save(con, rows: list, source: str):
    con.execute("DELETE FROM speed_cameras WHERE source=?", (source,))
    con.executemany(
        "INSERT INTO speed_cameras (latitude, longitude, name, speed_limit, source) VALUES (?,?,?,?,?)",
        [(la, lo, nm, sp, source) for la, lo, nm, sp in rows])


def main():
    use_osm = "--osm" in sys.argv
    csv_path = sys.argv[sys.argv.index("--csv") + 1] if "--csv" in sys.argv else None
    if not use_osm and not csv_path:
        sys.exit(__doc__)

    con = sqlite3.connect(database.DATABASE_URL.replace("sqlite:///", ""), timeout=60)
    con.execute(
        "CREATE TABLE IF NOT EXISTS speed_cameras (id INTEGER PRIMARY KEY, latitude FLOAT NOT NULL, "
        "longitude FLOAT NOT NULL, name VARCHAR, speed_limit INTEGER, source VARCHAR NOT NULL DEFAULT 'osm')")
    try:
        con.execute("BEGIN")
        if use_osm:
            rows = dedupe(fetch_osm())
            print(f"OpenStreetMap: {len(rows):,} จุด (มีความเร็วจำกัดระบุ {sum(1 for r in rows if r[3]):,} จุด)")
            save(con, rows, "osm")
        if csv_path:
            rows = dedupe(read_csv(csv_path))
            print(f"CSV: {len(rows):,} จุด")
            save(con, rows, "manual")
        con.commit()
        total = con.execute("SELECT COUNT(*) FROM speed_cameras").fetchone()[0]
        print(f"บันทึกเรียบร้อย รวมทั้งหมดในระบบ {total:,} จุด")
    except Exception:
        con.rollback()
        raise
    finally:
        con.close()


if __name__ == "__main__":
    main()