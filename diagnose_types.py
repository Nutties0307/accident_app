import sys
import numpy as np
import pandas as pd
import geopandas as gpd

import ingest
import map_matching as mm

if len(sys.argv) < 2:
    sys.exit(__doc__)
path = sys.argv[1]
expected = int(sys.argv[2]) if len(sys.argv) > 2 else None
LIMIT = 100

df, report = ingest.validate(ingest.read_table(path, path))
if report["errors"]:
    sys.exit("ไฟล์ใช้ไม่ได้: " + " / ".join(report["errors"]))
d = df.reset_index(drop=True)
pts = gpd.GeoDataFrame(d[["latitude", "longitude"]],
                       geometry=gpd.points_from_xy(d["longitude"], d["latitude"]), crs="EPSG:4326")
tile = (np.floor(d["longitude"] / mm.TILE_DEG).astype(int).astype(str) + "_"
        + np.floor(d["latitude"] / mm.TILE_DEG).astype(int).astype(str))
groups = list(pd.Series(np.arange(len(d))).groupby(tile.values))

classes = list(mm.ROAD_TYPES_DEFAULT) + ["service"]
D = np.full((len(d), len(classes)), np.inf)   # ระยะถึงถนนที่ใกล้ที่สุดของแต่ละชนิด

print(f"กำลังวัดระยะ {len(d):,} จุด x {len(classes)} ชนิดถนน ...")
for _, idx in groups:
    idx = idx.values
    sub = d.iloc[idx]
    bbox = (sub["longitude"].min() - 0.02, sub["latitude"].min() - 0.02,
            sub["longitude"].max() + 0.02, sub["latitude"].max() + 0.02)
    roads = gpd.read_file(mm.ROADS_FILE, layer="roads", bbox=bbox)
    if roads.empty:
        continue
    roads_p = roads.to_crs(mm.UTM)
    pts_p = pts.iloc[idx][["geometry"]].to_crs(mm.UTM)
    for ci, cname in enumerate(classes):
        r = roads_p[roads_p["highway"] == cname]
        if r.empty:
            continue
        j = gpd.sjoin_nearest(pts_p, r[["geometry"]], how="inner",
                              max_distance=1000, distance_col="d")
        best = j.groupby(level=0)["d"].min()
        D[best.index.values, ci] = best.values


def kept(names):
    cols = [classes.index(n) for n in names]
    return int((D[:, cols].min(axis=1) <= LIMIT).sum())


def show(label, names):
    k = kept(names)
    diff = f"  (ต่างจากที่คาด {k - expected:+,})" if expected else ""
    print(f"{label:<44} เหลือ {k:,}{diff}")


allc = classes
print(f"\nเกณฑ์ {LIMIT} เมตร ทั้งหมด {len(d):,} แถว" + (f" เป้าหมาย {expected:,}" if expected else ""))
show("ทุกชนิด (รวม service)", allc)
print("\n-- ตัดออกทีละชนิด --")
for c in classes:
    show(f"ไม่รวม {c}", [x for x in allc if x != c])
print("\n-- ชุดสะสม --")
major = ["motorway", "trunk", "primary", "secondary", "tertiary"]
links = [c for c in classes if c.endswith("_link")]
show("ถนนหลัก (motorway..tertiary)", major)
show("ถนนหลัก + link", major + links)
show("+ unclassified", major + links + ["unclassified"])
show("+ unclassified + residential", major + links + ["unclassified", "residential"])
show("+ living_street", major + links + ["unclassified", "residential", "living_street"])