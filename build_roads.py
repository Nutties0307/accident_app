import sys
import time

import geopandas as gpd


HIGHWAYS = [
    "motorway", "trunk", "primary", "secondary", "tertiary",
    "unclassified", "residential", "living_street", "service",
    "motorway_link", "trunk_link", "primary_link", "secondary_link", "tertiary_link",
]

if len(sys.argv) < 2:
    sys.exit(__doc__)

pbf = sys.argv[1]
out = sys.argv[2] if len(sys.argv) > 2 else "roads.gpkg"

t0 = time.time()
print("กำลังอ่านถนนจาก", pbf, "(ใช้เวลาหลายนาที) ...")
where = "highway IN (" + ",".join(f"'{h}'" for h in HIGHWAYS) + ")"
roads = gpd.read_file(pbf, layer="lines", where=where, engine="pyogrio")
print(f"อ่านได้ {len(roads):,} เส้นถนน ใช้เวลา {time.time() - t0:.0f} วินาที")

roads = roads[["highway", "geometry"]]
roads.to_file(out, layer="roads", driver="GPKG", engine="pyogrio")
print(f"บันทึกแล้ว: {out}  (รวม {time.time() - t0:.0f} วินาที)")
print(roads["highway"].value_counts().to_string())