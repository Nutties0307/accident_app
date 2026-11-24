import sqlite3
import numpy as np
import pandas as pd

GRID_ROUND = 0.0005
LEVELS = ["ต่ำ", "ปานกลาง", "สูง", "สูงมาก"]


def _mode_smallest(s: pd.Series):
    """ค่าที่พบบ่อยสุด ถ้าเท่ากันเลือกค่าน้อยสุด (เหมือน mode().iloc[0])"""
    s = s.dropna()
    s = s[s.astype(str).str.strip() != ""]
    if s.empty:
        return ""
    vc = s.value_counts()
    top = vc[vc == vc.max()].index
    return sorted(top)[0]


def _mode_by_group(d: pd.DataFrame, col: str) -> pd.Series:
    """ค่าที่พบบ่อยสุดของ col ในแต่ละกลุ่มตำแหน่ง (เสมอกัน -> ค่าน้อยสุด) แบบเวกเตอร์ เร็วกว่า apply ต่อกลุ่มหลายสิบเท่า"""
    x = d[["lat_group", "lon_group", col]]
    x = x[x[col].str.strip() != ""]
    c = x.groupby(["lat_group", "lon_group", col]).size().reset_index(name="n")
    c = c.sort_values(["lat_group", "lon_group", "n", col], ascending=[True, True, False, True])
    c = c.drop_duplicates(["lat_group", "lon_group"])
    return c.set_index(["lat_group", "lon_group"])[col]


def compute_risk_table(df: pd.DataFrame, active_years, thresholds=None) -> pd.DataFrame:
    """df ต้องมีคอลัมน์ latitude, longitude, province, year, cause"""
    active_years = set(int(y) for y in active_years)
    d = df.dropna(subset=["latitude", "longitude", "year"]).copy()
    d["lat_group"] = (d["latitude"] / GRID_ROUND).round() * GRID_ROUND
    d["lon_group"] = (d["longitude"] / GRID_ROUND).round() * GRID_ROUND
    d["province"] = d["province"].fillna("").astype(str)
    d["cause"] = d["cause"].fillna("").astype(str)

    g = d.groupby(["lat_group", "lon_group"])
    out = g.agg(
        latitude=("latitude", "mean"),
        longitude=("longitude", "mean"),
        total_count=("year", "size"),
        n_distinct_years=("year", "nunique"),
        latest_year=("year", "max"),
    )
    out["province"] = _mode_by_group(d, "province").reindex(out.index).fillna("")
    out["top_cause"] = _mode_by_group(d, "cause").reindex(out.index).fillna("")
    out = out.reset_index(drop=True)  # latitude/longitude = ค่าเฉลี่ยพิกัดของเหตุการณ์ในกลุ่ม (ตรงกับของเดิม)

    out["is_still_active"] = out["latest_year"].isin(active_years).astype(int)
    act = out["is_still_active"] == 1

    # เกณฑ์ระดับ: P75 / P95 ของจุดที่ยัง active (ตามที่ตกลงกัน)
    if thresholds is None:
        vals = out.loc[act, "total_count"]
        if len(vals):
            thresholds = {
                "p50": float(vals.quantile(0.50)),
                "p75": float(vals.quantile(0.75)),
                "p95": float(vals.quantile(0.95)),
            }
        else:
            thresholds = {"p50": 0, "p75": 0, "p95": 0}
    c = out["total_count"]
    # ตรงกับของเดิม: "มากกว่า" เกณฑ์ (ไม่ใช่ >=) เช่น P50=1,P75=2,P95=4 -> 1=ต่ำ, 2=ปานกลาง, 3-4=สูง, 5+=สูงมาก
    level = np.select(
        [~act, c > thresholds["p95"], c > thresholds["p75"], c > thresholds["p50"]],
        ["ต่ำ", "สูงมาก", "สูง", "ปานกลาง"],
        default="ต่ำ",
    )
    out["risk_level"] = level
    out["weighted_score"] = np.where(act, out["total_count"] * out["n_distinct_years"], 0).astype(float)
    mx = out["weighted_score"].max() if len(out) else 0
    out["risk_score"] = np.where(act & (mx > 0), (out["weighted_score"] / (mx if mx else 1) * 100).round(2), 0.0)
    out.attrs["thresholds"] = thresholds
    return out


COLS = ["latitude", "longitude", "province", "total_count", "n_distinct_years",
        "weighted_score", "is_still_active", "risk_score", "risk_level", "top_cause", "latest_year"]


def recompute_risk_points(db_path: str, active_years, progress=lambda pct, msg="": None) -> dict:
    """คืน dict สรุปจำนวนจุดแต่ละระดับ; แทนที่ risk_points ทั้งตารางใน transaction เดียว (พังกลางทางข้อมูลเดิมไม่หาย)"""
    con = sqlite3.connect(db_path)
    try:
        progress(5, "กำลังอ่านข้อมูลอุบัติเหตุ")
        df = pd.read_sql_query(
            "SELECT latitude, longitude, province, year, cause FROM accident_events", con)
        if df.empty:
            raise ValueError("ไม่มีข้อมูลอุบัติเหตุในระบบ")
        progress(30, f"กำลังคำนวณระดับความเสี่ยงจาก {len(df):,} เหตุการณ์")
        table = compute_risk_table(df, active_years)
        if not (table["is_still_active"] == 1).any():
            raise ValueError("ช่วงปีที่เลือกไม่มีข้อมูลเลย กรุณาเลือกช่วงปีใหม่")
        progress(70, f"กำลังบันทึก {len(table):,} จุด")
        rows = [tuple(r) for r in table[COLS].itertuples(index=False, name=None)]
        rows = [tuple(x.item() if hasattr(x, "item") else x for x in r) for r in rows]
        con.execute("BEGIN")
        con.execute("DELETE FROM risk_points")
        con.executemany(
            f"INSERT INTO risk_points ({', '.join(COLS)}) VALUES ({', '.join('?' * len(COLS))})", rows)
        con.commit()
        progress(100, "เสร็จสิ้น")
        counts = table["risk_level"].value_counts().to_dict()
        return {"total_points": int(len(table)),
                "active_points": int(table["is_still_active"].sum()),
                "levels": {k: int(counts.get(k, 0)) for k in LEVELS},
                "thresholds": table.attrs.get("thresholds")}
    except Exception:
        con.rollback()
        raise
    finally:
        con.close()