import sys, sqlite3
import pandas as pd
from risk_recompute import compute_risk_table

db = sys.argv[1] if len(sys.argv) > 1 else "accident_app.db"
con = sqlite3.connect(db)
ev = pd.read_sql_query("SELECT latitude, longitude, province, year, cause FROM accident_events", con)
old = pd.read_sql_query("SELECT * FROM risk_points", con)
active = [int(x) for x in con.execute("SELECT value FROM app_settings WHERE key='active_years'").fetchone()[0].split(",")]
new = compute_risk_table(ev, active)
print("จำนวนจุด เดิม/ใหม่:", len(old), len(new))
print("เดิม:", old["risk_level"].value_counts().to_dict())
print("ใหม่:", new["risk_level"].value_counts().to_dict())
for d in (old, new):
    d["k"] = d["latitude"].round(5).astype(str) + "," + d["longitude"].round(5).astype(str)
m = old.merge(new, on="k", suffixes=("_o", "_n"))
print("จุดที่จับคู่ได้:", len(m))
for col in ["total_count", "risk_level", "is_still_active", "risk_score", "top_cause", "province"]:
    diff = (m[col + "_o"].astype(str) != m[col + "_n"].astype(str)).sum()
    print(f"  {col}: ต่างกัน {diff}")
