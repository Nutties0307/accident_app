import sys, datetime
import pandas as pd
import database
from database import SessionLocal, AccidentEvent, DataVersion, AppSetting

COLMAP = {"LATITUDE": "latitude", "LONGITUDE": "longitude", "ปีที่เกิดเหตุ": "year",
          "จังหวัด": "province", "สาเหตุ_มาตรฐาน": "cause"}


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    path, force = sys.argv[1], "--force" in sys.argv
    db = SessionLocal()
    if db.query(AccidentEvent).count() and not force:
        sys.exit("มีข้อมูลใน accident_events แล้ว (ใช้ --force ถ้าต้องการนำเข้าใหม่)")
    df = pd.read_csv(path, low_memory=False)
    missing = [c for c in COLMAP if c not in df.columns]
    if missing:
        sys.exit(f"ไม่พบคอลัมน์: {missing}")
    df = df[list(COLMAP)].rename(columns=COLMAP).dropna(subset=["latitude", "longitude", "year"])
    df["year"] = df["year"].astype(int)
    df.loc[df["year"] > 2400, "year"] -= 543  # พ.ศ. -> ค.ศ.
    if force:
        db.query(AccidentEvent).delete()
    ymin, ymax = int(df["year"].min()), int(df["year"].max())
    active = f"{ymax - 1},{ymax}"
    v = DataVersion(kind="initial", filename=path.split("\\")[-1].split("/")[-1], status="done",
                    progress=100, rows_in_file=len(df), rows_added=len(df), year_min=ymin,
                    year_max=ymax, active_years=active, message="นำเข้าข้อมูลเดิม",
                    finished_at=datetime.datetime.utcnow())
    db.add(v); db.flush()
    df["version_id"] = v.id
    db.bulk_insert_mappings(AccidentEvent, df.to_dict("records"))
    if not db.get(AppSetting, "active_years"):
        db.add(AppSetting(key="active_years", value="2024,2025"))
    db.commit()
    print(f"นำเข้า {len(df):,} แถว ปี {ymin}-{ymax} (version {v.id})")


if __name__ == "__main__":
    main()