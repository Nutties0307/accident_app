import sys
import pandas as pd

if len(sys.argv) < 2:
    sys.exit(__doc__)

df = pd.read_csv(sys.argv[1], low_memory=False, encoding="utf-8-sig")
print("จำนวนแถว:", f"{len(df):,}")
print("คอลัมน์:", [c for c in df.columns if "dist" in c.lower() or "match" in c.lower() or "index" in c.lower()])

if "dist_to_road" not in df.columns:
    sys.exit("ไม่พบคอลัมน์ dist_to_road ในไฟล์นี้")

d = pd.to_numeric(df["dist_to_road"], errors="coerce")
print("\nระยะจากถนน (เมตร) ของแถวที่เก็บไว้:")
print(d.describe(percentiles=[.5, .9, .95, .99]).round(2).to_string())
print("ระยะมากที่สุด:", round(float(d.max()), 3))
for t in (10, 15, 20, 30, 50, 100):
    print(f"  แถวที่ไกลกว่า {t:>3} ม.: {int((d > t).sum()):,}")

ycol = "ปีที่เกิดเหตุ"
if ycol in df.columns:
    y = pd.to_numeric(df[ycol], errors="coerce")
    y = y.where(y <= 2400, y - 543)
    print("\nแยกตามปี (จำนวนแถว / ระยะมากสุด):")
    g = d.groupby(y).agg(["size", "max"]).round(2)
    print(g.to_string())