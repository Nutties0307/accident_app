import sys, sqlite3
import pandas as pd

db = sys.argv[1] if len(sys.argv) > 1 else "accident_app.db"
con = sqlite3.connect(db)
old = pd.read_sql_query("SELECT * FROM risk_points", con)
print("จุดทั้งหมด:", len(old))
print("active:", int((old.is_still_active == 1).sum()), " inactive:", int((old.is_still_active == 0).sum()))
print()
for act in (1, 0):
    d = old[old.is_still_active == act]
    print(f"=== is_still_active = {act} ===")
    g = d.groupby("risk_level").agg(
        จำนวน=("id", "size"),
        count_min=("total_count", "min"), count_max=("total_count", "max"),
        wscore_min=("weighted_score", "min"), wscore_max=("weighted_score", "max"),
        rscore_min=("risk_score", "min"), rscore_max=("risk_score", "max"))
    print(g.to_string()); print()
a = old[old.is_still_active == 1]
for col in ("total_count", "weighted_score"):
    print(f"percentile ของ {col} (เฉพาะ active):",
          {p: round(float(a[col].quantile(p / 100)), 3) for p in (25, 50, 75, 90, 95, 99)})
print()
print("ตัวอย่างพิกัดเดิม 5 แถว:")
print(old[["latitude", "longitude", "total_count", "risk_level"]].head(5).to_string())
ev = pd.read_sql_query("SELECT latitude, longitude FROM accident_events LIMIT 3", con)
print("ตัวอย่างพิกัดเหตุการณ์ดิบ:"); print(ev.to_string())