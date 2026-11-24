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

df, report = ingest.validate(ingest.read_table(path, path))
if report["errors"]:
    sys.exit("ไฟล์ใช้ไม่ได้: " + " / ".join(report["errors"]))
d = df.reset_index(drop=True)
pts = gpd.GeoDataFrame(d[["latitude", "longitude"]],
                       geometry=gpd.points_from_xy(d["longitude"], d["latitude"]), crs="EPSG:4326")
tile = (np.floor(d["longitude"] / mm.TILE_DEG).astype(int).astype(str) + "_"
        + np.floor(d["latitude"] / mm.TILE_DEG).astype(int).astype(str))
groups = list(pd.Series(np.arange(len(d))).groupby(tile.values))


def distances(types):
    dist = np.full(len(d), np.inf)
    for _, idx in groups:
        idx = idx.values
        sub = d.iloc[idx]
        bbox = (sub["longitude"].min() - 0.02, sub["latitude"].min() - 0.02,
                sub["longitude"].max() + 0.02, sub["latitude"].max() + 0.02)
        roads = gpd.read_file(mm.ROADS_FILE, layer="roads", bbox=bbox)
        roads = roads[roads["highway"].isin(types)]
        if roads.empty:
            continue
        j = gpd.sjoin_nearest(pts.iloc[idx][["geometry"]].to_crs(mm.UTM),
                              roads[["geometry"]].to_crs(mm.UTM),
                              how="inner", max_distance=1000, distance_col="d")
        best = j.groupby(level=0)["d"].min()
        dist[best.index.values] = best.values
    return dist


variants = {
    "ไม่รวม service": mm.ROAD_TYPES_DEFAULT,
    "รวม service": mm.ROAD_TYPES_DEFAULT + ("service",),
}
for name, types in variants.items():
    dist = distances(types)
    print(f"\n=== {name} (ทั้งหมด {len(d):,} แถว) ===")
    print("จุดที่ไกลกว่า 1 กม. หรือหาถนนไม่เจอ:", int(np.isinf(dist).sum()))
    for t in (5, 10, 15, 20, 25, 30, 40, 50, 75, 100):
        print(f"  ภายใน {t:>3} ม.: เหลือ {int((dist <= t).sum()):,}")
    if expected:
        s = np.sort(dist)
        if expected <= len(s):
            print(f"  >> ระยะที่ทำให้เหลือ {expected:,} แถวพอดี ≈ {s[expected - 1]:.1f} เมตร")