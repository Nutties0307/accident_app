import sys
import time

import ingest
import map_matching

try:
    import psutil
    proc = psutil.Process()
except ImportError:
    proc = None


def ram():
    if proc is None:
        return "ไม่ทราบ (pip install psutil)"
    mi = proc.memory_info()
    peak = getattr(mi, "peak_wset", mi.rss)
    return f"{peak / 1e9:.2f} GB"


if len(sys.argv) < 2:
    sys.exit(__doc__)

path = sys.argv[1]
expected = int(sys.argv[2]) if len(sys.argv) > 2 else None

df, report = ingest.validate(ingest.read_table(path, path))
if report["errors"]:
    sys.exit("ไฟล์ใช้ไม่ได้: " + " / ".join(report["errors"]))
print(f"อ่านไฟล์: {len(df):,} แถวที่ใช้ได้")

variants = {
    "A) ไม่รวมถนน service": map_matching.ROAD_TYPES_DEFAULT,
    "B) รวมถนน service": map_matching.ROAD_TYPES_DEFAULT + ("service",),
}

for name, types in variants.items():
    t = time.time()
    out = map_matching.match_points(df, road_types=types)
    sec = time.time() - t
    msg = f"{name}: เหลือ {len(out):,} จาก {len(df):,} แถว  ใช้เวลา {sec:.1f} วินาที  RAM สูงสุด {ram()}"
    if expected:
        msg += f"  (ต่างจากที่คาด {len(out) - expected:+,})"
    print(msg)