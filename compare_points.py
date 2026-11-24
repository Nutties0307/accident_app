import sqlite3, sys, os
import numpy as np
import pandas as pd

ORDER = {"ต่ำ": 0, "ปานกลาง": 1, "สูง": 2, "สูงมาก": 3}

def load(path):
    if not os.path.exists(path):
        print("ไม่พบไฟล์:", path); sys.exit(1)
    con = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
    df = pd.read_sql("select * from risk_points", con)
    try:
        yrs = con.execute("select value from app_settings where key='active_years'").fetchone()
    except Exception:
        yrs = None
    con.close()
    return df, (yrs[0] if yrs else "ไม่พบ")

if len(sys.argv) != 3:
    print(__doc__); sys.exit(1)
(a, ya), (b, yb) = load(sys.argv[1]), load(sys.argv[2])
print("ช่วงปีที่นับ  ก่อน:", ya, "| หลัง:", yb)
for d in (a, b):
    d["k"] = (np.floor(d["latitude"] / 0.0005).astype(int).astype(str) + "_" +
              np.floor(d["longitude"] / 0.0005).astype(int).astype(str))
    d["lvn"] = d["risk_level"].map(ORDER)
ka = a.groupby("k").agg(lv_ก่อน=("lvn", "max"), cnt_ก่อน=("total_count", "sum"))
m = b.merge(ka, left_on="k", right_index=True, how="left")
m["lv_ก่อน"] = m["lv_ก่อน"].fillna(-1)
m["cnt_ก่อน"] = m["cnt_ก่อน"].fillna(0).astype(int)
up = m[(m["lvn"] >= 2) & (m["lvn"] > m["lv_ก่อน"])].copy()
name = {v: k for k, v in ORDER.items()}; name[-1] = "ไม่มีจุด"
up = up[(up["latest_year"] == b["latest_year"].max()) & (up["total_count"] > up["cnt_ก่อน"])].copy()
up["ระดับก่อน"] = up["lv_ก่อน"].map(name)
print(f"\nจุดที่ได้อุบัติเหตุปีล่าสุดเพิ่ม และเป็น สูง/สูงมาก: {len(up)} จุด")
cols = ["latitude", "longitude", "province", "ระดับก่อน", "risk_level", "cnt_ก่อน", "total_count", "top_cause", "latest_year"]
out = up.sort_values("total_count", ascending=False)[cols].head(40)
print(out.to_string(index=False))
out.to_csv("new_high_points.csv", index=False, encoding="utf-8-sig")
print("\nบันทึกไว้ที่ new_high_points.csv")